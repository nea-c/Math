import fs from "node:fs";
import path from "node:path";
import { evaluateProvider } from "../tools/math-provider-lib.mjs";

const functionRoot = path.resolve("Math/data/math/function");
const functionTagRoot = path.resolve("Math/data/math/tags/function");
const providerRoot = path.resolve("Math/data/math/context_float_provider");
const predicateRoot = path.resolve("Math/data/math/predicate");

function clone(value) {
  return structuredClone(value);
}

function jsonRegistry(root, prefix) {
  const registry = new Map();
  for (const entry of fs.readdirSync(root, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const file = path.join(entry.parentPath, entry.name);
    const relative = path.relative(root, file).replaceAll("\\", "/").replace(/\.json$/, "");
    registry.set(`${prefix}${relative}`, JSON.parse(fs.readFileSync(file, "utf8")));
  }
  return registry;
}

const providers = jsonRegistry(providerRoot, "math:");
const predicates = jsonRegistry(predicateRoot, "math:");
const functionTags = jsonRegistry(functionTagRoot, "math:");
const functionCommands = new Map();

function functionPath(id) {
  return id.replace(/^math:/, "");
}

export function resolvePublicFunctionTag(tag, name) {
  if (!tag || !Array.isArray(tag.values) || tag.values.length !== 1 || typeof tag.values[0] !== "string") {
    throw new Error(`Public function tag must contain exactly one function: math:${name}`);
  }
  return functionPath(tag.values[0]);
}

function publicImplementationPath(name) {
  return resolvePublicFunctionTag(functionTags.get(`math:${name}`), name);
}

function commandsFor(functionName) {
  let commands = functionCommands.get(functionName);
  if (!commands) {
    commands = fs.readFileSync(path.join(functionRoot, `${functionName}.mcfunction`), "utf8")
      .split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    functionCommands.set(functionName, commands);
  }
  return commands;
}

function normalizePath(pathText) {
  return pathText.replaceAll(/\[(\d+)\]/g, ".$1");
}

export function getPath(root, pathText) {
  return normalizePath(pathText)
    .split(".")
    .reduce((value, segment) => value?.[segment], root);
}

export function setPath(root, pathText, value) {
  const segments = normalizePath(pathText).split(".");
  let target = root;
  for (const [index, segment] of segments.slice(0, -1).entries()) {
    target = target[segment] ??= /^\d+$/.test(segments[index + 1]) ? [] : {};
  }
  target[segments.at(-1)] = clone(value);
}

export function removePath(root, pathText) {
  const segments = normalizePath(pathText).split(".");
  const target = segments.slice(0, -1).reduce((value, segment) => value?.[segment], root);
  const finalSegment = segments.at(-1);
  if (Array.isArray(target) && /^\d+$/.test(finalSegment)) target.splice(Number(finalSegment), 1);
  else if (target) delete target[finalSegment];
}

export function storageFieldKey(storageId, pathText) {
  return `${storageId}|${pathText}`;
}

function numericTagType(suffix) {
  return ({ b: "byte", s: "short", "": "int", l: "long", f: "float", d: "double" })[suffix.toLowerCase()];
}

export function parseGeneratedSnbt(text) {
  let index = 0;
  const numericTags = new Map();
  const fail = () => {
    throw new Error(`Unsupported generated SNBT literal: ${text}`);
  };
  const skipWhitespace = () => {
    while (/\s/.test(text[index] ?? "")) index += 1;
  };
  const childPath = (parent, child) => parent ? `${parent}.${child}` : child;

  function parseString() {
    if (text[index] !== '"') fail();
    index += 1;
    let value = "";
    while (index < text.length) {
      const character = text[index++];
      if (character === '"') return value;
      if (character !== "\\") {
        value += character;
        continue;
      }
      const escaped = text[index++];
      const escapeValues = { '"': '"', "\\": "\\", "/": "/", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t" };
      if (escapeValues[escaped] === undefined) fail();
      value += escapeValues[escaped];
    }
    fail();
  }

  function parseBare(pathText) {
    const start = index;
    while (index < text.length && !/[\s,\]\}]/.test(text[index])) index += 1;
    const token = text.slice(start, index);
    const match = token.match(/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?([bBsSlLdDfF])?$/);
    if (!match) fail();
    const suffix = match[1] ?? (/[.eE]/.test(token) ? "d" : "");
    numericTags.set(pathText, numericTagType(suffix));
    return Number(token.replace(/[bBsSlLdDfF]$/, ""));
  }

  function parseCompound(pathText) {
    if (text[index] !== "{") fail();
    index += 1;
    skipWhitespace();
    const value = {};
    if (text[index] === "}") {
      index += 1;
      return value;
    }
    while (true) {
      const keyMatch = text.slice(index).match(/^[A-Za-z0-9_.+-]+/);
      if (!keyMatch) fail();
      const key = keyMatch[0];
      index += key.length;
      skipWhitespace();
      if (text[index] !== ":") fail();
      index += 1;
      value[key] = parseValue(childPath(pathText, key));
      skipWhitespace();
      if (text[index] === "}") {
        index += 1;
        return value;
      }
      if (text[index] !== ",") fail();
      index += 1;
      skipWhitespace();
    }
  }

  function parseList(pathText) {
    if (text[index] !== "[") fail();
    index += 1;
    skipWhitespace();
    const value = [];
    if (text[index] === "]") {
      index += 1;
      return value;
    }
    while (true) {
      value.push(parseValue(`${pathText}[${value.length}]`));
      skipWhitespace();
      if (text[index] === "]") {
        index += 1;
        return value;
      }
      if (text[index] !== ",") fail();
      index += 1;
      skipWhitespace();
    }
  }

  function parseValue(pathText) {
    skipWhitespace();
    if (text[index] === "{") return parseCompound(pathText);
    if (text[index] === "[") return parseList(pathText);
    if (text[index] === '"') return parseString();
    return parseBare(pathText);
  }

  const value = parseValue("");
  skipWhitespace();
  if (index !== text.length) fail();
  return { value, numericTags };
}

function clearNumericTagDescendants(numericTags, storageId, pathText) {
  const normalizedPath = normalizePath(pathText);
  const prefix = `${storageId}|`;
  for (const key of numericTags.keys()) {
    if (!key.startsWith(prefix)) continue;
    const tagPath = normalizePath(key.slice(prefix.length));
    if (tagPath === normalizedPath || tagPath.startsWith(`${normalizedPath}.`)) numericTags.delete(key);
  }
}

function joinPath(basePath, relativePath) {
  return relativePath ? `${basePath}${relativePath.startsWith("[") ? "" : "."}${relativePath}` : basePath;
}

function reindexNumericTagsAfterListRemoval(numericTags, storageId, pathText) {
  const match = pathText.match(/^(.*?)(?:\[(\d+)\]|\.(\d+))$/);
  if (!match) return;
  const parentPath = match[1];
  const removedIndex = Number(match[2] ?? match[3]);
  const prefix = `${storageId}|${parentPath}`;
  for (const [key, type] of [...numericTags]) {
    if (!key.startsWith(prefix)) continue;
    const child = key.slice(prefix.length).match(/^\[(\d+)\](.*)$/);
    if (!child || Number(child[1]) <= removedIndex) continue;
    numericTags.delete(key);
    numericTags.set(`${prefix}[${Number(child[1]) - 1}]${child[2]}`, type);
  }
}

export function setTypedPath(root, numericTags, storageId, pathText, parsed) {
  clearNumericTagDescendants(numericTags, storageId, pathText);
  setPath(root, pathText, parsed.value);
  for (const [relativePath, type] of parsed.numericTags) {
    const destinationPath = joinPath(pathText, relativePath);
    numericTags.set(storageFieldKey(storageId, destinationPath), type);
  }
}

export function removeTypedPath(root, numericTags, storageId, pathText) {
  removePath(root, pathText);
  clearNumericTagDescendants(numericTags, storageId, pathText);
  reindexNumericTagsAfterListRemoval(numericTags, storageId, pathText);
}

export function copyTypedPath(root, numericTags, destinationStorageId, destinationPath, sourceStorageId, sourcePath, value) {
  const sourceTags = [...numericTags];
  clearNumericTagDescendants(numericTags, destinationStorageId, destinationPath);
  setPath(root, destinationPath, value);
  const sourcePrefix = `${sourceStorageId}|`;
  const normalizedSourcePath = normalizePath(sourcePath);
  for (const [key, type] of sourceTags) {
    if (!key.startsWith(sourcePrefix)) continue;
    const tagPath = key.slice(sourcePrefix.length);
    const normalizedTagPath = normalizePath(tagPath);
    if (normalizedTagPath !== normalizedSourcePath && !normalizedTagPath.startsWith(`${normalizedSourcePath}.`)) continue;
    const descendantPath = tagPath.slice(sourcePath.length);
    const relativePath = normalizedTagPath === normalizedSourcePath ? "" : descendantPath.replace(/^\./, "");
    const destinationTagPath = joinPath(destinationPath, relativePath);
    numericTags.set(storageFieldKey(destinationStorageId, destinationTagPath), type);
  }
}

// A focused mcfunction interpreter: it executes only the generated command subset,
// and evaluates provider expressions through the real provider evaluator.
function runWithStorage(name, publicInput, internalInput, initialPublicTags = new Map()) {
  const storage = {
    "math:": {
      ...clone(publicInput),
      internal: clone(internalInput),
    },
  };
  const numericTags = new Map(
    [...initialPublicTags].map(([pathText, type]) => [storageFieldKey("math:", pathText), type]),
  );
  let returned;
  let commandsExecuted = 0;
  const functionCalls = new Map();

  function predicateMatches(id) {
    const predicate = predicates.get(id);
    if (!predicate) throw new Error(`Unknown predicate: ${id}`);
    return inlinePredicateMatches(predicate);
  }

  function inlinePredicateMatches(predicate) {
    if (predicate.type === "minecraft:all_of") {
      return predicate.terms.every(inlinePredicateMatches);
    }
    if (predicate.type !== "minecraft:float_value_check") throw new Error(`Unsupported predicate type: ${predicate.type}`);
    const values = new Map(Object.entries(storage));
    const value = evaluateProvider(predicate.value, providers, values);
    const minimum = predicate.test?.min === undefined ? undefined : evaluateProvider(predicate.test.min, providers, values);
    const maximum = predicate.test?.max === undefined ? undefined : evaluateProvider(predicate.test.max, providers, values);
    return (minimum === undefined || value >= minimum)
      && (maximum === undefined || value <= maximum);
  }

  function computeCommandResult(value) {
    let truncated;
    if (Number.isNaN(value)) truncated = 0;
    else if (value > 2_147_483_647) truncated = 2_147_483_647;
    else if (value < -2_147_483_648) truncated = -2_147_483_648;
    else truncated = Math.trunc(value);
    if (Object.is(truncated, -0)) truncated = 0;
    return value < Math.fround(truncated) ? (truncated - 1) | 0 : truncated;
  }

  function commandProvider(value) {
    return value.startsWith("math:") ? value : JSON.parse(value);
  }

  function runCommands(functionName) {
    functionCalls.set(functionName, (functionCalls.get(functionName) ?? 0) + 1);
    for (const command of commandsFor(functionName)) {
      commandsExecuted += 1;
      const result = execute(command);
      if (result !== undefined) return result;
    }
    return undefined;
  }

  function execute(command) {
    let match = command.match(/^data remove storage (\S+) (\S+)$/);
    if (match) {
      removeTypedPath(storage[match[1]] ??= {}, numericTags, match[1], match[2]);
      return undefined;
    }
    match = command.match(/^data modify storage (\S+) (\S+) set from storage (\S+) (\S+)$/);
    if (match) {
      copyTypedPath(storage[match[1]] ??= {}, numericTags, match[1], match[2], match[3], match[4], getPath(storage[match[3]], match[4]));
      return undefined;
    }
    match = command.match(/^data modify storage (\S+) (\S+) set compute default float (\S+)$/);
    if (match) {
      setTypedPath(storage[match[1]] ??= {}, numericTags, match[1], match[2], {
        value: evaluateProvider(commandProvider(match[3]), providers, new Map(Object.entries(storage))),
        numericTags: new Map([["", "float"]]),
      });
      return undefined;
    }
    match = command.match(/^data modify storage (\S+) (\S+) set value (.+)$/);
    if (match) {
      const parsed = parseGeneratedSnbt(match[3]);
      setTypedPath(storage[match[1]] ??= {}, numericTags, match[1], match[2], parsed);
      return undefined;
    }
    match = command.match(/^execute store success storage (\S+) (\S+) byte 1 run data get storage (\S+) (\S+) 1$/);
    if (match) {
      const success = typeof getPath(storage[match[3]], match[4]) === "number";
      setTypedPath(storage[match[1]] ??= {}, numericTags, match[1], match[2], {
        value: success ? 1 : 0,
        numericTags: new Map([["", "byte"]]),
      });
      return undefined;
    }
    match = command.match(/^execute store result storage (\S+) (\S+) float (-?\d+(?:\.\d+)?) run compute default float (\S+)$/);
    if (match) {
      const value = evaluateProvider(commandProvider(match[4]), providers, new Map(Object.entries(storage)));
      const result = computeCommandResult(value);
      setTypedPath(storage[match[1]] ??= {}, numericTags, match[1], match[2], {
        value: Math.fround(result * Number(match[3])),
        numericTags: new Map([["", "float"]]),
      });
      return undefined;
    }
    match = command.match(/^execute (if|unless) predicate (\S+) run (.+)$/);
    if (match) {
      const matches = predicateMatches(match[2]);
      return (match[1] === "if" ? matches : !matches) ? execute(match[3]) : undefined;
    }
    match = command.match(/^execute (if|unless) data storage (\S+) \{internal:\{([A-Za-z0-9_]+):(-?(?:\d+(?:\.\d+)?|Infinity)|NaN)([fb])\}\} run (.+)$/);
    if (match) {
      const expected = Number(match[4]);
      const internalPath = `internal.${match[3]}`;
      const actual = getPath(storage[match[2]], internalPath);
      const expectedType = match[5] === "f" ? "float" : "byte";
      const actualType = numericTags.get(storageFieldKey(match[2], internalPath));
      const typeMatches = actualType === undefined || actualType === expectedType;
      const matches = typeMatches && ((Number.isNaN(expected) && Number.isNaN(actual))
        || Object.is(Math.fround(actual), Math.fround(expected))
        || (expected === 0 && actual === 0));
      return (match[1] === "if" ? matches : !matches) ? execute(match[6]) : undefined;
    }
    match = command.match(/^execute (if|unless) data storage (\S+) \{([A-Za-z0-9_]+):(-?(?:\d+(?:\.\d+)?|Infinity)|NaN)([fb])\} run (.+)$/);
    if (match) {
      const expected = Number(match[4]);
      const actual = getPath(storage[match[2]], match[3]);
      const expectedType = match[5] === "f" ? "float" : "byte";
      const actualType = numericTags.get(storageFieldKey(match[2], match[3]));
      const typeMatches = actualType === undefined || actualType === expectedType;
      const matches = typeMatches && ((Number.isNaN(expected) && Number.isNaN(actual))
        || Object.is(Math.fround(actual), Math.fround(expected))
        || (expected === 0 && actual === 0));
      return (match[1] === "if" ? matches : !matches) ? execute(match[6]) : undefined;
    }
    match = command.match(/^execute (if|unless) data storage (\S+) (\S+) run (.+)$/);
    if (match) {
      const matches = getPath(storage[match[2]], match[3]) !== undefined;
      return (match[1] === "if" ? matches : !matches) ? execute(match[4]) : undefined;
    }
    match = command.match(/^return run (data modify storage .+)$/);
    if (match) {
      execute(match[1]);
      return 1;
    }
    match = command.match(/^return run function (\S+)$/);
    if (match) {
      return runCommands(functionPath(match[1])) ?? 0;
    }
    match = command.match(/^function (\S+)$/);
    if (match) {
      runCommands(functionPath(match[1]));
      return undefined;
    }
    if (command === "return 1") {
      return 1;
    }
    if (command === "return fail") {
      return 0;
    }
    throw new Error(`Unsupported generated command: ${command}`);
  }

  returned = runCommands(name);
  return { storage, numericTags, returned, commandsExecuted, functionCalls };
}

export function runFunction(name, publicInput, internalInput = {}) {
  return runWithStorage(publicImplementationPath(name), publicInput, internalInput);
}

export function runFunctionFromSnbt(name, publicInputSnbt) {
  const parsed = parseGeneratedSnbt(publicInputSnbt);
  return runWithStorage(publicImplementationPath(name), parsed.value, {}, parsed.numericTags);
}

export function runImplementation(path, publicInput = {}, internalInput = {}) {
  return runWithStorage(path, publicInput, internalInput);
}

export function evaluateGeneratedProvider(id, publicInput = {}, internalInput = {}) {
  return evaluateProvider(id, providers, new Map([
    ["math:", { ...clone(publicInput), internal: clone(internalInput) }],
  ]));
}
