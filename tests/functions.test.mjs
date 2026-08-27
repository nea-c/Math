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
  ["log", { a: 1 }, 0],
  ["exp", { a: 0 }, 1],
  ["power", { a: 0, b: 0 }, 1],
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
    assert.deepEqual(Object.keys(storage).sort(), ["math:", "math:internal"], `${name} must use only declared storage namespaces`);
    assert.ok(Object.keys(storage["math:internal"]).every((field) => /^[xyzw](?:_|$)/.test(field)), `${name} must use x/y/z/w-prefixed scratch fields only`);
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

test("reciprocal and divide distinguish small nonzero divisors from zero", () => {
  const reciprocal = runFunction("reciprocal", { a: Math.fround(2 ** -14), error: "stale_error" });
  assert.equal(reciprocal.returned, 1);
  assert.equal(reciprocal.storage["math:"].ans, 16384);
  assert.equal(reciprocal.storage["math:"].error, undefined);

  const divide = runFunction("divide", { a: 1, b: Math.fround(2 ** -14), error: "stale_error" });
  assert.equal(divide.returned, 1);
  assert.equal(divide.storage["math:"].ans, 16384);
  assert.equal(divide.storage["math:"].error, undefined);
});

test("reciprocal rejects mathematical overflow at the exact binary32 boundary", () => {
  const threshold = Math.fround(2 ** -128 + 2 ** -149);
  const view = new DataView(new ArrayBuffer(4));
  view.setFloat32(0, threshold);
  const bits = view.getUint32(0);
  const magnitudes = [bits - 1, bits, bits + 1].map((value) => {
    view.setUint32(0, value);
    return view.getFloat32(0);
  });

  for (const sign of [1, -1]) {
    for (const [index, magnitude] of magnitudes.entries()) {
      const a = Math.fround(sign * magnitude);
      const result = runFunction("reciprocal", { a, ans: 91, error: "stale_error" });
      if (index === 0) {
        assert.equal(result.returned, 0, `reciprocal(${a}) must reject overflow`);
        assert.equal(result.storage["math:"].ans, undefined);
        assert.equal(result.storage["math:"].error, "result_out_of_range");
      } else {
        assert.equal(result.returned, 1, `reciprocal(${a}) must succeed`);
        assert.ok(Number.isFinite(result.storage["math:"].ans));
        assert.equal(result.storage["math:"].error, undefined);
      }
      assert.equal(result.storage["math:"].a, a);
    }
  }
});

test("divide coordinates subnormal operands across adjacent exponent bands", () => {
  const minSubnormal = Math.fround(2 ** -149);
  const minNormal = Math.fround(2 ** -126);
  const view = new DataView(new ArrayBuffer(4));
  view.setFloat32(0, minNormal);
  const bits = view.getUint32(0);
  const adjacent = [bits - 1, bits, bits + 1].map((value) => {
    view.setUint32(0, value);
    return view.getFloat32(0);
  });
  const cases = [
    [minSubnormal, minSubnormal, 1],
    [-minSubnormal, minSubnormal, -1],
    [minSubnormal, -minSubnormal, -1],
    ...adjacent.map((a, index) => [a, minSubnormal, 8_388_607 + index]),
  ];

  for (const [a, b, expected] of cases) {
    const result = runFunction("divide", { a, b, error: "stale_error" });
    assert.equal(result.returned, 1, `divide(${a}, ${b}) must succeed`);
    assert.equal(result.storage["math:"].ans, Math.fround(expected), `divide(${a}, ${b})`);
    assert.equal(result.storage["math:"].error, undefined);
    assert.equal(result.storage["math:"].a, a);
    assert.equal(result.storage["math:"].b, b);
  }
});

test("divide distinguishes finite underflow from overflow", () => {
  const minSubnormal = Math.fround(2 ** -149);
  const finiteLimit = Math.fround(3.4028234663852886e38);

  for (const [a, b, expected] of [
    [minSubnormal, finiteLimit, 0],
    [-minSubnormal, finiteLimit, -0],
  ]) {
    const result = runFunction("divide", { a, b, ans: 91, error: "stale_error" });
    assert.equal(result.returned, 1, `divide(${a}, ${b}) underflow must succeed`);
    assert.ok(Object.is(result.storage["math:"].ans, expected), `divide(${a}, ${b}) must preserve zero sign`);
    assert.equal(result.storage["math:"].error, undefined);
  }

  for (const [a, b] of [[finiteLimit, minSubnormal], [-finiteLimit, minSubnormal]]) {
    const result = runFunction("divide", { a, b, ans: 91, error: "stale_error" });
    assert.equal(result.returned, 0, `divide(${a}, ${b}) overflow must fail`);
    assert.equal(result.storage["math:"].ans, undefined);
    assert.equal(result.storage["math:"].error, "result_out_of_range");
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

test("log exp and power reject non-finite inputs with stale-output cleanup", () => {
  for (const [name, inputs] of [
    ["log", { a: Infinity }],
    ["exp", { a: -Infinity }],
    ["power", { a: 2, b: Infinity }],
    ["power", { a: NaN, b: 2 }],
  ]) {
    const publicInput = { ...inputs, ans: 91, error: "stale_error" };
    const result = runFunction(name, publicInput);
    assert.equal(result.returned, 0, `${name} must fail`);
    assert.equal(result.storage["math:"].ans, undefined);
    assert.equal(result.storage["math:"].error, "invalid_number");
    assert.deepEqual(result.storage["math:"].a, publicInput.a);
    assert.deepEqual(result.storage["math:"].b, publicInput.b);
  }
});
