import test from "node:test";
import assert from "node:assert/strict";
import { runFunction } from "./mcfunction-test-harness.mjs";

function assertClose(actual, expected, tolerance = 1e-3) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} must be within ${tolerance} of ${expected}`);
}

function physicalBounceDecayReference({ t, max, bounces, decay }) {
  const u = t / max;
  const shiftedPhase = (bounces + 0.5) * u + 0.5;
  const fraction = shiftedPhase - Math.floor(shiftedPhase);
  const centered = 2 * fraction - 1;
  const airborne = 1 - centered * centered;
  return 1 - Math.exp(-decay * u) * airborne;
}

test("bounce evaluates the standard Bounce Out curve", () => {
  for (const [input, expected] of [
    [{ t: 2.5, max: 10, a: -20, b: 80 }, 27.265625],
    [{ t: 5, max: 10, a: 0, b: 100 }, 76.5625],
    [{ t: 8, max: 10, a: 90, b: -10 }, -4],
  ]) {
    const result = runFunction("bounce", { ...input, error: "stale_error" });
    assert.equal(result.returned, undefined);
    assertClose(result.storage["math:"].ans, expected);
    assert.equal(result.storage["math:"].error, "stale_error");
  }
});

test("bounce_decay accepts fractional bounce density with constant-cost damping", () => {
  for (const input of [
    { t: 5, max: 20, a: 0, b: 100, bounces: 2.5, decay: 3 },
    { t: 7, max: 24, a: -20, b: 80, bounces: 3.5, decay: 2 },
    { t: 13, max: 30, a: 90, b: -10, bounces: 4.25, decay: 5 },
  ]) {
    const result = runFunction("bounce_decay", { ...input, error: "stale_error" });
    assert.equal(result.returned, undefined);
    const eased = physicalBounceDecayReference(input);
    const expected = input.a + (input.b - input.a) * eased;
    assertClose(result.storage["math:"].ans, expected);
    assert.equal(result.storage["math:"].error, "stale_error");
  }
});

test("bounce_decay uses sharp ground contacts and smooth airborne arcs", () => {
  const parameters = { max: 100, a: 0, b: 1, bounces: 3.5, decay: 3 };
  for (const t of [1, 7, 14, 15, 22, 29, 43, 57, 71, 86, 99]) {
    const result = runFunction("bounce_decay", { ...parameters, t });
    assert.equal(result.returned, undefined);
    assertClose(result.storage["math:"].ans, physicalBounceDecayReference({ ...parameters, t }), 2e-5);
  }
});

test("bounce_decay with zero decay keeps every rebound at full height", () => {
  const expected = [0, 1, 0, 1, 0, 1, 0, 1];
  for (let t = 0; t <= 7; t += 1) {
    const result = runFunction("bounce_decay", {
      t, max: 7, a: 0, b: 1, bounces: 3, decay: 0,
    });
    assert.equal(result.returned, undefined);
    assertClose(result.storage["math:"].ans, expected[t], 2e-5);
  }
});

test("bounce functions divide positive subnormal durations without reciprocal overflow", () => {
  const t = Math.fround(2 ** -149);
  const max = Math.fround(2 * 2 ** -149);

  const bounce = runFunction("bounce", { t, max, a: 0, b: 1 });
  assert.equal(bounce.returned, undefined);
  assertClose(bounce.storage["math:"].ans, 0.765625);
  assert.equal(bounce.storage["math:"].error, undefined);

  const decay = runFunction("bounce_decay", { t, max, a: 0, b: 1, bounces: 2.5, decay: 3 });
  assert.equal(decay.returned, undefined);
  assertClose(decay.storage["math:"].ans, physicalBounceDecayReference({ t, max, bounces: 2.5, decay: 3 }));
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
      assert.equal(result.returned, undefined);
      assert.equal(result.storage["math:"].ans, expected);
      assert.equal(result.storage["math:"].error, "stale_error");
      for (const [field, value] of Object.entries(input)) {
        assert.deepEqual(result.storage["math:"][field], value, field);
      }
    }
  });

}

test("bounce_decay accepts zero decay and finite bounce densities above the guaranteed range", () => {
  const finiteLimit = Math.fround(3.4028234663852886e38);
  for (const input of [
    { t: 4, max: 10, a: 0, b: 1, bounces: 2.5, decay: 0 },
    { t: 4, max: 10, a: 0, b: 1, bounces: 1000.25, decay: 3 },
    { t: Math.fround(1 - 2 ** -24), max: 1, a: 0, b: 1, bounces: finiteLimit, decay: 3 },
  ]) {
    const result = runFunction("bounce_decay", input);
    assert.equal(result.returned, undefined);
    assert.ok(Number.isFinite(result.storage["math:"].ans));
  }
});
