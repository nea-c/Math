import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { evaluateProvider } from "../tools/math-provider-lib.mjs";

const functionRoot = path.resolve("Math/data/math/function");
const providerRoot = path.resolve("Math/data/math/number_provider");
const finiteLimit = 3.4028234663852886e38;

function clone(value) {
  return structuredClone(value);
}

function providerRegistry() {
  const registry = new Map();
  for (const entry of fs.readdirSync(providerRoot, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const file = path.join(entry.parentPath, entry.name);
    const relative = path.relative(providerRoot, file).replaceAll("\\", "/").replace(/\.json$/, "");
    registry.set(`math:${relative}`, JSON.parse(fs.readFileSync(file, "utf8")));
  }
  return registry;
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

function storageFieldKey(storageId, pathText) {
  return `${storageId}|${pathText}`;
}

function isFiniteInput(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= -finiteLimit && value <= finiteLimit;
}

// A focused mcfunction interpreter: it executes only the generated command subset,
// and evaluates provider expressions through the real provider evaluator.
function runFunction(name, publicInput) {
  const storage = { "math:": clone(publicInput), "math:internal": {} };
  const numericTags = new Map();
  const commands = fs.readFileSync(path.join(functionRoot, `${name}.mcfunction`), "utf8")
    .split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const providers = providerRegistry();
  let returned;

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
      if (sourceType) numericTags.set(storageFieldKey(match[1], match[2]), sourceType);
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
    match = command.match(/^execute unless predicate math:internal\/finite\/(\w+) run (.+)$/);
    if (match) {
      return isFiniteInput(getPath(storage["math:"], match[1])) ? undefined : execute(match[2]);
    }
    match = command.match(/^execute if predicate math:internal\/range\/min_greater_than_max run (.+)$/);
    if (match) {
      return storage["math:"].min > storage["math:"].max ? execute(match[1]) : undefined;
    }
    match = command.match(/^execute if predicate math:internal\/range\/(negative|positive) run (.+)$/);
    if (match) {
      const value = storage["math:internal"].x;
      const condition = match[1] === "negative" ? value < 0 : value > 0;
      return condition ? execute(match[2]) : undefined;
    }
    match = command.match(/^execute if predicate math:internal\/reciprocal\/zero run (.+)$/);
    if (match) {
      return storage["math:internal"].x === 0 ? execute(match[1]) : undefined;
    }
    if (command === "return 1") {
      return 1;
    }
    if (command === "return fail") {
      return 0;
    }
    throw new Error(`Unsupported generated command: ${command}`);
  }
  for (const command of commands) {
    const result = execute(command);
    if (result !== undefined) {
      returned = result;
      break;
    }
  }
  return { storage, numericTags, returned };
}

const wrappers = [
  ["add", { a: 1.25, b: -0.5 }, 0.75],
  ["subtract", { a: 1.25, b: -0.5 }, 1.75],
  ["multiply", { a: 1.25, b: -0.5 }, -0.625],
  ["absolute", { a: -3.5 }, 3.5],
  ["sign", { a: -3.5 }, -1],
  ["minimum", { a: 1.25, b: -0.5 }, -0.5],
  ["maximum", { a: 1.25, b: -0.5 }, 1.25],
  ["clamp", { a: 4, min: -1, max: 3 }, 3],
  ["square", { a: -3.5 }, 12.25],
  ["cube", { a: -3.5 }, -42.875],
  ["rad", { a: 180 }, Math.fround(Math.PI)],
  ["deg", { a: Math.PI }, 180],
  ["pi", {}, Math.fround(Math.PI)],
  ["tau", {}, Math.fround(Math.PI * 2)],
  ["e", {}, Math.fround(Math.E)],
  ["lerp", { a: 10, b: 20, t: 0.25 }, 12.5],
  ["reciprocal", { a: -2 }, -0.5],
  ["divide", { a: 7, b: -2 }, -3.5],
];

test("public wrappers execute providers, clear stale errors, return success, and preserve public inputs", () => {
  for (const [name, inputs, expected] of wrappers) {
    const publicInput = { ...inputs, error: "stale_error" };
    const { storage, numericTags, returned } = runFunction(name, publicInput);
    assert.equal(returned, 1, `${name} must return success`);
    assert.equal(storage["math:"].ans, Math.fround(expected), `${name} must write ans`);
    assert.equal(storage["math:"].error, undefined, `${name} must clear stale errors`);
    for (const field of ["a", "b", "min", "max", "t"]) {
      assert.deepEqual(storage["math:"][field], publicInput[field], `${name} must not mutate public ${field}`);
    }
  }
});

test("public wrappers confine scratch state to x/y/z/w fields", () => {
  for (const [name, inputs] of wrappers) {
    const { storage } = runFunction(name, inputs);
    assert.ok(Object.keys(storage["math:internal"]).every((field) => ["x", "y", "z", "w"].includes(field)), `${name} must use x/y/z/w scratch fields only`);
  }
});

test("sign writes its result as an SNBT float", () => {
  const { numericTags } = runFunction("sign", { a: -3.5 });
  assert.equal(numericTags.get(storageFieldKey("math:", "ans")), "float");
});

test("public wrappers reject non-finite inputs and clamp rejects inverted bounds", () => {
  const invalidNumber = runFunction("add", { a: Infinity, b: 2, ans: 91 });
  assert.equal(invalidNumber.returned, 0);
  assert.equal(invalidNumber.storage["math:"].ans, undefined);
  assert.equal(invalidNumber.storage["math:"].error, "invalid_number");

  const invalidRange = runFunction("clamp", { a: 2, min: 4, max: 3, ans: 91 });
  assert.equal(invalidRange.returned, 0);
  assert.equal(invalidRange.storage["math:"].ans, undefined);
  assert.equal(invalidRange.storage["math:"].error, "invalid_clamp_range");
});

test("reciprocal and divide reject zero without mutating public inputs", () => {
  for (const [name, inputs] of [["reciprocal", { a: 0 }], ["divide", { a: 7, b: 0 }]]) {
    const publicInput = { ...inputs, ans: 91, error: "stale_error" };
    const { storage, returned } = runFunction(name, publicInput);
    assert.equal(returned, 0);
    assert.equal(storage["math:"].ans, undefined);
    assert.equal(storage["math:"].error, "division_by_zero");
    assert.equal(storage["math:"].a, publicInput.a);
    assert.equal(storage["math:"].b, publicInput.b);
  }
});
