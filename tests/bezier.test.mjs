import test from "node:test";
import assert from "node:assert/strict";
import { runFunction } from "./mcfunction-test-harness.mjs";

function assertClose(actual, expected, tolerance = 2e-4) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} must be within ${tolerance} of ${expected}`);
}

test("bezier evaluates CSS cubic-bezier timing curves", () => {
  for (const [curve, expected] of [
    [[0, 0, 1, 1], 50],
    [[0.17, 0.67, 0.83, 0.67], 62.75],
    [[0.25, 1.5, 0.75, 1.5], 125],
    [[0.25, 0.1, 0.25, 1], 80.2403387584857],
    [[0.42, 0, 1, 1], 31.535681257253945],
    [[0, 0, 0.58, 1], 68.46431874274606],
  ]) {
    const result = runFunction("bezier", { t: 5, max: 10, a: 0, b: 100, curve, error: "stale_error" });
    assert.equal(result.returned, 1);
    assertClose(result.storage["math:"].ans, expected);
    assert.equal(result.storage["math:"].error, undefined);
  }
});

test("bezier clamps elapsed time to exact endpoints and preserves inputs", () => {
  for (const [t, expected] of [[-3, -20], [0, -20], [12, 80], [30, 80]]) {
    const input = { t, max: 12, a: -20, b: 80, curve: [0.17, 0.67, 0.83, 0.67] };
    const result = runFunction("bezier", { ...input, ans: 91, error: "stale_error" });
    assert.equal(result.returned, 1);
    assert.equal(result.storage["math:"].ans, expected);
    assert.equal(result.storage["math:"].error, undefined);
    for (const [field, value] of Object.entries(input)) {
      assert.deepEqual(result.storage["math:"][field], value, field);
    }
  }
});

test("bezier rejects non-positive durations", () => {
  for (const max of [0, -1]) {
    const result = runFunction("bezier", {
      t: 0, max, a: 0, b: 1, curve: [0, 0, 1, 1], ans: 91, error: "stale_error",
    });
    assert.equal(result.returned, 0);
    assert.equal(result.storage["math:"].ans, undefined);
    assert.equal(result.storage["math:"].error, "invalid_duration");
  }
});

test("bezier rejects malformed and non-monotonic curve data", () => {
  for (const curve of [
    [0, 0, 1],
    [0, 0, 1, 1, 2],
    ["bad", "bad", "bad", "bad"],
    [-0.01, 0, 1, 1],
    [0, 0, 1.01, 1],
  ]) {
    const result = runFunction("bezier", { t: 5, max: 10, a: 0, b: 1, curve, ans: 91 });
    assert.equal(result.returned, 0, JSON.stringify(curve));
    assert.equal(result.storage["math:"].ans, undefined);
    assert.equal(result.storage["math:"].error, "invalid_curve");
  }
});

test("bezier rejects non-finite numeric inputs and curve elements", () => {
  for (const input of [
    { t: Infinity, max: 10, a: 0, b: 1, curve: [0, 0, 1, 1] },
    { t: 5, max: 10, a: 0, b: 1, curve: [0, NaN, 1, 1] },
    { t: 5, max: 10, a: 0, b: 1, curve: [0, 0, 1, Infinity] },
  ]) {
    const result = runFunction("bezier", { ...input, ans: 91, error: "stale_error" });
    assert.equal(result.returned, 0);
    assert.equal(result.storage["math:"].ans, undefined);
    assert.equal(result.storage["math:"].error, "invalid_number");
  }
});

test("bezier rejects non-finite interpolated results", () => {
  const finiteLimit = Math.fround(3.4028234663852886e38);
  const result = runFunction("bezier", {
    t: 5, max: 10, a: 0, b: finiteLimit, curve: [0.25, 1.5, 0.75, 1.5], ans: 91,
  });
  assert.equal(result.returned, 0);
  assert.equal(result.storage["math:"].ans, undefined);
  assert.equal(result.storage["math:"].error, "result_out_of_range");
});
