import test from "node:test";
import assert from "node:assert/strict";
import { resolvePublicFunctionTag, runFunction, storageFieldKey } from "./mcfunction-test-harness.mjs";

test("public function tags resolve exactly one implementation", () => {
  assert.equal(resolvePublicFunctionTag({ values: ["math:add"] }, "add"), "add");
  assert.throws(
    () => resolvePublicFunctionTag({ values: [] }, "add"),
    /Public function tag must contain exactly one function: math:add/,
  );
});

const wrappers = [
  ["add", { a: 1.25, b: -0.5 }, 0.75],
  ["sub", { a: 1.25, b: -0.5 }, 1.75],
  ["mul", { a: 1.25, b: -0.5 }, -0.625],
  ["abs", { a: -3.5 }, 3.5],
  ["sign", { a: -3.5 }, -1],
  ["min", { a: 1.25, b: -0.5 }, -0.5],
  ["max", { a: 1.25, b: -0.5 }, 1.25],
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
  ["div", { a: 7, b: -2 }, -3.5],
  ["sqrt", { a: 4 }, 2],
  ["log", { a: 1 }, 0],
  ["exp", { a: 0 }, 1],
  ["pow", { a: 0, b: 0 }, 1],
];

test("public functions expose ans only and clean scratch", () => {
  for (const [name, inputs, expected] of wrappers) {
    const publicInput = {
      ...inputs,
      ans: -999,
      error: "stale_error",
    };
    const { storage, returned } = runFunction(name, publicInput, { x: 999, w_stale: 1 });
    assert.equal(returned, undefined, `${name} must naturally end`);
    assert.equal(storage["math:"].ans, Math.fround(expected), `${name} ans`);
    assert.equal(storage["math:"].error, "stale_error", `${name} preserves unrelated public state`);
    assert.equal(storage["math:"].internal, undefined, `${name} scratch cleanup`);
    for (const field of ["a", "b", "min", "max", "t"]) {
      assert.deepEqual(storage["math:"][field], publicInput[field], `${name} preserves ${field}`);
    }
  }
});

test("sign writes its result as an SNBT float", () => {
  const { numericTags } = runFunction("sign", { a: -3.5 });
  assert.equal(numericTags.get(storageFieldKey("math:", "ans")), "float");
});

test("divide zero numerator uses IEEE sign xor for every finite denominator sign", () => {
  for (const [a, b, expected] of [
    [0, 2, 0],
    [0, -2, -0],
    [-0, 2, -0],
    [-0, -2, 0],
  ]) {
    const result = runFunction("div", { a, b, ans: 91, error: "stale_error" });
    assert.equal(result.returned, undefined, `divide(${Object.is(a, -0) ? "-0" : "+0"}, ${b}) must naturally end`);
    assert.ok(Object.is(result.storage["math:"].ans, expected), `divide(${Object.is(a, -0) ? "-0" : "+0"}, ${b}) sign`);
    assert.equal(result.storage["math:"].error, "stale_error");
    assert.ok(Object.is(result.storage["math:"].a, a), "public numerator must be preserved");
    assert.equal(result.storage["math:"].b, b, "public denominator must be preserved");
  }
});

test("reciprocal and divide distinguish small nonzero divisors from zero", () => {
  const reciprocal = runFunction("reciprocal", { a: Math.fround(2 ** -14), error: "stale_error" });
  assert.equal(reciprocal.returned, undefined);
  assert.equal(reciprocal.storage["math:"].ans, 16384);
  assert.equal(reciprocal.storage["math:"].error, "stale_error");

  const divide = runFunction("div", { a: 1, b: Math.fround(2 ** -14), error: "stale_error" });
  assert.equal(divide.returned, undefined);
  assert.equal(divide.storage["math:"].ans, 16384);
  assert.equal(divide.storage["math:"].error, "stale_error");
});

test("reciprocal accepts finite results at the exact binary32 overflow boundary", () => {
  const threshold = Math.fround(2 ** -128 + 2 ** -149);
  const view = new DataView(new ArrayBuffer(4));
  view.setFloat32(0, threshold);
  const bits = view.getUint32(0);
  const magnitudes = [bits - 1, bits, bits + 1].map((value) => {
    view.setUint32(0, value);
    return view.getFloat32(0);
  });

  for (const sign of [1, -1]) {
    for (const magnitude of magnitudes.slice(1)) {
      const a = Math.fround(sign * magnitude);
      const result = runFunction("reciprocal", { a, ans: 91, error: "stale_error" });
      assert.equal(result.returned, undefined, `reciprocal(${a}) must naturally end`);
      assert.ok(Number.isFinite(result.storage["math:"].ans));
      assert.equal(result.storage["math:"].error, "stale_error");
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
    const result = runFunction("div", { a, b, error: "stale_error" });
    assert.equal(result.returned, undefined, `divide(${a}, ${b}) must naturally end`);
    assert.equal(result.storage["math:"].ans, Math.fround(expected), `divide(${a}, ${b})`);
    assert.equal(result.storage["math:"].error, "stale_error");
    assert.equal(result.storage["math:"].a, a);
    assert.equal(result.storage["math:"].b, b);
  }
});

test("divide preserves signed zero on finite underflow", () => {
  const minSubnormal = Math.fround(2 ** -149);
  const finiteLimit = Math.fround(3.4028234663852886e38);

  for (const [a, b, expected] of [
    [minSubnormal, finiteLimit, 0],
    [-minSubnormal, finiteLimit, -0],
  ]) {
    const result = runFunction("div", { a, b, ans: 91, error: "stale_error" });
    assert.equal(result.returned, undefined, `divide(${a}, ${b}) underflow must naturally end`);
    assert.ok(Object.is(result.storage["math:"].ans, expected), `divide(${a}, ${b}) must preserve zero sign`);
    assert.equal(result.storage["math:"].error, "stale_error");
  }

});
