import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { runFunction, storageFieldKey } from "./mcfunction-test-harness.mjs";

const finiteLimit = Math.fround(3.4028234663852886e38);
const smallestFloat = Math.fround(2 ** -149);
const smallestNormalFloat = Math.fround(2 ** -126);
const maximumFiniteExpInput = Math.fround(88.72283172607422);
const firstOverflowingExpInput = Math.fround(88.72283935546875);
const maximumZeroExpInput = Math.fround(-103.97208404541016);
const minimumNonzeroExpInput = Math.fround(-103.97207641601562);
const powerOverflowLogThreshold = Math.log((2 - 2 ** -24) * 2 ** 127);

function floatFromBits(bits) {
  const bytes = new ArrayBuffer(4);
  const view = new DataView(bytes);
  view.setUint32(0, bits);
  return view.getFloat32(0);
}

function bitsFromFloat(value) {
  const bytes = new ArrayBuffer(4);
  const view = new DataView(bytes);
  view.setFloat32(0, Math.fround(value));
  return view.getUint32(0);
}

function previousPositiveFloat(value) {
  return floatFromBits(bitsFromFloat(value) - 1);
}

function nextPositiveFloat(value) {
  return floatFromBits(bitsFromFloat(value) + 1);
}

function assertSquareRoot(input) {
  const publicInput = { a: input, error: "stale_error" };
  const { storage, numericTags, returned } = runFunction("square_root", publicInput);
  const expected = Math.fround(Math.sqrt(input));
  const actual = storage["math:"].ans;
  const relativeError = Math.abs((actual - expected) / expected);

  assert.equal(returned, 1, `square_root(${input}) must return success`);
  assert.equal(storage["math:"].error, undefined, `square_root(${input}) must clear stale error`);
  assert.equal(storage["math:"].a, input, `square_root(${input}) must preserve a`);
  assert.equal(numericTags.get(storageFieldKey("math:", "ans")), "float", `square_root(${input}) must write a float`);
  assert.ok(Object.keys(storage["math:internal"]).every((field) => ["x", "y", "z", "w"].includes(field)), `square_root(${input}) scratch keys`);
  assert.ok(relativeError <= 0.00001, `square_root(${input}) produced ${actual}, expected ${expected}, relative error ${relativeError}`);
  return relativeError;
}

function assertSuccessfulUnary(name, input) {
  const publicInput = { a: input, error: "stale_error" };
  const result = runFunction(name, publicInput);
  assert.equal(result.returned, 1, `${name}(${input}) must return success`);
  assert.equal(result.storage["math:"].error, undefined, `${name}(${input}) must clear stale error`);
  assert.equal(result.storage["math:"].a, input, `${name}(${input}) must preserve a`);
  assert.equal(result.numericTags.get(storageFieldKey("math:", "ans")), "float", `${name}(${input}) must write a float`);
  assert.ok(Object.keys(result.storage["math:internal"]).every((field) => ["x", "y", "z", "w"].includes(field)), `${name}(${input}) scratch keys`);
  return result.storage["math:"].ans;
}

function assertLog(input) {
  const expected = Math.fround(Math.log(input));
  const actual = assertSuccessfulUnary("log", input);
  const error = expected === 0 ? Math.abs(actual) : Math.abs((actual - expected) / expected);
  assert.ok(error <= 0.00001, `log(${input}) produced ${actual}, expected ${expected}, error ${error}`);
  return error;
}

function assertExp(input) {
  const expected = Math.fround(Math.exp(input));
  const actual = assertSuccessfulUnary("exp", input);
  const error = expected >= smallestNormalFloat
    ? Math.abs((actual - expected) / expected)
    : Math.abs(actual - expected) / smallestNormalFloat;
  assert.ok(error <= 0.00001, `exp(${input}) produced ${actual}, expected ${expected}, scaled error ${error}`);
  return error;
}

function assertPower(a, b) {
  const publicInput = { a, b, error: "stale_error" };
  const { storage, numericTags, returned } = runFunction("power", publicInput);
  const expected = Math.fround(Math.pow(a, b));
  const actual = storage["math:"].ans;
  const error = Math.abs(expected) >= smallestNormalFloat
    ? Math.abs((actual - expected) / expected)
    : Math.abs(actual - expected) / smallestNormalFloat;

  assert.equal(returned, 1, `power(${a}, ${b}) must return success`);
  assert.equal(storage["math:"].error, undefined, `power(${a}, ${b}) must clear stale error`);
  assert.equal(storage["math:"].a, a, `power(${a}, ${b}) must preserve a`);
  assert.equal(storage["math:"].b, b, `power(${a}, ${b}) must preserve b`);
  assert.equal(numericTags.get(storageFieldKey("math:", "ans")), "float", `power(${a}, ${b}) must write a float`);
  assert.ok(Object.keys(storage["math:internal"]).every((field) => ["x", "y", "z", "w"].includes(field)), `power(${a}, ${b}) scratch keys`);
  assert.ok(error <= 0.00005, `power(${a}, ${b}) produced ${actual}, expected ${expected}, scaled error ${error}`);
  return error;
}

test("square root generated graph uses responsibility subdirectories", () => {
  for (const provider of [
    "square_root/00.json",
    "square_root/normalize/mantissa/00.json",
    "square_root/normalize/scale/00.json",
    "square_root/approximate/00.json",
    "square_root/newton/00/00.json",
    "square_root/newton/01/00.json",
    "square_root/newton/02/00.json",
  ]) {
    assert.ok(fs.existsSync(path.join("Math/data/math/number_provider", provider)), `missing ${provider}`);
  }
  assert.ok(fs.existsSync("Math/data/math/predicate/internal/square_root/zero.json"));
  assert.ok(fs.existsSync("Math/data/math/predicate/internal/square_root/result_finite.json"));
});

test("square root returns exact zero and rejects negative input", () => {
  for (const input of [0, -0]) {
    const { storage, numericTags, returned } = runFunction("square_root", { a: input, ans: 91, error: "stale_error" });
    assert.equal(returned, 1);
    assert.equal(storage["math:"].ans, 0);
    assert.equal(storage["math:"].error, undefined);
    assert.equal(storage["math:"].a, input);
    assert.equal(numericTags.get(storageFieldKey("math:", "ans")), "float");
  }

  const negative = runFunction("square_root", { a: -smallestFloat, ans: 91, error: "stale_error" });
  assert.equal(negative.returned, 0);
  assert.equal(negative.storage["math:"].ans, undefined);
  assert.equal(negative.storage["math:"].error, "negative_square_root");
  assert.equal(negative.storage["math:"].a, -smallestFloat);
});

test("square root handles subnormals, exponent boundaries, and hand-checked values", () => {
  const cases = new Set([
    smallestFloat,
    Math.fround(2 * smallestFloat),
    previousPositiveFloat(2 ** -126),
    Math.fround(2 ** -126),
    2,
    3,
    10,
    finiteLimit,
  ]);

  for (let exponent = -149; exponent <= 127; exponent += 1) {
    const power = Math.fround(2 ** exponent);
    if (power > 0 && Number.isFinite(power)) {
      cases.add(power);
      if (power > smallestFloat) cases.add(previousPositiveFloat(power));
      if (power < finiteLimit) cases.add(nextPositiveFloat(power));
    }
  }

  for (const input of cases) assertSquareRoot(input);
});

test("square root stays within tolerance for 10,000 deterministic positive binary32 samples", (t) => {
  let state = 0x243f6a88;
  let count = 0;
  let maximumRelativeError = 0;
  let worstInput = 0;

  while (count < 10_000) {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    const input = floatFromBits(state & 0x7fffffff);
    if (!Number.isFinite(input) || input === 0) continue;

    const relativeError = assertSquareRoot(input);
    if (relativeError > maximumRelativeError) {
      maximumRelativeError = relativeError;
      worstInput = input;
    }
    count += 1;
  }

  t.diagnostic(`maximum relative error ${maximumRelativeError} at ${worstInput}`);
  assert.ok(maximumRelativeError <= 0.00001, `maximum relative error ${maximumRelativeError} at ${worstInput}`);
});

test("log exp and power generated graphs use responsibility subdirectories", () => {
  for (const provider of [
    "log/00.json",
    "log/normalize/prescale/00.json",
    "log/normalize/mantissa/00.json",
    "log/polynomial/00.json",
    "exp/00.json",
    "exp/reduce/quotient/00.json",
    "exp/reduce/remainder/00.json",
    "exp/polynomial/00.json",
    "exp/scale/00.json",
    "power/positive/00.json",
  ]) {
    assert.ok(fs.existsSync(path.join("Math/data/math/number_provider", provider)), `missing ${provider}`);
  }
  for (const predicate of [
    "log/zero.json",
    "exp/input_finite.json",
    "exp/input_in_range.json",
    "exp/underflows_to_zero.json",
    "power/exponent_integer.json",
    "power/exponent_large_even.json",
    "power/exponent_odd.json",
  ]) {
    assert.ok(fs.existsSync(path.join("Math/data/math/predicate/internal", predicate)), `missing ${predicate}`);
  }
});

test("natural logarithm handles exact values, subnormals, and centered normalization boundaries", () => {
  assert.equal(assertSuccessfulUnary("log", 1), 0);
  for (const input of [
    smallestFloat,
    Math.fround(2 * smallestFloat),
    previousPositiveFloat(2 ** -126),
    Math.fround(2 ** -126),
    previousPositiveFloat(1),
    nextPositiveFloat(1),
    Math.fround(Math.SQRT2),
    previousPositiveFloat(Math.SQRT2),
    nextPositiveFloat(Math.SQRT2),
    Math.fround(Math.E),
    finiteLimit,
  ]) assertLog(input);
});

test("natural logarithm rejects zero and negative inputs with cleanup", () => {
  for (const input of [0, -0, -smallestFloat, -1, -finiteLimit]) {
    const result = runFunction("log", { a: input, ans: 91, error: "stale_error" });
    assert.equal(result.returned, 0, `log(${input}) must fail`);
    assert.equal(result.storage["math:"].ans, undefined);
    assert.equal(result.storage["math:"].error, "non_real_result");
    assert.equal(result.storage["math:"].a, input);
  }
});

test("natural logarithm stays within tolerance for 10,000 deterministic positive binary32 samples", (t) => {
  let state = 0x13198a2e;
  let count = 0;
  let maximumError = 0;
  let worstInput = 0;
  while (count < 10_000) {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    const input = floatFromBits(state & 0x7fffffff);
    if (!Number.isFinite(input) || input === 0) continue;
    const error = assertLog(input);
    if (error > maximumError) [maximumError, worstInput] = [error, input];
    count += 1;
  }
  t.diagnostic(`maximum log error ${maximumError} at ${worstInput}`);
});

test("exponential handles range-reduction boundaries, scale endpoints, and subnormals", () => {
  assert.equal(assertSuccessfulUnary("exp", 0), 1);
  for (const input of [
    -100,
    -90,
    Math.fround(-87.3365447505531),
    -40,
    -1,
    1,
    40,
    80,
    maximumFiniteExpInput,
    minimumNonzeroExpInput,
  ]) assertExp(Math.fround(input));

  for (const exponent of [-150, -149, -126, -1, 0, 1, 126, 127]) {
    const boundary = Math.fround((exponent + 0.5) * Math.LN2);
    for (const input of [previousPositiveFloat(boundary), boundary, nextPositiveFloat(boundary)]) {
      if (input <= maximumFiniteExpInput) assertExp(input);
    }
  }
});

test("exponential uses Java-float-compatible underflow and rejects overflow", () => {
  assert.equal(assertSuccessfulUnary("exp", minimumNonzeroExpInput), smallestFloat);
  for (const input of [maximumZeroExpInput, -finiteLimit]) {
    const actual = assertSuccessfulUnary("exp", input);
    assert.equal(actual, 0, `exp(${input}) must underflow to positive zero`);
    assert.equal(Object.is(actual, -0), false);
  }

  for (const input of [firstOverflowingExpInput, finiteLimit]) {
    const result = runFunction("exp", { a: input, ans: 91, error: "stale_error" });
    assert.equal(result.returned, 0, `exp(${input}) must fail`);
    assert.equal(result.storage["math:"].ans, undefined);
    assert.equal(result.storage["math:"].error, "result_out_of_range");
    assert.equal(result.storage["math:"].a, input);
  }
});

test("log and exponential are inverse pairs across the finite normal exponential range", () => {
  for (const input of [-80, -40, -10, -1, 1, 10, 40, 80]) {
    const exponential = assertSuccessfulUnary("exp", input);
    const roundTrip = assertSuccessfulUnary("log", exponential);
    const relativeError = Math.abs((roundTrip - input) / input);
    assert.ok(relativeError <= 0.00001, `log(exp(${input})) produced ${roundTrip}, relative error ${relativeError}`);
  }
});

test("exponential stays within tolerance for 10,000 deterministic finite normal outputs", (t) => {
  let state = 0xa4093822;
  let maximumError = 0;
  let worstInput = 0;
  for (let count = 0; count < 10_000; count += 1) {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    const unit = state / 0x1_0000_0000;
    const input = Math.fround(-87.3 + unit * (maximumFiniteExpInput + 87.3));
    const error = assertExp(input);
    if (error > maximumError) [maximumError, worstInput] = [error, input];
  }
  t.diagnostic(`maximum exp error ${maximumError} at ${worstInput}`);
});

test("real power handles fractional positive bases and exact zero cases", () => {
  for (const [a, b] of [
    [2, 0.5],
    [9, 0.5],
    [0.25, -1.5],
    [10, Math.fround(1 / 3)],
    [finiteLimit, 0.25],
    [smallestFloat, 0.25],
    [0, 0],
    [0, 3.5],
  ]) assertPower(a, b);
});

test("real power handles negative bases only for exact integer exponents with exact parity", () => {
  for (const [a, b] of [
    [-2, 3],
    [-2, 4],
    [-2, -3],
    [-1, 16_777_215],
    [-1, 16_777_216],
    [-1, -16_777_215],
    [-1, -16_777_216],
  ]) assertPower(a, b);

  for (const exponent of [0.5, -0.5, 1.5, -1.5]) {
    const result = runFunction("power", { a: -2, b: exponent, ans: 91, error: "stale_error" });
    assert.equal(result.returned, 0);
    assert.equal(result.storage["math:"].ans, undefined);
    assert.equal(result.storage["math:"].error, "non_real_result");
    assert.equal(result.storage["math:"].a, -2);
    assert.equal(result.storage["math:"].b, exponent);
  }
});

test("real power reports zero-to-negative and finite-result overflow errors", () => {
  const zeroNegative = runFunction("power", { a: 0, b: -1, ans: 91, error: "stale_error" });
  assert.equal(zeroNegative.returned, 0);
  assert.equal(zeroNegative.storage["math:"].ans, undefined);
  assert.equal(zeroNegative.storage["math:"].error, "zero_to_negative_power");

  for (const [a, b] of [[2, 128], [finiteLimit, finiteLimit]]) {
    const result = runFunction("power", { a, b, ans: 91, error: "stale_error" });
    assert.equal(result.returned, 0, `power(${a}, ${b}) must fail`);
    assert.equal(result.storage["math:"].ans, undefined);
    assert.equal(result.storage["math:"].error, "result_out_of_range");
    assert.equal(result.storage["math:"].a, a);
    assert.equal(result.storage["math:"].b, b);
  }

  assert.equal(assertSuccessfulUnary("exp", maximumZeroExpInput), 0);
  assert.equal(assertPower(2, -200), 0);
});

test("real power stays within tolerance for deterministic finite positive-base samples", (t) => {
  let state = 0x082efa98;
  let count = 0;
  let maximumError = 0;
  let worstCase;
  while (count < 5_000) {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    const base = Math.fround(2 ** (-10 + (state / 0x1_0000_0000) * 20));
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    const exponent = Math.fround(-10 + (state / 0x1_0000_0000) * 20);
    const expected = Math.fround(Math.pow(base, exponent));
    if (!Number.isFinite(expected)) continue;
    const error = assertPower(base, exponent);
    if (error > maximumError) [maximumError, worstCase] = [error, [base, exponent]];
    count += 1;
  }
  t.diagnostic(`maximum power error ${maximumError} at ${worstCase}`);
});

test("power preserves exact exponent-one identities at the finite limit", () => {
  for (const base of [finiteLimit, -finiteLimit]) {
    const result = runFunction("power", { a: base, b: 1, error: "stale_error" });
    assert.equal(result.returned, 1, `power(${base}, 1) must succeed`);
    assert.equal(result.storage["math:"].ans, base);
    assert.equal(result.storage["math:"].error, undefined);
    assert.equal(result.storage["math:"].a, base);
    assert.equal(result.storage["math:"].b, 1);
  }
});

test("power distinguishes adjacent finite and overflowing results on both base signs", () => {
  const cases = [
    [Math.fround(10), Math.fround(38.531837), true],
    [Math.fround(913734592), Math.fround(4.300035), false],
    [Math.fround(6981463572480), 3, true],
    [Math.fround(6981464096768), 3, false],
    [Math.fround(-6981463572480), 3, true],
    [Math.fround(-6981464096768), 3, false],
  ];

  for (const [a, b, finite] of cases) {
    const result = runFunction("power", { a, b, ans: 91, error: "stale_error" });
    assert.equal(result.returned, finite ? 1 : 0, `power(${a}, ${b}) classification`);
    assert.equal(Number.isFinite(result.storage["math:"].ans), finite, `power(${a}, ${b}) ans`);
    assert.equal(result.storage["math:"].error, finite ? undefined : "result_out_of_range");
    assert.equal(result.storage["math:"].a, a);
    assert.equal(result.storage["math:"].b, b);
    if (finite) {
      const expected = Math.fround(Math.pow(a, b));
      const relativeError = Math.abs((result.storage["math:"].ans - expected) / expected);
      assert.ok(relativeError <= 0.00005, `power(${a}, ${b}) relative error ${relativeError}`);
    }
  }
});

test("power preserves accuracy across the overflow ambiguity band", (t) => {
  const cases = [];
  for (const [base, target] of [
    [2, 88.7],
    [2, Math.fround(127.97) * Math.LN2],
    [10, Math.fround(38.53) * Math.log(10)],
    [2, powerOverflowLogThreshold],
    [10, powerOverflowLogThreshold],
  ]) {
    const exponent = Math.fround(target / Math.log(base));
    for (const candidate of [
      previousPositiveFloat(exponent),
      exponent,
      nextPositiveFloat(exponent),
    ]) {
      if (Number.isFinite(Math.fround(Math.pow(base, candidate)))) cases.push([base, candidate]);
    }
  }

  for (const [exponent, target] of [
    [3, 88.7],
    [3, 88.71],
    [3, powerOverflowLogThreshold],
    [4, 88.7],
    [4, 88.71],
    [4, powerOverflowLogThreshold],
  ]) {
    const magnitude = Math.fround(Math.exp(target / exponent));
    for (const candidate of [
      previousPositiveFloat(magnitude),
      magnitude,
      nextPositiveFloat(magnitude),
    ]) {
      const base = -candidate;
      if (Number.isFinite(Math.fround(Math.pow(base, exponent)))) cases.push([base, exponent]);
    }
  }

  let maximumError = 0;
  let worstCase;
  for (const [a, b] of cases) {
    const error = assertPower(a, b);
    if (error > maximumError) [maximumError, worstCase] = [error, [a, b]];
  }

  for (const base of [2, 10]) {
    const exponent = Math.fround(88.75 / Math.log(base));
    for (const candidate of [previousPositiveFloat(exponent), exponent, nextPositiveFloat(exponent)]) {
      const result = runFunction("power", { a: base, b: candidate, ans: 91, error: "stale_error" });
      assert.equal(result.returned, 0, `power(${base}, ${candidate}) at upper ambiguity-band edge`);
      assert.equal(result.storage["math:"].ans, undefined);
      assert.equal(result.storage["math:"].error, "result_out_of_range");
    }
  }

  t.diagnostic(`${cases.length} finite ambiguity-band cases; maximum error ${maximumError} at ${worstCase}`);
});

test("power representability matches 750 adversarial cases around the overflow boundary", (t) => {
  let state = 0x452821e6;
  let falseRejects = 0;
  let falseAccepts = 0;
  let checked = 0;

  for (let index = 0; index < 250; index += 1) {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    const exponent = (state >>> 8) / 0x0100_0000;
    const base = index < 125
      ? Math.fround(1 + exponent * 1023)
      : floatFromBits(0x3f800001 + (state % (0x7f7fffff - 0x3f800001)));
    if (!Number.isFinite(base) || base <= 1) throw new Error(`invalid adversarial base ${base}`);

    const boundaryExponent = Math.fround(powerOverflowLogThreshold / Math.log(base));
    for (const candidate of [
      previousPositiveFloat(boundaryExponent),
      boundaryExponent,
      nextPositiveFloat(boundaryExponent),
    ]) {
      const expectedFinite = Number.isFinite(Math.fround(Math.pow(base, candidate)));
      const result = runFunction("power", { a: base, b: candidate, ans: 91, error: "stale_error" });
      if (expectedFinite && result.returned !== 1) falseRejects += 1;
      if (!expectedFinite && result.returned !== 0) falseAccepts += 1;
      checked += 1;
    }
  }

  t.diagnostic(`${checked} boundary cases: ${falseRejects} false rejects, ${falseAccepts} false accepts`);
  assert.equal(falseRejects, 0);
  assert.equal(falseAccepts, 0);
});

test("power representability matches an independent 750-case base-adjacent sweep", (t) => {
  let falseRejects = 0;
  let falseAccepts = 0;
  let checked = 0;

  for (let exponent = 1; exponent <= 250; exponent += 1) {
    const boundaryBase = Math.fround(Math.exp(powerOverflowLogThreshold / exponent));
    for (const magnitude of [
      previousPositiveFloat(boundaryBase),
      boundaryBase,
      nextPositiveFloat(boundaryBase),
    ]) {
      const base = exponent % 2 === 0 ? -magnitude : magnitude;
      const expectedFinite = Number.isFinite(Math.fround(Math.pow(base, exponent)));
      const result = runFunction("power", { a: base, b: exponent, ans: 91, error: "stale_error" });
      if (expectedFinite && result.returned !== 1) falseRejects += 1;
      if (!expectedFinite && result.returned !== 0) falseAccepts += 1;
      checked += 1;
    }
  }

  t.diagnostic(`${checked} independent boundary cases: ${falseRejects} false rejects, ${falseAccepts} false accepts`);
  assert.equal(falseRejects, 0);
  assert.equal(falseAccepts, 0);
});

test("negative-infinity power intermediates underflow to correctly signed zero", () => {
  for (const [a, b, negativeZero] of [
    [finiteLimit, -finiteLimit, false],
    [smallestFloat, finiteLimit, false],
    [-finiteLimit, -16_777_215, true],
    [-smallestFloat, 16_777_215, true],
  ]) {
    const result = runFunction("power", { a, b, ans: 91, error: "stale_error" });
    assert.equal(result.returned, 1, `power(${a}, ${b}) must underflow`);
    assert.ok(result.storage["math:"].ans === 0);
    assert.equal(Object.is(result.storage["math:"].ans, -0), negativeZero);
    assert.equal(result.storage["math:"].error, undefined);
    assert.equal(result.storage["math:"].a, a);
    assert.equal(result.storage["math:"].b, b);
  }
});
