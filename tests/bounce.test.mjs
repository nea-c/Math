import test from "node:test";
import assert from "node:assert/strict";
import { runFunction } from "./mcfunction-test-harness.mjs";

function assertClose(actual, expected, tolerance = 1e-3) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} must be within ${tolerance} of ${expected}`);
}

test("bounce evaluates the standard Bounce Out curve", () => {
  for (const [input, expected] of [
    [{ t: 2.5, max: 10, a: -20, b: 80 }, 27.265625],
    [{ t: 5, max: 10, a: 0, b: 100 }, 76.5625],
    [{ t: 8, max: 10, a: 90, b: -10 }, -4],
  ]) {
    const result = runFunction("bounce", { ...input, error: "stale_error" });
    assert.equal(result.returned, 1);
    assertClose(result.storage["math:"].ans, expected);
    assert.equal(result.storage["math:"].error, undefined);
  }
});

test("bounce_decay accepts fractional bounce density with constant-cost damping", () => {
  for (const [input, expected] of [
    [{ t: 5, max: 20, a: 0, b: 100, bounces: 2.5, decay: 3 }, 97.785782],
    [{ t: 7, max: 24, a: -20, b: 80, bounces: 3.5, decay: 2 }, 43.697844],
    [{ t: 13, max: 30, a: 90, b: -10, bounces: 4.25, decay: 5 }, -6.968752],
  ]) {
    const result = runFunction("bounce_decay", { ...input, error: "stale_error" });
    assert.equal(result.returned, 1);
    assertClose(result.storage["math:"].ans, expected);
    assert.equal(result.storage["math:"].error, undefined);
  }
});

test("bounce functions divide positive subnormal durations without reciprocal overflow", () => {
  const t = Math.fround(2 ** -149);
  const max = Math.fround(2 * 2 ** -149);

  const bounce = runFunction("bounce", { t, max, a: 0, b: 1 });
  assert.equal(bounce.returned, 1);
  assertClose(bounce.storage["math:"].ans, 0.765625);
  assert.equal(bounce.storage["math:"].error, undefined);

  const decay = runFunction("bounce_decay", { t, max, a: 0, b: 1, bounces: 2.5, decay: 3 });
  assert.equal(decay.returned, 1);
  assertClose(decay.storage["math:"].ans, 0.972109);
  assert.equal(decay.storage["math:"].error, undefined);
});

for (const [name, parameters] of [
  ["bounce", {}],
  ["bounce_decay", { bounces: 3.5, decay: 2 }],
]) {
  test(`${name} returns exact endpoints and preserves every public input`, () => {
    for (const [t, expected] of [[-3, -20], [0, -20], [12, 80], [30, 80]]) {
      const input = { t, max: 12, a: -20, b: 80, ...parameters };
      const result = runFunction(name, { ...input, ans: 91, error: "stale_error" });
      assert.equal(result.returned, 1);
      assert.equal(result.storage["math:"].ans, expected);
      assert.equal(result.storage["math:"].error, undefined);
      for (const [field, value] of Object.entries(input)) {
        assert.deepEqual(result.storage["math:"][field], value, field);
      }
    }
  });

  test(`${name} rejects non-positive durations`, () => {
    for (const max of [0, -1]) {
      const result = runFunction(name, { t: 0, max, a: 0, b: 1, ...parameters, ans: 91 });
      assert.equal(result.returned, 0);
      assert.equal(result.storage["math:"].ans, undefined);
      assert.equal(result.storage["math:"].error, "invalid_duration");
    }
  });
}

test("bounce_decay rejects non-positive bounce density and negative decay", () => {
  for (const parameters of [
    { bounces: 0, decay: 2 },
    { bounces: -1, decay: 2 },
    { bounces: 3, decay: -Math.fround(2 ** -149) },
    { bounces: 3, decay: -1 },
  ]) {
    const result = runFunction("bounce_decay", { t: 5, max: 10, a: 0, b: 1, ...parameters, ans: 91 });
    assert.equal(result.returned, 0);
    assert.equal(result.storage["math:"].ans, undefined);
    assert.equal(result.storage["math:"].error, "invalid_bounce");
  }
});

test("bounce_decay accepts zero decay and finite bounce densities above the guaranteed range", () => {
  const finiteLimit = Math.fround(3.4028234663852886e38);
  for (const input of [
    { t: 4, max: 10, a: 0, b: 1, bounces: 2.5, decay: 0 },
    { t: 4, max: 10, a: 0, b: 1, bounces: 1000.25, decay: 3 },
    { t: Math.fround(1 - 2 ** -24), max: 1, a: 0, b: 1, bounces: finiteLimit, decay: 3 },
  ]) {
    const result = runFunction("bounce_decay", input);
    assert.equal(result.returned, 1);
    assert.ok(Number.isFinite(result.storage["math:"].ans));
  }
});

test("bounce functions reject non-finite numeric inputs", () => {
  for (const [name, input] of [
    ["bounce", { t: Infinity, max: 10, a: 0, b: 1 }],
    ["bounce", { t: 5, max: 10, a: NaN, b: 1 }],
    ["bounce_decay", { t: 5, max: 10, a: 0, b: 1, bounces: Infinity, decay: 2 }],
    ["bounce_decay", { t: 5, max: 10, a: 0, b: 1, bounces: 3, decay: NaN }],
  ]) {
    const result = runFunction(name, { ...input, ans: 91, error: "stale_error" });
    assert.equal(result.returned, 0);
    assert.equal(result.storage["math:"].ans, undefined);
    assert.equal(result.storage["math:"].error, "invalid_number");
  }
});

test("bounce functions reject non-finite interpolated results", () => {
  const finiteLimit = Math.fround(3.4028234663852886e38);
  for (const [name, parameters] of [
    ["bounce", {}],
    ["bounce_decay", { bounces: 3.5, decay: 2 }],
  ]) {
    const result = runFunction(name, { t: 1, max: 10, a: -finiteLimit, b: finiteLimit, ...parameters, ans: 91 });
    assert.equal(result.returned, 0);
    assert.equal(result.storage["math:"].ans, undefined);
    assert.equal(result.storage["math:"].error, "result_out_of_range");
  }
});
