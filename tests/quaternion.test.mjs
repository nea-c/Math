import test from "node:test";
import assert from "node:assert/strict";
import { runFunction, runImplementation, storageFieldKey } from "./mcfunction-test-harness.mjs";

const finiteLimit = Math.fround(3.4028234663852886e38);
const smallestFloat = Math.fround(2 ** -149);
const tau = Math.fround(Math.PI * 2);
const inverseCosineInterval = Math.PI / 2 * 2 ** -20;
const reconstructionTolerance = inverseCosineInterval + 12 * 2 ** -23;

function normalizeReference(rotation) {
  const rounded = rotation.map(Math.fround);
  const maximum = Math.max(...rounded.map(Math.abs));
  const scaled = rounded.map(component => component / maximum);
  const length = Math.hypot(...scaled);
  return scaled.map(component => component / length);
}

function reconstruct({ angle, axis }) {
  const half = angle / 2;
  const sine = Math.sin(half);
  return axis.map(component => component * sine).concat(Math.cos(half));
}

function assertFloatOutput(result, label) {
  for (const path of ["ans.angle", "ans.axis[0]", "ans.axis[1]", "ans.axis[2]"]) {
    assert.equal(result.numericTags.get(storageFieldKey("math:", path)), "float", `${label} ${path}`);
  }
}

function assertQuaternion(rotation, label = JSON.stringify(rotation), { reconstructResult = true } = {}) {
  const original = structuredClone(rotation);
  const result = runFunction("quaternion_to_axis_angle", {
    rotation,
    ans: 91,
    error: "stale_error",
  });
  assert.equal(result.returned, 1, label);
  assert.equal(result.storage["math:"].error, undefined, `${label} stale error`);
  assert.deepEqual(result.storage["math:"].rotation, original, `${label} rotation`);
  assertFloatOutput(result, label);

  const { angle, axis } = result.storage["math:"].ans;
  assert.ok(Number.isFinite(angle), `${label} angle must be finite`);
  assert.ok(angle >= 0 && angle <= tau, `${label} angle ${angle} must be in [0, tau]`);
  for (const component of axis) assert.ok(Number.isFinite(component), `${label} axis must be finite`);
  assert.ok(Math.abs(Math.hypot(...axis) - 1) <= reconstructionTolerance, `${label} axis must be normalized`);

  if (reconstructResult) {
    const expected = normalizeReference(rotation);
    const actual = reconstruct(result.storage["math:"].ans);
    for (let index = 0; index < 4; index += 1) {
      assert.ok(Math.abs(actual[index] - expected[index]) <= reconstructionTolerance,
        `${label} reconstructed component ${index}: ${actual[index]} vs ${expected[index]}`);
    }
  }
  return result;
}

// Catches endpoint handling that loses quaternion sign or emits an arbitrary scalar axis.
test("scalar quaternion identities use the exact deterministic axis-angle contract", () => {
  for (const [rotation, angle] of [
    [[0, 0, 0, 1], 0],
    [[0, 0, 0, -1], tau],
  ]) {
    const result = assertQuaternion(rotation, JSON.stringify(rotation), { reconstructResult: false });
    assert.deepEqual(result.storage["math:"].ans, { angle, axis: [0, 1, 0] });
  }
});

// Catches wrong half-angle composition, non-normalized axes, and shortest-path canonicalization.
test("representative and scaled rotations reconstruct the sign-preserved normalized quaternion", () => {
  const sine45 = Math.fround(Math.SQRT1_2);
  for (const rotation of [
    [0, sine45, 0, sine45],
    [1, 0, 0, 0],
    [0, sine45, 0, -sine45],
    [0, Math.fround(5 * Math.SQRT1_2), 0, Math.fround(5 * Math.SQRT1_2)],
    [Math.fround(0.25), Math.fround(-0.5), Math.fround(0.75), Math.fround(-1)],
  ]) assertQuaternion(rotation);
});

// Catches accidental q/-q canonicalization: both signed representatives must survive conversion.
test("paired quaternions retain complementary sign-preserving representations", () => {
  const rotation = [Math.fround(0.25), Math.fround(-0.5), Math.fround(0.75), Math.fround(1)];
  const positive = assertQuaternion(rotation, "q").storage["math:"].ans;
  const negative = assertQuaternion(rotation.map(component => Math.fround(-component)), "-q").storage["math:"].ans;
  assert.ok(Math.abs(positive.angle + negative.angle - tau) <= reconstructionTolerance);
  for (let index = 0; index < 3; index += 1) {
    assert.ok(Math.abs(positive.axis[index] + negative.axis[index]) <= reconstructionTolerance);
  }
});

// Catches direct square summation, unsafe reciprocal scaling, and vector underflow failures.
test("four-dimensional and vector normalization stay safe across the binary32 range", () => {
  for (const [rotation, reconstructResult, expectedAxis] of [
    [[finiteLimit, finiteLimit, 0, finiteLimit], true],
    [[smallestFloat, smallestFloat, 0, smallestFloat], true],
    [[smallestFloat, 0, 0, finiteLimit], false, [1, 0, 0]],
  ]) {
    const result = assertQuaternion(rotation, JSON.stringify(rotation), { reconstructResult });
    const squareSum = result.storage["math:internal"].w_quaternion_scaled_square_sum;
    assert.ok(squareSum >= 1 && squareSum <= 4, `scaled square sum ${squareSum} must stay in [1, 4]`);
    if (expectedAxis) assert.deepEqual(result.storage["math:"].ans.axis, expectedAxis);
  }
});

function assertInvalid(rotation, label, ans) {
  const publicInput = { ans, error: "stale_error" };
  if (rotation !== undefined) publicInput.rotation = rotation;
  const original = structuredClone(rotation);
  const result = runFunction("quaternion_to_axis_angle", publicInput);
  assert.equal(result.returned, 0, label);
  assert.equal(result.storage["math:"].ans, undefined, `${label} stale ans`);
  assert.equal(result.storage["math:"].error, "invalid_quaternion", `${label} error`);
  if (rotation !== undefined) assert.deepEqual(result.storage["math:"].rotation, original, `${label} rotation`);
}

// Catches missing exact-length and numeric-element validation.
test("malformed quaternion lists fail with the dedicated cleanup contract", () => {
  const cases = [
    [undefined, "absent rotation"],
    [[], "empty rotation"],
    [[0, 0, 0], "length three"],
    [[0, 0, 0, 1, 0], "length five"],
    [["0", "0", "0", "1"], "string list"],
    [[false, false, false, true], "boolean list"],
    [[{}, {}, {}, {}], "compound list"],
    [[[], [], [], []], "nested list"],
  ];
  cases.forEach(([rotation, label], index) => assertInvalid(
    rotation,
    label,
    index % 2 ? { angle: 3, axis: [1, 0, 0] } : 91,
  ));
});

// Catches validation that checks only some components or allows NaN/infinity through float conversion.
test("every non-finite component position fails with invalid_quaternion", () => {
  for (const nonfinite of [NaN, Infinity, -Infinity]) {
    for (let index = 0; index < 4; index += 1) {
      const rotation = [1, 1, 1, 1];
      rotation[index] = nonfinite;
      assertInvalid(rotation, `${nonfinite} at ${index}`, index % 2 ? 91 : { angle: 3, axis: [1, 0, 0] });
    }
  }
});

// Catches a zero test that depends on sign or one particular numeric representation.
test("all signed-zero quaternion forms fail with invalid_quaternion", () => {
  const cases = [[0, -0, 0, -0]];
  for (let index = 0; index < 4; index += 1) {
    const negativeAtIndex = [0, 0, 0, 0];
    negativeAtIndex[index] = -0;
    cases.push(negativeAtIndex);
    const positiveAtIndex = [-0, -0, -0, -0];
    positiveAtIndex[index] = 0;
    cases.push(positiveAtIndex);
  }
  cases.forEach((rotation, index) => assertInvalid(rotation, `signed zero ${index}`, index % 2 ? 91 : { angle: 3, axis: [1, 0, 0] }));
});

test("non-finite defensive output failures use result_out_of_range", () => {
  const result = runImplementation("quaternion_to_axis_angle/3.finish", {
    ans: 91,
    error: "stale_error",
  }, {
    w_quaternion_angle: Infinity,
    w_quaternion_axis_0: 0,
    w_quaternion_axis_1: 1,
    w_quaternion_axis_2: 0,
  });
  assert.equal(result.returned, 0);
  assert.equal(result.storage["math:"].ans, undefined);
  assert.equal(result.storage["math:"].error, "result_out_of_range");
});
