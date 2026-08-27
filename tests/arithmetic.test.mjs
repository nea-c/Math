import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { evaluateProvider } from "../tools/math-provider-lib.mjs";

const providerRoot = path.resolve("Math/data/math/number_provider");
const finiteLimit = Math.fround(3.4028234663852886e38);
const smallestFiniteReciprocalInput = Math.fround(2 ** -128 + 2 ** -149);

function providerRegistry() {
  const registry = new Map();
  for (const entry of fs.readdirSync(providerRoot, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const file = path.join(entry.parentPath, entry.name);
    const relative = path.relative(providerRoot, file).replaceAll("\\", "/").replace(/\.json$/, "");
    registry.set(`math:${relative}`, JSON.parse(fs.readFileSync(file, "utf8")));
  }
  return registry;
}

function run(id, internal) {
  return evaluateProvider(id, providers, new Map([["math:internal", internal]]));
}

const providers = providerRegistry();

test("common exact providers evaluate hand-checked arithmetic and conversions", () => {
  const cases = [
    ["math:common/arithmetic/add", { x: 1.25, y: -0.5 }, 0.75],
    ["math:common/arithmetic/subtract", { x: 1.25, y: -0.5 }, 1.75],
    ["math:common/arithmetic/multiply", { x: 1.25, y: -0.5 }, -0.625],
    ["math:common/comparison/absolute", { x: -3.5 }, 3.5],
    ["math:common/conversion/rad", { x: 180 }, Math.fround(Math.PI)],
    ["math:common/conversion/deg", { x: Math.PI }, 180],
  ];
  for (const [id, internal, expected] of cases) {
    assert.equal(run(id, internal), Math.fround(expected));
  }
});

test("power-of-two normalization covers the reciprocal exponent range", () => {
  const cases = [
    [smallestFiniteReciprocalInput, 2 ** 127, -128, 0.5, 1],
    [Math.fround(2 ** -127), 2 ** 127, -127, 1, 2],
    [0.75, 2, -1, 1, 2],
    [1, 1, 0, 1, 2],
    [finiteLimit, 2 ** -127, 127, 1, 2],
  ];

  for (const [input, expectedScale, expectedExponent, minimumMantissa, maximumMantissa] of cases) {
    const scale = run("math:common/normalize/power_of_two/scale", { x: input });
    const exponent = run("math:common/normalize/power_of_two/exponent", { x: input });
    const mantissa = Math.fround(Math.abs(input) * scale);
    assert.equal(scale, Math.fround(expectedScale), `scale for ${input}`);
    assert.equal(exponent, Math.fround(expectedExponent), `exponent for ${input}`);
    assert.ok(mantissa >= minimumMantissa && mantissa < maximumMantissa, `mantissa ${mantissa} for ${input}`);
  }
});

test("common reciprocal supports signed values across the finite float range", () => {
  const cases = [
    1,
    -1,
    2,
    -2,
    1.5,
    0.1,
    -0.1,
    1e-20,
    -1e-20,
    finiteLimit,
    smallestFiniteReciprocalInput,
    Math.fround(2 ** -127 - 2 ** -149),
    Math.fround(2 ** -127),
  ].map(Math.fround);

  for (const input of cases) {
    const expected = Math.fround(1 / input);
    const actual = run("math:common/reciprocal/00", { x: input });
    const relativeError = Math.abs((actual - expected) / expected);
    assert.ok(relativeError <= 0.00001, `reciprocal(${input}) produced ${actual}, expected ${expected}, relative error ${relativeError}`);
  }
});

test("common reciprocal stays within tolerance for 20,000 deterministic finite floats", (t) => {
  const bytes = new ArrayBuffer(4);
  const view = new DataView(bytes);
  let state = 0x6d2b79f5;
  let count = 0;
  let maximumRelativeError = 0;
  let worstInput = 0;

  while (count < 20_000) {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    view.setUint32(0, state);
    const input = view.getFloat32(0);
    if (!Number.isFinite(input) || input === 0 || Math.abs(input) < smallestFiniteReciprocalInput) continue;

    const expected = Math.fround(1 / input);
    const actual = run("math:common/reciprocal/00", { x: input });
    const relativeError = Math.abs((actual - expected) / expected);
    if (relativeError > maximumRelativeError) {
      maximumRelativeError = relativeError;
      worstInput = input;
    }
    count += 1;
  }

  t.diagnostic(`maximum relative error ${maximumRelativeError} at ${worstInput}`);
  assert.ok(maximumRelativeError <= 0.00001, `maximum relative error ${maximumRelativeError} at ${worstInput}`);
});
