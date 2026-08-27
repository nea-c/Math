import test from "node:test";
import assert from "node:assert/strict";
import { runFunction, storageFieldKey } from "./mcfunction-test-harness.mjs";

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
  ["square_root", { a: 4 }, 2],
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

test("square root rejects invalid and negative inputs with stale-output cleanup", () => {
  const invalidNumber = runFunction("square_root", { a: Infinity, ans: 91, error: "stale_error" });
  assert.equal(invalidNumber.returned, 0);
  assert.equal(invalidNumber.storage["math:"].ans, undefined);
  assert.equal(invalidNumber.storage["math:"].error, "invalid_number");
  assert.equal(invalidNumber.storage["math:"].a, Infinity);

  const negative = runFunction("square_root", { a: -1, ans: 91, error: "stale_error" });
  assert.equal(negative.returned, 0);
  assert.equal(negative.storage["math:"].ans, undefined);
  assert.equal(negative.storage["math:"].error, "negative_square_root");
  assert.equal(negative.storage["math:"].a, -1);
});
