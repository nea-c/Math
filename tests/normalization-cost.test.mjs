import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { runImplementation } from "./mcfunction-test-harness.mjs";

const providerRoot = path.resolve("Math/data/math/number_provider");

function adjacentPositiveFloat(value, direction) {
  const bytes = new ArrayBuffer(4);
  const view = new DataView(bytes);
  view.setFloat32(0, value);
  view.setUint32(0, view.getUint32(0) + direction);
  return view.getFloat32(0);
}

function expectedExponent(value) {
  const bytes = new ArrayBuffer(4);
  const view = new DataView(bytes);
  view.setFloat32(0, value);
  const bits = view.getUint32(0);
  const exponentBits = (bits >>> 23) & 0xff;
  if (exponentBits !== 0) return exponentBits - 127;
  const fraction = bits & 0x7fffff;
  return 31 - Math.clz32(fraction) - 149;
}

function dispatcherDepth(provider) {
  if (typeof provider === "number" || typeof provider === "string") return 0;
  assert.ok(provider && typeof provider === "object");
  if (provider.type !== "minecraft:number_dispatcher") return 0;
  return 1 + Math.max(
    ...provider.cases.map(entry => dispatcherDepth(entry.number_provider)),
    dispatcherDepth(provider.default),
  );
}

test("common binary32 normalization classifies every exponent and its adjacent magnitudes", () => {
  const commandCounts = new Set();
  for (let exponent = -149; exponent <= 127; exponent += 1) {
    const power = Math.fround(2 ** exponent);
    const inputs = [
      adjacentPositiveFloat(power, -1),
      power,
      adjacentPositiveFloat(power, 1),
    ].filter(input => input > 0 && Number.isFinite(input));

    for (const input of inputs) {
      const publicStorage = { a: 17, ans: 91, error: "stale_error" };
      const result = runImplementation(".common/normalize_binary32/0.start", publicStorage, { x: input });
      const internal = result.storage["math:internal"];
      commandCounts.add(result.commandsExecuted);
      assert.equal(result.returned, 1, `normalize(${input}) must return success`);
      assert.deepEqual(result.storage["math:"], publicStorage, `normalize(${input}) preserves public storage`);
      assert.ok(
        internal.w_normalize_mantissa >= 1 && internal.w_normalize_mantissa < 2,
        `normalize(${input}) mantissa ${internal.w_normalize_mantissa}`,
      );
      assert.equal(
        Math.fround(internal.w_normalize_mantissa * (2 ** internal.w_normalize_exponent)),
        input,
        `normalize(${input}) reconstructs the input`,
      );
      assert.equal(internal.w_normalize_exponent, expectedExponent(input), `normalize(${input}) exponent`);
      assert.equal(internal.w_normalize_scale, Math.fround(2 ** expectedExponent(input)), `normalize(${input}) scale`);
      assert.equal(
        Math.fround(Math.fround(input * internal.w_normalize_multiplier_a) * internal.w_normalize_multiplier_b),
        internal.w_normalize_mantissa,
        `normalize(${input}) uses its staged multipliers`,
      );
    }
  }
  assert.deepEqual([...commandCounts], [7], "normalization command depth is fixed across exponents");
});

test("common binary32 normalization uses balanced bounded lookups", () => {
  for (const name of ["exponent", "scale", "multiplier_a", "multiplier_b"]) {
    const file = path.join(providerRoot, "common", "normalize", "binary32", `${name}.json`);
    const provider = JSON.parse(fs.readFileSync(file, "utf8"));
    const assertFiniteConstants = (value) => {
      if (typeof value === "number") assert.ok(Number.isFinite(value), `${name} contains a non-finite constant`);
      else if (value && typeof value === "object") Object.values(value).forEach(assertFiniteConstants);
    };
    assertFiniteConstants(provider);
    assert.ok(dispatcherDepth(provider) <= 9, `${name} lookup is deeper than nine decisions`);
  }
});
