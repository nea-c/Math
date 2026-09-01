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
    assert.equal(result.returned, undefined);
    assertClose(result.storage["math:"].ans, expected);
    assert.equal(result.storage["math:"].error, undefined);
  }
});
test("bezier clamps elapsed time to exact endpoints and preserves inputs", () => {
  for (const [t, expected] of [[-3, -20], [0, -20], [12, 80], [30, 80]]) {
    const input = { t, max: 12, a: -20, b: 80, curve: [0.17, 0.67, 0.83, 0.67] };
    const result = runFunction("bezier", { ...input, ans: 91, error: "stale_error" });
    assert.equal(result.returned, undefined);
    assert.equal(result.storage["math:"].ans, expected);
    assert.equal(result.storage["math:"].error, undefined);
    for (const [field, value] of Object.entries(input)) {
      assert.deepEqual(result.storage["math:"][field], value, field);
    }
  }
});
