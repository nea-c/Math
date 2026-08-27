import fs from "node:fs";
import path from "node:path";
import { evaluateProvider } from "../tools/math-provider-lib.mjs";

const functionRoot = path.resolve("Math/data/math/function");
const providerRoot = path.resolve("Math/data/math/number_provider");
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
const functionCommands = new Map();

function commandsFor(functionName) {
  let commands = functionCommands.get(functionName);
  if (!commands) {
    commands = fs.readFileSync(path.join(functionRoot, `${functionName}.mcfunction`), "utf8")
      .split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    functionCommands.set(functionName, commands);
  }
  return commands;
}

function getPath(root, pathText) {
  return pathText.split(".").reduce((value, segment) => value?.[segment], root);
}

function setPath(root, pathText, value) {
  const segments = pathText.split(".");
  let target = root;
  for (const segment of segments.slice(0, -1)) target = target[segment] ??= {};
  target[segments.at(-1)] = clone(value);
}

function removePath(root, pathText) {
  const segments = pathText.split(".");
  const target = segments.slice(0, -1).reduce((value, segment) => value?.[segment], root);
  if (target) delete target[segments.at(-1)];
}

export function storageFieldKey(storageId, pathText) {
  return `${storageId}|${pathText}`;
}

// A focused mcfunction interpreter: it executes only the generated command subset,
// and evaluates provider expressions through the real provider evaluator.
function runWithStorage(name, publicInput, internalInput) {
  const storage = { "math:": clone(publicInput), "math:internal": clone(internalInput) };
  const numericTags = new Map();
  let returned;

  function predicateMatches(id) {
    const predicate = predicates.get(id);
    if (!predicate) throw new Error(`Unknown predicate: ${id}`);
    return inlinePredicateMatches(predicate);
  }

  function inlinePredicateMatches(predicate) {
    if (predicate.type === "minecraft:all_of") {
      return predicate.terms.every(inlinePredicateMatches);
    }
    if (predicate.type !== "minecraft:value_check") throw new Error(`Unsupported predicate type: ${predicate.type}`);
    const asJavaInt = value => {
      if (Number.isNaN(value)) return 0;
      if (value >= 2_147_483_647) return 2_147_483_647;
      if (value <= -2_147_483_648) return -2_147_483_648;
      return Math.trunc(value);
    };
    const values = new Map(Object.entries(storage));
    const value = asJavaInt(evaluateProvider(predicate.value, providers, values));
    const minimum = predicate.range?.min === undefined ? undefined : asJavaInt(Math.fround(predicate.range.min));
    const maximum = predicate.range?.max === undefined ? undefined : asJavaInt(Math.fround(predicate.range.max));
    return (minimum === undefined || value >= minimum)
      && (maximum === undefined || value <= maximum);
  }

  function functionPath(id) {
    return id.replace(/^math:/, "");
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

  function runCommands(functionName) {
    for (const command of commandsFor(functionName)) {
      const result = execute(command);
      if (result !== undefined) return result;
    }
    return undefined;
  }

  function execute(command) {
    let match = command.match(/^data remove storage (\S+) (\S+)$/);
    if (match) {
      removePath(storage[match[1]] ??= {}, match[2]);
      numericTags.delete(storageFieldKey(match[1], match[2]));
      return undefined;
    }
    match = command.match(/^data modify storage (\S+) (\S+) set from storage (\S+) (\S+)$/);
    if (match) {
      setPath(storage[match[1]] ??= {}, match[2], getPath(storage[match[3]], match[4]));
      const sourceType = numericTags.get(storageFieldKey(match[3], match[4]));
      const targetKey = storageFieldKey(match[1], match[2]);
      if (sourceType) numericTags.set(targetKey, sourceType);
      else numericTags.delete(targetKey);
      return undefined;
    }
    match = command.match(/^data modify storage (\S+) (\S+) set compute default (\S+)$/);
    if (match) {
      setPath(storage[match[1]] ??= {}, match[2], evaluateProvider(match[3], providers, new Map(Object.entries(storage))));
      numericTags.set(storageFieldKey(match[1], match[2]), "float");
      return undefined;
    }
    match = command.match(/^data modify storage (\S+) (\S+) set value "([^"]*)"$/);
    if (match) {
      setPath(storage[match[1]] ??= {}, match[2], match[3]);
      return undefined;
    }
    match = command.match(/^data modify storage (\S+) (\S+) set value (-?\d+(?:\.\d+)?)([fFdD]?)$/);
    if (match) {
      setPath(storage[match[1]] ??= {}, match[2], Number(match[3]));
      numericTags.set(storageFieldKey(match[1], match[2]), match[4].toLowerCase() === "f" ? "float" : "double");
      return undefined;
    }
    match = command.match(/^execute store result storage (\S+) (\S+) float (-?\d+(?:\.\d+)?) run compute default (\S+)$/);
    if (match) {
      const value = evaluateProvider(match[4], providers, new Map(Object.entries(storage)));
      const result = computeCommandResult(value);
      setPath(storage[match[1]] ??= {}, match[2], Math.fround(result * Number(match[3])));
      numericTags.set(storageFieldKey(match[1], match[2]), "float");
      return undefined;
    }
    match = command.match(/^execute (if|unless) predicate (\S+) run (.+)$/);
    if (match) {
      const matches = predicateMatches(match[2]);
      return (match[1] === "if" ? matches : !matches) ? execute(match[3]) : undefined;
    }
    match = command.match(/^execute (if|unless) data storage (\S+) \{([A-Za-z0-9_]+):(-?(?:\d+(?:\.\d+)?|Infinity)|NaN)f\} run (.+)$/);
    if (match) {
      const expected = Number(match[4]);
      const actual = getPath(storage[match[2]], match[3]);
      const matches = (Number.isNaN(expected) && Number.isNaN(actual))
        || Object.is(Math.fround(actual), Math.fround(expected))
        || (expected === 0 && actual === 0);
      return (match[1] === "if" ? matches : !matches) ? execute(match[5]) : undefined;
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
  return { storage, numericTags, returned };
}

export function runFunction(name, publicInput) {
  return runWithStorage(name, publicInput, {});
}

export function runInternalFunction(name, internalInput) {
  return runWithStorage(`internal/${name}`, {}, internalInput);
}

export function evaluateGeneratedProvider(id, publicInput = {}, internalInput = {}, comparisonInput = {}) {
  return evaluateProvider(id, providers, new Map([
    ["math:", clone(publicInput)],
    ["math:internal", clone(internalInput)],
    ["math:comparison", clone(comparisonInput)],
  ]));
}
