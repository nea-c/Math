import test from "node:test";
import assert from "node:assert/strict";
import { runFunction } from "./mcfunction-test-harness.mjs";

function assertClose(actual, expected, tolerance = 5e-4) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} must be within ${tolerance} of ${expected}`);
}

function elasticReference({ t, max, a, b, amplitude, period }) {
  const u = t / max;
  const phase = period / (2 * Math.PI) * Math.asin(1 / amplitude);
  const eased = 1 + amplitude * 2 ** (-10 * u) * Math.sin((t - phase) * 2 * Math.PI / period);
  return a + (b - a) * eased;
}

function elasticDecayReference({ t, max, a, b, oscillations, damping }) {
  const u = t / max;
  const eased = 1 - Math.exp(-damping * u) * Math.cos(2 * Math.PI * oscillations * u);
  return a + (b - a) * eased;
}

test("elastic evaluates amplitude and tick-period Elastic Out curves", () => {
  for (const input of [
    { t: 5, max: 20, a: 0, b: 100, amplitude: 1, period: 6 },
    { t: 7, max: 24, a: -20, b: 80, amplitude: 1.5, period: 8 },
    { t: 13, max: 30, a: 90, b: -10, amplitude: 2, period: 12 },
  ]) {
    const result = runFunction("elastic", { ...input, error: "stale_error" });
    assert.equal(result.returned, undefined);
    assertClose(result.storage["math:"].ans, elasticReference(input));
    assert.equal(result.storage["math:"].error, "stale_error");
  }
});

test("elastic_decay evaluates oscillation and damping Elastic Out curves", () => {
  for (const input of [
    { t: 4, max: 20, a: 0, b: 100, oscillations: 3, damping: 6 },
    { t: 7, max: 24, a: -20, b: 80, oscillations: 2.5, damping: 8 },
    { t: 13, max: 30, a: 90, b: -10, oscillations: 4, damping: 5 },
  ]) {
    const result = runFunction("elastic_decay", { ...input, error: "stale_error" });
    assert.equal(result.returned, undefined);
    assertClose(result.storage["math:"].ans, elasticDecayReference(input));
    assert.equal(result.storage["math:"].error, "stale_error");
  }
});

for (const [name, parameters] of [
  ["elastic", { amplitude: 1.5, period: 8 }],
  ["elastic_decay", { oscillations: 3, damping: 6 }],
]) {
  test(`${name} clamps elapsed time to exact endpoints and preserves inputs`, () => {
    for (const [t, expected] of [[-3, -20], [0, -20], [12, 80], [30, 80]]) {
      const input = { t, max: 12, a: -20, b: 80, ...parameters };
      const result = runFunction(name, { ...input, ans: 91, error: "stale_error" });
      assert.equal(result.returned, undefined);
      assert.equal(result.storage["math:"].ans, expected);
      assert.equal(result.storage["math:"].error, "stale_error");
      for (const [field, value] of Object.entries(input)) {
        assert.deepEqual(result.storage["math:"][field], value, field);
      }
    }
  });

}
