import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { evaluateProvider } from "../tools/math-provider-lib.mjs";
import { runFunction, runInternalFunction, storageFieldKey } from "./mcfunction-test-harness.mjs";

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

test("rounding wrappers honor signed half boundaries and the float integer limit", () => {
  const cases = [
    [-16_777_217, [-16_777_216, -16_777_216, -16_777_216, -16_777_216]],
    [-16_777_216, [-16_777_216, -16_777_216, -16_777_216, -16_777_216]],
    [-finiteLimit, [-finiteLimit, -finiteLimit, -finiteLimit, -finiteLimit]],
    [-2.5, [-3, -2, -2, -2]],
    [-1.5, [-2, -1, -1, -1]],
    [-0.5, [-1, -0, 0, -0]],
    [-0, [0, -0, 0, 0]],
    [0.5, [0, 1, 1, 0]],
    [1.5, [1, 2, 2, 1]],
    [2.5, [2, 3, 3, 2]],
    [16_777_216, [16_777_216, 16_777_216, 16_777_216, 16_777_216]],
    [16_777_217, [16_777_216, 16_777_216, 16_777_216, 16_777_216]],
    [finiteLimit, [finiteLimit, finiteLimit, finiteLimit, finiteLimit]],
  ];
  const names = ["floor", "ceil", "round", "truncate"];

  for (const [input, expected] of cases) {
    for (const [index, name] of names.entries()) {
      const publicInput = { a: input, error: "stale_error" };
      const { storage, numericTags, returned } = runFunction(name, publicInput);
      assert.equal(returned, 1, `${name}(${input}) must return success`);
      assert.equal(storage["math:"].ans, Math.fround(expected[index]), `${name}(${input})`);
      assert.equal(storage["math:"].error, undefined, `${name}(${input}) must clear stale errors`);
      assert.equal(storage["math:"].a, input, `${name}(${input}) must preserve a`);
      assert.equal(numericTags.get(storageFieldKey("math:", "ans")), "float", `${name}(${input}) must write a float`);
      assert.ok(Object.keys(storage["math:internal"]).every((field) => ["x", "y", "z", "w"].includes(field)), `${name}(${input}) scratch keys`);
    }
  }
});

test("remainder and modulo use truncating and flooring quotients", () => {
  const cases = [
    [-5, 3, -2, 1],
    [5, -3, 2, -1],
    [-5, -3, -2, -2],
    [5, 3, 2, 2],
    [6, 3, 0, 0],
  ];

  for (const [a, b, expectedRemainder, expectedModulo] of cases) {
    for (const [name, expected] of [["remainder", expectedRemainder], ["modulo", expectedModulo]]) {
      const publicInput = { a, b, error: "stale_error" };
      const { storage, numericTags, returned } = runFunction(name, publicInput);
      assert.equal(returned, 1, `${name}(${a}, ${b}) must return success`);
      assert.equal(storage["math:"].ans, Math.fround(expected), `${name}(${a}, ${b})`);
      assert.equal(storage["math:"].error, undefined, `${name}(${a}, ${b}) must clear stale errors`);
      assert.equal(storage["math:"].a, a, `${name} must preserve a`);
      assert.equal(storage["math:"].b, b, `${name} must preserve b`);
      assert.equal(numericTags.get(storageFieldKey("math:", "ans")), "float", `${name} must write a float`);
      assert.ok(Object.keys(storage["math:internal"]).every((field) => ["x", "y", "z", "w"].includes(field)), `${name} scratch keys`);
    }
  }
});

test("remainder and modulo reject signed zero divisors", () => {
  for (const name of ["remainder", "modulo"]) {
    for (const divisor of [0, -0]) {
      const { storage, returned } = runFunction(name, { a: 5, b: divisor, ans: 91, error: "stale_error" });
      assert.equal(returned, 0, `${name}(${divisor}) must fail`);
      assert.equal(storage["math:"].ans, undefined);
      assert.equal(storage["math:"].error, "division_by_zero");
      assert.equal(storage["math:"].a, 5);
      assert.equal(storage["math:"].b, divisor);
    }
  }
});

test("period normalization reduces with a round-to-nearest quotient", () => {
  const cases = [
    [{ x: 7, y: 4 }, -1],
    [{ x: -7, y: 4 }, 1],
    [{ x: 2, y: 4 }, -2],
    [{ x: -2, y: 4 }, -2],
  ];
  for (const [internal, expected] of cases) {
    const { storage, numericTags, returned } = runInternalFunction("normalize_period", internal);
    assert.equal(returned, 1);
    assert.equal(storage["math:internal"].z, Math.fround(expected), `normalize ${internal.x} by ${internal.y}`);
    assert.equal(numericTags.get(storageFieldKey("math:internal", "z")), "float");
    assert.ok(Object.keys(storage["math:internal"]).every((field) => ["x", "y", "z", "w"].includes(field)));
  }
});
