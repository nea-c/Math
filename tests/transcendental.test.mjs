import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { runFunction, storageFieldKey } from "./mcfunction-test-harness.mjs";

const finiteLimit = Math.fround(3.4028234663852886e38);
const smallestFloat = Math.fround(2 ** -149);

function floatFromBits(bits) {
  const bytes = new ArrayBuffer(4);
  const view = new DataView(bytes);
  view.setUint32(0, bits);
  return view.getFloat32(0);
}

function bitsFromFloat(value) {
  const bytes = new ArrayBuffer(4);
  const view = new DataView(bytes);
  view.setFloat32(0, Math.fround(value));
  return view.getUint32(0);
}

function previousPositiveFloat(value) {
  return floatFromBits(bitsFromFloat(value) - 1);
}

function nextPositiveFloat(value) {
  return floatFromBits(bitsFromFloat(value) + 1);
}

function assertSquareRoot(input) {
  const publicInput = { a: input, error: "stale_error" };
  const { storage, numericTags, returned } = runFunction("square_root", publicInput);
  const expected = Math.fround(Math.sqrt(input));
  const actual = storage["math:"].ans;
  const relativeError = Math.abs((actual - expected) / expected);

  assert.equal(returned, 1, `square_root(${input}) must return success`);
  assert.equal(storage["math:"].error, undefined, `square_root(${input}) must clear stale error`);
  assert.equal(storage["math:"].a, input, `square_root(${input}) must preserve a`);
  assert.equal(numericTags.get(storageFieldKey("math:", "ans")), "float", `square_root(${input}) must write a float`);
  assert.ok(Object.keys(storage["math:internal"]).every((field) => ["x", "y", "z", "w"].includes(field)), `square_root(${input}) scratch keys`);
  assert.ok(relativeError <= 0.00001, `square_root(${input}) produced ${actual}, expected ${expected}, relative error ${relativeError}`);
  return relativeError;
}

test("square root generated graph uses responsibility subdirectories", () => {
  for (const provider of [
    "square_root/00.json",
    "square_root/normalize/mantissa/00.json",
    "square_root/normalize/scale/00.json",
    "square_root/approximate/00.json",
    "square_root/newton/00/00.json",
    "square_root/newton/01/00.json",
    "square_root/newton/02/00.json",
  ]) {
    assert.ok(fs.existsSync(path.join("Math/data/math/number_provider", provider)), `missing ${provider}`);
  }
  assert.ok(fs.existsSync("Math/data/math/predicate/internal/square_root/zero.json"));
  assert.ok(fs.existsSync("Math/data/math/predicate/internal/square_root/result_finite.json"));
});

test("square root returns exact zero and rejects negative input", () => {
  for (const input of [0, -0]) {
    const { storage, numericTags, returned } = runFunction("square_root", { a: input, ans: 91, error: "stale_error" });
    assert.equal(returned, 1);
    assert.equal(storage["math:"].ans, 0);
    assert.equal(storage["math:"].error, undefined);
    assert.equal(storage["math:"].a, input);
    assert.equal(numericTags.get(storageFieldKey("math:", "ans")), "float");
  }

  const negative = runFunction("square_root", { a: -smallestFloat, ans: 91, error: "stale_error" });
  assert.equal(negative.returned, 0);
  assert.equal(negative.storage["math:"].ans, undefined);
  assert.equal(negative.storage["math:"].error, "negative_square_root");
  assert.equal(negative.storage["math:"].a, -smallestFloat);
});

test("square root handles subnormals, exponent boundaries, and hand-checked values", () => {
  const cases = new Set([
    smallestFloat,
    Math.fround(2 * smallestFloat),
    previousPositiveFloat(2 ** -126),
    Math.fround(2 ** -126),
    2,
    3,
    10,
    finiteLimit,
  ]);

  for (let exponent = -149; exponent <= 127; exponent += 1) {
    const power = Math.fround(2 ** exponent);
    if (power > 0 && Number.isFinite(power)) {
      cases.add(power);
      if (power > smallestFloat) cases.add(previousPositiveFloat(power));
      if (power < finiteLimit) cases.add(nextPositiveFloat(power));
    }
  }

  for (const input of cases) assertSquareRoot(input);
});

test("square root stays within tolerance for 10,000 deterministic positive binary32 samples", (t) => {
  let state = 0x243f6a88;
  let count = 0;
  let maximumRelativeError = 0;
  let worstInput = 0;

  while (count < 10_000) {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    const input = floatFromBits(state & 0x7fffffff);
    if (!Number.isFinite(input) || input === 0) continue;

    const relativeError = assertSquareRoot(input);
    if (relativeError > maximumRelativeError) {
      maximumRelativeError = relativeError;
      worstInput = input;
    }
    count += 1;
  }

  t.diagnostic(`maximum relative error ${maximumRelativeError} at ${worstInput}`);
  assert.ok(maximumRelativeError <= 0.00001, `maximum relative error ${maximumRelativeError} at ${worstInput}`);
});
