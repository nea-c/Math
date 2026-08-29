import test from "node:test";
import assert from "node:assert/strict";
import { runFunction, runFunctionFromSnbt, storageFieldKey } from "./mcfunction-test-harness.mjs";

const radiansTolerance = Math.PI / 2 * 2 ** -20 + 2 ** -22;
const degreesTolerance = radiansTolerance * 180 / Math.PI + 2 ** -16;

function nextFloat(value) {
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setFloat32(0, Math.fround(value));
  view.setUint32(0, view.getUint32(0) + 1);
  return view.getFloat32(0);
}

function previousFloat(value) {
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setFloat32(0, Math.fround(value));
  view.setUint32(0, view.getUint32(0) - 1);
  return view.getFloat32(0);
}

// Catches a public wrapper that drops an input, stale-error cleanup, or float result.
function assertInverse(name, input, reference, tolerance) {
  const result = runFunction(name, { a: Math.fround(input), ans: 91, error: "stale_error" });
  assert.equal(result.returned, 1);
  assert.equal(result.storage["math:"].error, undefined);
  assert.equal(result.storage["math:"].a, Math.fround(input));
  assert.equal(result.numericTags.get(storageFieldKey("math:", "ans")), "float");
  assert.ok(Math.abs(result.storage["math:"].ans - reference) <= tolerance,
    `${name}(${input}) = ${result.storage["math:"].ans}, expected ${reference} +/- ${tolerance}`);
}

const implementations = [
  ["asin", Math.asin, radiansTolerance],
  ["acos", Math.acos, radiansTolerance],
  ["asin_degrees", input => Math.asin(input) * 180 / Math.PI, degreesTolerance],
  ["acos_degrees", input => Math.acos(input) * 180 / Math.PI, degreesTolerance],
];

test("inverse trigonometric functions retain public state and meet their angular accuracy bounds", () => {
  const inputs = [
    -1,
    previousFloat(-1),
    -0.5,
    -0,
    0,
    0.5,
    previousFloat(1),
    1,
  ];
  for (const [name, reference, tolerance] of implementations) {
    for (const input of inputs) assertInverse(name, input, reference(input), tolerance);
  }
  let state = 0x6d2b79f5;
  for (let index = 0; index < 10_000; index += 1) {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    const [name, reference, tolerance] = implementations[index % implementations.length];
    const input = Math.fround(state / 2 ** 31 - 1);
    assertInverse(name, input, reference(input), tolerance);
  }
});

test("inverse trigonometric endpoint constants are stored exactly", () => {
  const endpoints = [
    ["asin", -1, Math.fround(-Math.PI / 2)],
    ["asin", 0, 0],
    ["asin", 1, Math.fround(Math.PI / 2)],
    ["acos", -1, Math.fround(Math.PI)],
    ["acos", 0, Math.fround(Math.PI / 2)],
    ["acos", 1, 0],
    ["asin_degrees", -1, -90],
    ["asin_degrees", 0, 0],
    ["asin_degrees", 1, 90],
    ["acos_degrees", -1, 180],
    ["acos_degrees", 0, 90],
    ["acos_degrees", 1, 0],
  ];
  for (const [name, input, expected] of endpoints) {
    const result = runFunction(name, { a: input, ans: 91 });
    assert.equal(result.returned, 1);
    assert.equal(result.storage["math:"].ans, expected, `${name}(${input})`);
  }
});

test("inverse trigonometric endpoints accept every finite numeric NBT type", () => {
  const positiveOne = ["1b", "1s", "1", "1l", "1.0f", "1.0d"];
  const negativeOne = ["-1b", "-1s", "-1", "-1l", "-1.0f", "-1.0d"];
  for (const [name, inputs, expected] of [
    ["asin", positiveOne, Math.fround(Math.PI / 2)],
    ["asin_degrees", negativeOne, -90],
    ["acos", negativeOne, Math.fround(Math.PI)],
    ["acos_degrees", positiveOne, 0],
  ]) {
    for (const input of inputs) {
      const result = runFunctionFromSnbt(name, `{a:${input},ans:91}`);
      assert.equal(result.returned, 1, `${name}(${input})`);
      assert.equal(result.storage["math:"].ans, expected, `${name}(${input})`);
      assert.equal(result.numericTags.get(storageFieldKey("math:", "ans")), "float");
    }
  }
});

test("inverse sine preserves double negative zero while staging to binary32", () => {
  for (const name of ["asin", "asin_degrees"]) {
    const result = runFunctionFromSnbt(name, "{a:-0.0d,ans:91}");
    assert.equal(result.returned, 1);
    assert.ok(Object.is(result.storage["math:"].ans, -0), `${name}(-0.0d) must return -0`);
  }
});

test("inverse sine preserves negative zero", () => {
  for (const name of ["asin", "asin_degrees"]) {
    const result = runFunction(name, { a: -0, ans: 91 });
    assert.equal(result.returned, 1);
    assert.ok(Object.is(result.storage["math:"].ans, -0), `${name}(-0) must return -0`);
  }
});

test("inverse trigonometric functions reject binary32 inputs outside the real domain", () => {
  for (const input of [nextFloat(-1), nextFloat(1)]) {
    for (const [name] of implementations) {
      const result = runFunction(name, { a: input, ans: 91, error: "stale_error" });
      assert.equal(result.returned, 0, `${name}(${input})`);
      assert.equal(result.storage["math:"].ans, undefined);
      assert.equal(result.storage["math:"].error, "non_real_result");
    }
  }
});

test("inverse trigonometric functions reject non-finite inputs before range checks", () => {
  for (const input of [NaN, Infinity, -Infinity]) {
    for (const [name] of implementations) {
      const result = runFunction(name, { a: input, ans: 91, error: "stale_error" });
      assert.equal(result.returned, 0, `${name}(${input})`);
      assert.equal(result.storage["math:"].ans, undefined);
      assert.equal(result.storage["math:"].error, "invalid_number");
    }
  }
});
