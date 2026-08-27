import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { evaluateProvider } from "../tools/math-provider-lib.mjs";
import { runFunction, runInternalFunction, storageFieldKey } from "./mcfunction-test-harness.mjs";

const providerRoot = path.resolve("Math/data/math/number_provider");
const finiteLimit = Math.fround(3.4028234663852886e38);
const smallestFloat = Math.fround(2 ** -149);
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

function runStagedReciprocal(input) {
  const result = runInternalFunction("reciprocal_x", { x: input, y: 1 });
  assert.equal(result.returned, 1, `reciprocal_x(${input}) must return success`);
  return result.storage["math:internal"].x;
}

function floatFromBits(bits) {
  const bytes = new ArrayBuffer(4);
  const view = new DataView(bytes);
  view.setUint32(0, bits >>> 0);
  return view.getFloat32(0);
}

function floatMagnitudeParts(value) {
  const bytes = new ArrayBuffer(4);
  const view = new DataView(bytes);
  view.setFloat32(0, Math.abs(value));
  const bits = view.getUint32(0);
  const exponentBits = (bits >>> 23) & 0xff;
  const fraction = bits & 0x7fffff;
  return exponentBits === 0
    ? { significand: BigInt(fraction), exponent: -149 }
    : { significand: BigInt(0x800000 | fraction), exponent: exponentBits - 150 };
}

function exactRemainderMagnitude(a, b) {
  if (a === 0) return 0;
  const left = floatMagnitudeParts(a);
  const right = floatMagnitudeParts(b);
  const commonExponent = Math.min(left.exponent, right.exponent);
  const numerator = left.significand << BigInt(left.exponent - commonExponent);
  const denominator = right.significand << BigInt(right.exponent - commonExponent);
  return Math.fround(Number(numerator % denominator) * (2 ** commonExponent));
}

function exactRemainderReference(a, b) {
  const magnitude = exactRemainderMagnitude(a, b);
  return magnitude === 0 ? 0 : Math.fround(Math.sign(a) * magnitude);
}

function exactModuloReference(a, b) {
  const magnitude = exactRemainderMagnitude(a, b);
  if (magnitude === 0) return 0;
  if (Math.sign(a) === Math.sign(b)) return Math.fround(Math.sign(b) * magnitude);
  return Math.fround(Math.sign(b) * (Math.abs(b) - magnitude));
}

function exactCenteredRemainderReference(value, period) {
  const magnitude = exactRemainderMagnitude(value, period);
  const halfPeriod = Math.fround(period * 0.5);
  if (value < 0) {
    return magnitude > halfPeriod
      ? Math.fround(period - magnitude)
      : Math.fround(-magnitude);
  }
  return magnitude >= halfPeriod
    ? Math.fround(magnitude - period)
    : magnitude;
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

test("staged reciprocal normalization covers the binary32 exponent range", () => {
  const cases = [
    smallestFiniteReciprocalInput,
    Math.fround(2 ** -127),
    0.75,
    1,
    finiteLimit,
  ];

  for (const input of cases) {
    const expected = Math.fround(1 / input);
    const actual = runStagedReciprocal(input);
    const relativeError = Math.abs((actual - expected) / expected);
    assert.ok(relativeError <= 0.00001, `reciprocal(${input}) produced ${actual}, expected ${expected}`);
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
    const actual = runStagedReciprocal(input);
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
    if (!Number.isFinite(input) || input === 0) continue;

    const expected = Math.fround(1 / input);
    const result = runFunction("reciprocal", { a: input, ans: 91, error: "stale_error" });
    if (!Number.isFinite(expected)) {
      assert.equal(result.returned, 0, `reciprocal(${input}) overflow must fail`);
      assert.equal(result.storage["math:"].ans, undefined);
      assert.equal(result.storage["math:"].error, "result_out_of_range");
    } else {
      assert.equal(result.returned, 1, `reciprocal(${input}) must succeed`);
      const actual = result.storage["math:"].ans;
      const relativeError = Math.abs((actual - expected) / expected);
      if (relativeError > maximumRelativeError) {
        maximumRelativeError = relativeError;
        worstInput = input;
      }
    }
    count += 1;
  }

  t.diagnostic(`maximum relative error ${maximumRelativeError} at ${worstInput}`);
  assert.ok(maximumRelativeError <= 0.00001, `maximum relative error ${maximumRelativeError} at ${worstInput}`);
});

test("coordinated division preserves precision across deterministic binary32 operands", (t) => {
  const bytes = new ArrayBuffer(4);
  const view = new DataView(bytes);
  let state = 0x243f6a88;
  let count = 0;
  let maximumNormalRelativeError = 0;
  let worstNormalCase = "";
  let maximumSubnormalUlpError = 0;
  let worstSubnormalCase = "";

  while (count < 512) {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    view.setUint32(0, state);
    const a = view.getFloat32(0);
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    view.setUint32(0, state);
    const b = view.getFloat32(0);
    if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) continue;

    const expected = Math.fround(a / b);
    const result = runFunction("divide", { a, b, ans: 91, error: "stale_error" });
    if (!Number.isFinite(expected)) {
      assert.equal(result.returned, 0, `divide(${a}, ${b}) overflow must fail`);
      assert.equal(result.storage["math:"].ans, undefined);
      assert.equal(result.storage["math:"].error, "result_out_of_range");
    } else {
      assert.equal(result.returned, 1, `divide(${a}, ${b}) must succeed`);
      const actual = result.storage["math:"].ans;
      if (expected === 0) {
        assert.ok(Object.is(actual, expected), `divide(${a}, ${b}) zero sign`);
      } else {
        const allowedError = Math.max(Math.abs(expected) * 0.00001, smallestFloat);
        const scaledError = Math.abs(actual - expected) / allowedError;
        if (Math.abs(expected) >= Math.fround(2 ** -126)) {
          const relativeError = Math.abs((actual - expected) / expected);
          if (relativeError > maximumNormalRelativeError) {
            maximumNormalRelativeError = relativeError;
            worstNormalCase = `${a} / ${b}: ${actual} versus ${expected}`;
          }
        } else {
          const ulpError = Math.abs(actual - expected) / smallestFloat;
          if (ulpError > maximumSubnormalUlpError) {
            maximumSubnormalUlpError = ulpError;
            worstSubnormalCase = `${a} / ${b}: ${actual} versus ${expected}`;
          }
        }
        assert.ok(scaledError <= 1, `divide(${a}, ${b}) produced ${actual}, expected ${expected}`);
      }
      assert.equal(result.storage["math:"].error, undefined);
    }
    count += 1;
  }

  t.diagnostic(`maximum normal relative division error ${maximumNormalRelativeError} at ${worstNormalCase}`);
  t.diagnostic(`maximum subnormal division error ${maximumSubnormalUlpError} min-subnormal ULP at ${worstSubnormalCase}`);
});

test("divide classifies top-exponent rounding overflow without using its approximate answer", () => {
  const numerators = [0x7f7ffffd, 0x7f7ffffe, 0x7f7fffff].map(floatFromBits);
  const divisors = [0x3f7fffff, 0x3f800000, 0x3f800001, 0x3f800002].map(floatFromBits);
  let finiteCases = 0;
  let overflowCases = 0;

  for (const numerator of numerators) {
    for (const divisor of divisors) {
      for (const numeratorSign of [1, -1]) {
        for (const divisorSign of [1, -1]) {
          const a = Math.fround(numeratorSign * numerator);
          const b = Math.fround(divisorSign * divisor);
          const expected = Math.fround(a / b);
          const result = runFunction("divide", { a, b, ans: 91, error: "stale_error" });
          if (!Number.isFinite(expected)) {
            overflowCases += 1;
            assert.equal(result.returned, 0, `divide(${a}, ${b}) overflow must fail`);
            assert.equal(result.storage["math:"].ans, undefined);
            assert.equal(result.storage["math:"].error, "result_out_of_range");
          } else {
            finiteCases += 1;
            assert.equal(result.returned, 1, `divide(${a}, ${b}) must succeed`);
            assert.ok(Number.isFinite(result.storage["math:"].ans));
            assert.ok(Math.abs((result.storage["math:"].ans - expected) / expected) <= 0.00001);
            assert.equal(result.storage["math:"].error, undefined);
          }
          assert.equal(result.storage["math:"].a, a);
          assert.equal(result.storage["math:"].b, b);
        }
      }
    }
  }

  assert.ok(finiteCases > 0, "grid must include adjacent finite quotients");
  assert.ok(overflowCases > 0, "grid must include adjacent overflowing quotients");
});

test("divide stays within one min-subnormal ULP on a 12,288-case boundary grid", (t) => {
  const numerators = [0x007fffff, 0x00800000, 0x00800001].map(floatFromBits);
  const denominatorBits = [];
  const seen = new Set();
  for (let index = 0; denominatorBits.length < 4096; index += 1) {
    const mantissa = (0x5805 + Math.imul(index, 0x1f123b)) & 0x7fffff;
    const bits = 0x3f800000 | mantissa;
    if (seen.has(bits)) continue;
    seen.add(bits);
    denominatorBits.push(bits);
  }

  let cases = 0;
  let overOneUlp = 0;
  let maximumUlpError = 0;
  let worstCase = "";
  for (const a of numerators) {
    for (const bits of denominatorBits) {
      const b = floatFromBits(bits);
      const expected = Math.fround(a / b);
      const result = runFunction("divide", { a, b });
      assert.equal(result.returned, 1, `divide(${a}, ${b}) must succeed`);
      const actual = result.storage["math:"].ans;
      const ulpError = Math.abs(actual - expected) / smallestFloat;
      if (ulpError > 1) overOneUlp += 1;
      if (ulpError > maximumUlpError) {
        maximumUlpError = ulpError;
        worstCase = `0x${bits.toString(16)}: ${actual} versus ${expected}`;
      }
      cases += 1;
    }
  }

  assert.equal(cases, 12_288);
  t.diagnostic(`${overOneUlp} cases exceeded one ULP; maximum ${maximumUlpError} at ${worstCase}`);
  assert.ok(maximumUlpError <= 1, `${overOneUlp} grid cases exceeded one min-subnormal ULP; maximum ${maximumUlpError} at ${worstCase}`);
});

test("rounding wrappers honor signed half boundaries and the float integer limit", () => {
  const cases = [
    [-16_777_217, [-16_777_216, -16_777_216, -16_777_216, -16_777_216]],
    [-16_777_216, [-16_777_216, -16_777_216, -16_777_216, -16_777_216]],
    [-16_777_215, [-16_777_215, -16_777_215, -16_777_215, -16_777_215]],
    [-8_388_609, [-8_388_609, -8_388_609, -8_388_609, -8_388_609]],
    [-8_388_608, [-8_388_608, -8_388_608, -8_388_608, -8_388_608]],
    [-finiteLimit, [-finiteLimit, -finiteLimit, -finiteLimit, -finiteLimit]],
    [-2.5, [-3, -2, -2, -2]],
    [-1.5, [-2, -1, -1, -1]],
    [-0.5, [-1, -0, 0, -0]],
    [-0, [0, -0, 0, 0]],
    [0.5, [0, 1, 1, 0]],
    [1.5, [1, 2, 2, 1]],
    [2.5, [2, 3, 3, 2]],
    [8_388_608, [8_388_608, 8_388_608, 8_388_608, 8_388_608]],
    [8_388_609, [8_388_609, 8_388_609, 8_388_609, 8_388_609]],
    [16_777_215, [16_777_215, 16_777_215, 16_777_215, 16_777_215]],
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
      assert.ok(Object.keys(storage["math:internal"]).every((field) => /^[xyzw](?:_|$)/.test(field)), `${name}(${input}) scratch keys`);
    }
  }
});

test("remainder and modulo use truncating and flooring quotients", () => {
  const pointThree = Math.fround(0.3);
  const threeSmallestFloats = Math.fround(3 * smallestFloat);
  const cases = [
    [pointThree, pointThree, 0, 0],
    [-5, 3, -2, 1],
    [5, -3, 2, -1],
    [-5, -3, -2, -2],
    [5, 3, 2, 2],
    [6, 3, 0, 0],
    [smallestFloat, finiteLimit, smallestFloat, smallestFloat],
    [1, smallestFloat, 0, 0],
    [1, threeSmallestFloats, 2 * smallestFloat, 2 * smallestFloat],
    [-1, threeSmallestFloats, -2 * smallestFloat, smallestFloat],
    [1, -threeSmallestFloats, 2 * smallestFloat, -smallestFloat],
    [finiteLimit, 11, 9, 9],
    [-finiteLimit, 11, -9, 2],
    [finiteLimit, -11, 9, -2],
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
      assert.ok(Object.keys(storage["math:internal"]).every((field) => /^[xyzw](?:_|$)/.test(field)), `${name} scratch keys`);
    }
  }
});

test("modulo results have the divisor sign and stay within its magnitude", () => {
  const threeSmallestFloats = Math.fround(3 * smallestFloat);
  const cases = [
    [Math.fround(0.3), Math.fround(0.3)],
    [-5, 3],
    [5, -3],
    [-5, -3],
    [1, threeSmallestFloats],
    [-1, threeSmallestFloats],
    [1, -threeSmallestFloats],
    [finiteLimit, 11],
    [-finiteLimit, 11],
    [finiteLimit, -11],
  ];
  for (const [a, b] of cases) {
    const { storage, returned } = runFunction("modulo", { a, b });
    const actual = storage["math:"].ans;
    assert.equal(returned, 1);
    assert.ok(actual === 0 || Math.sign(actual) === Math.sign(b), `modulo(${a}, ${b}) sign: ${actual}`);
    assert.ok(Math.abs(actual) < Math.abs(b), `modulo(${a}, ${b}) range: ${actual}`);
  }
});

test("remainder and modulo match exact binary32 reduction across deterministic finite inputs", () => {
  const bytes = new ArrayBuffer(4);
  const view = new DataView(bytes);
  let state = 0x9e3779b9;
  let count = 0;
  while (count < 256) {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    view.setUint32(0, state);
    const a = view.getFloat32(0);
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    view.setUint32(0, state);
    const b = view.getFloat32(0);
    if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) continue;

    for (const [name, expected] of [
      ["remainder", exactRemainderReference(a, b)],
      ["modulo", exactModuloReference(a, b)],
    ]) {
      const { storage, returned } = runFunction(name, { a, b });
      assert.equal(returned, 1, `${name}(${a}, ${b}) must succeed`);
      assert.equal(storage["math:"].ans, expected, `${name}(${a}, ${b})`);
    }
    count += 1;
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
    assert.ok(Object.keys(storage["math:internal"]).every((field) => /^[xyzw](?:_|$)/.test(field)));
  }
});

test("period normalization stays exact and finite across the binary32 range", () => {
  const tau = Math.fround(Math.PI * 2);
  for (const input of [
    Math.fround(1e20),
    Math.fround(-1e20),
    Math.fround(1e30),
    Math.fround(-1e30),
    finiteLimit,
    -finiteLimit,
  ]) {
    const expected = exactCenteredRemainderReference(input, tau);
    const result = runInternalFunction("normalize_period", { x: input, y: tau });
    assert.equal(result.returned, 1, `normalize_period(${input}) success`);
    assert.equal(result.storage["math:internal"].z, expected, `normalize_period(${input}) exact centered remainder`);
    assert.ok(Number.isFinite(result.storage["math:internal"].z), `normalize_period(${input}) finite result`);
    assert.equal(result.storage["math:internal"].w, input, `normalize_period(${input}) preserves original x in w`);
    assert.equal(result.numericTags.get(storageFieldKey("math:internal", "z")), "float");
    assert.ok(Object.keys(result.storage["math:internal"]).every((field) => /^[xyzw](?:_|$)/.test(field)));
  }
});
