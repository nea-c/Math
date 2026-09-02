import test from "node:test";
import assert from "node:assert/strict";
import { runFunction, runFunctionFromSnbt, storageFieldKey } from "./mcfunction-test-harness.mjs";

const radiansTolerance = 0.000002;
const degreesTolerance = 0.00012;

function adjacentPositiveFloat(value, direction) {
  const bits = new ArrayBuffer(4);
  const view = new DataView(bits);
  view.setFloat32(0, Math.fround(value));
  view.setUint32(0, view.getUint32(0) + direction);
  return view.getFloat32(0);
}

function assertSuccess(name, input, expected, tolerance) {
  const result = runFunction(name, { ...input, ans: 91, error: "stale_error" });
  assert.equal(result.returned, undefined, `${name}(${JSON.stringify(input)})`);
  assert.equal(result.storage["math:"].error, "stale_error");
  assert.equal(result.numericTags.get(storageFieldKey("math:", "ans")), "float");
  assert.ok(Math.abs(result.storage["math:"].ans - expected) <= tolerance,
    `${name}(${JSON.stringify(input)}) = ${result.storage["math:"].ans}, expected ${expected} +/- ${tolerance}`);
  for (const [field, value] of Object.entries(input)) {
    assert.deepEqual(result.storage["math:"][field], value, `${name} must preserve ${field}`);
  }
}

test("atan returns principal angles in radians and degrees", () => {
  for (const [input, radians, degrees] of [
    [0, 0, 0],
    [0.41421357, 0.3926991, 22.5],
    [1, 0.7853982, 45],
    [3, 1.2490457, 71.56505],
    [-1, -0.7853982, -45],
    [-1000, -1.5697963, -89.9427],
  ]) {
    assertSuccess("atan", { a: input }, radians, radiansTolerance);
    assertSuccess("atan_deg", { a: input }, degrees, degreesTolerance);
  }
});

test("atan2 returns the correct quadrant and exact origin convention", () => {
  for (const [a, b, radians, degrees] of [
    [0, 0, 0, 0],
    [1, 0, 1.5707964, 90],
    [-1, 0, -1.5707964, -90],
    [0, -1, 3.1415927, 180],
    [1, 1, 0.7853982, 45],
    [1, -1, 2.3561945, 135],
    [-1, -1, -2.3561945, -135],
    [-1, 1, -0.7853982, -45],
    [-1e-12, -1, -3.1415927, -180],
  ]) {
    assertSuccess("atan2", { a, b }, radians, radiansTolerance);
    assertSuccess("atan2_deg", { a, b }, degrees, degreesTolerance);
  }
});

test("atan functions accept every numeric NBT type and return floats", () => {
  for (const [name, snbt, expected] of [
    ["atan", "{a:1b}", Math.fround(Math.PI / 4)],
    ["atan_deg", "{a:1.0d}", 45],
    ["atan2", "{a:1s,b:-1l}", Math.fround(3 * Math.PI / 4)],
    ["atan2_deg", "{a:-1.0d,b:-1b}", -135],
    ["atan2", "{a:0.0d,b:0}", 0],
  ]) {
    const result = runFunctionFromSnbt(name, snbt);
    assert.equal(result.returned, undefined, `${name} ${snbt}`);
    assert.equal(result.storage["math:"].ans, expected, `${name} ${snbt}`);
    assert.equal(result.numericTags.get(storageFieldKey("math:", "ans")), "float");
  }
});

test("atan meets its accuracy guarantees on boundary and deterministic binary32 samples", () => {
  const finiteLimit = Math.fround(3.4028234663852886e38);
  const smallest = Math.fround(2 ** -149);
  const transformBoundary = Math.fround(Math.SQRT2 - 1);
  const adjacentBoundaries = [
    adjacentPositiveFloat(transformBoundary, -1), transformBoundary, adjacentPositiveFloat(transformBoundary, 1),
    adjacentPositiveFloat(1, -1), 1, adjacentPositiveFloat(1, 1),
  ];
  const samples = [
    -finiteLimit, ...adjacentBoundaries.map((value) => -value), -smallest,
    0,
    smallest, ...adjacentBoundaries, finiteLimit,
  ];
  let state = 0x51f15e5d;
  const bits = new ArrayBuffer(4);
  const view = new DataView(bits);
  for (let index = 0; index < 5_000; index += 1) {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    view.setUint32(0, state);
    const value = view.getFloat32(0);
    if (Number.isFinite(value)) samples.push(value);
  }

  let maximumRadiansError = 0;
  let maximumDegreesError = 0;
  for (const a of samples) {
    const radians = runFunction("atan", { a }).storage["math:"].ans;
    const degrees = runFunction("atan_deg", { a }).storage["math:"].ans;
    maximumRadiansError = Math.max(maximumRadiansError, Math.abs(radians - Math.atan(a)));
    maximumDegreesError = Math.max(maximumDegreesError, Math.abs(degrees - Math.atan(a) * 180 / Math.PI));
  }
  assert.ok(maximumRadiansError <= radiansTolerance, `maximum radians error ${maximumRadiansError}`);
  assert.ok(maximumDegreesError <= degreesTolerance, `maximum degrees error ${maximumDegreesError}`);
  console.log(`${samples.length} atan samples; maximum radians error ${maximumRadiansError}; maximum degrees error ${maximumDegreesError}`);
});

test("atan2 meets its accuracy guarantees across scales and quadrants", () => {
  const finiteLimit = Math.fround(3.4028234663852886e38);
  const smallest = Math.fround(2 ** -149);
  const transformBoundary = Math.fround(Math.SQRT2 - 1);
  const values = [
    0, smallest, Math.fround(2 ** -126 - 2 ** -149), Math.fround(2 ** -126), 1e-12,
    adjacentPositiveFloat(transformBoundary, -1), transformBoundary, adjacentPositiveFloat(transformBoundary, 1),
    adjacentPositiveFloat(1, -1), 1, adjacentPositiveFloat(1, 1), finiteLimit,
  ];
  const samples = [];
  for (const magnitudeA of values) {
    for (const magnitudeB of values) {
      for (const signA of [-1, 1]) {
        for (const signB of [-1, 1]) samples.push([
          magnitudeA === 0 ? 0 : Math.fround(signA * magnitudeA),
          magnitudeB === 0 ? 0 : Math.fround(signB * magnitudeB),
        ]);
      }
    }
  }
  let state = 0xa72c93ef;
  const bits = new ArrayBuffer(4);
  const view = new DataView(bits);
  for (let index = 0; index < 5_000; index += 1) {
    state = (Math.imul(state, 22_695_477) + 1) >>> 0;
    view.setUint32(0, state);
    const rawA = view.getFloat32(0);
    state = (Math.imul(state, 22_695_477) + 1) >>> 0;
    view.setUint32(0, state);
    const rawB = view.getFloat32(0);
    const a = rawA === 0 ? 0 : rawA;
    const b = rawB === 0 ? 0 : rawB;
    if (Number.isFinite(a) && Number.isFinite(b)) samples.push([a, b]);
  }

  let maximumRadiansError = 0;
  let maximumDegreesError = 0;
  for (const [a, b] of samples) {
    const reference = a === 0 && b === 0 ? 0 : Math.atan2(a, b);
    const radians = runFunction("atan2", { a, b }).storage["math:"].ans;
    const degrees = runFunction("atan2_deg", { a, b }).storage["math:"].ans;
    maximumRadiansError = Math.max(maximumRadiansError, Math.abs(radians - reference));
    maximumDegreesError = Math.max(maximumDegreesError, Math.abs(degrees - reference * 180 / Math.PI));
  }
  assert.ok(maximumRadiansError <= radiansTolerance, `maximum radians error ${maximumRadiansError}`);
  assert.ok(maximumDegreesError <= degreesTolerance, `maximum degrees error ${maximumDegreesError}`);
  console.log(`${samples.length} atan2 samples; maximum radians error ${maximumRadiansError}; maximum degrees error ${maximumDegreesError}`);
});
