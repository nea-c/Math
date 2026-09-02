import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { evaluateGeneratedProvider, runFunction, storageFieldKey } from "./mcfunction-test-harness.mjs";

const finiteLimit = Math.fround(3.4028234663852886e38);
const smallestFloat = Math.fround(2 ** -149);
const smallestNormalFloat = Math.fround(2 ** -126);
const maximumFiniteExpInput = Math.fround(88.72283172607422);
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
  const { storage, numericTags, returned } = runFunction("sqrt", publicInput);
  const expected = Math.fround(Math.sqrt(input));
  const actual = storage["math:"].ans;
  const relativeError = Math.abs((actual - expected) / expected);

  assert.equal(returned, undefined, `square_root(${input}) must naturally end`);
  assert.equal(storage["math:"].error, "stale_error", `square_root(${input}) must preserve unrelated public state`);
  assert.equal(storage["math:"].a, input, `square_root(${input}) must preserve a`);
  assert.equal(numericTags.get(storageFieldKey("math:", "ans")), "float", `square_root(${input}) must write a float`);
  assert.equal(storage["math:"].internal, undefined, `square_root(${input}) scratch cleanup`);
  assert.ok(relativeError <= 0.00001, `square_root(${input}) produced ${actual}, expected ${expected}, relative error ${relativeError}`);
  return relativeError;
}

function assertSuccessfulUnary(name, input) {
  const publicInput = { a: input, error: "stale_error" };
  const result = runFunction(name, publicInput);
  assert.equal(result.returned, undefined, `${name}(${input}) must naturally end`);
  assert.equal(result.storage["math:"].error, "stale_error", `${name}(${input}) must preserve unrelated public state`);
  assert.equal(result.storage["math:"].a, input, `${name}(${input}) must preserve a`);
  assert.equal(result.numericTags.get(storageFieldKey("math:", "ans")), "float", `${name}(${input}) must write a float`);
  assert.equal(result.storage["math:"].internal, undefined, `${name}(${input}) scratch cleanup`);
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
  const { storage, numericTags, returned } = runFunction("pow", publicInput);
  const expected = Math.fround(Math.pow(a, b));
  const actual = storage["math:"].ans;
  const error = Math.abs(expected) >= smallestNormalFloat
    ? Math.abs((actual - expected) / expected)
    : Math.abs(actual - expected) / smallestNormalFloat;

  assert.equal(returned, undefined, `power(${a}, ${b}) must naturally end`);
  assert.equal(storage["math:"].error, "stale_error", `power(${a}, ${b}) must preserve unrelated public state`);
  assert.equal(storage["math:"].a, a, `power(${a}, ${b}) must preserve a`);
  assert.equal(storage["math:"].b, b, `power(${a}, ${b}) must preserve b`);
  assert.equal(numericTags.get(storageFieldKey("math:", "ans")), "float", `power(${a}, ${b}) must write a float`);
  assert.equal(storage["math:"].internal, undefined, `power(${a}, ${b}) scratch cleanup`);
  assert.ok(error <= 0.00005, `power(${a}, ${b}) produced ${actual}, expected ${expected}, scaled error ${error}`);
  return error;
}

test("square root generated graph uses the native sqrt provider", () => {
  const provider = JSON.parse(fs.readFileSync("Math/data/math/context_float_provider/sqrt/00.json", "utf8"));
  assert.equal(provider.type, "minecraft:sqrt");
  assert.equal(fs.existsSync("Math/data/math/function/sqrt/2.refine.mcfunction"), false);
});

test("square root preserves native signed-zero inputs", () => {
  for (const input of [0, -0]) {
    const { storage, numericTags, returned } = runFunction("sqrt", { a: input, ans: 91, error: "stale_error" });
    assert.equal(returned, undefined);
    assert.equal(Object.is(storage["math:"].ans, input), true);
    assert.equal(storage["math:"].error, "stale_error");
    assert.equal(storage["math:"].a, input);
    assert.equal(numericTags.get(storageFieldKey("math:", "ans")), "float");
  }

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

  for (let leadingBit = 0; leadingBit <= 22; leadingBit += 1) {
    const lower = 2 ** leadingBit;
    const upper = Math.min(0x7fffff, (2 ** (leadingBit + 1)) - 1);
    cases.add(floatFromBits(lower));
    cases.add(floatFromBits(Math.floor((lower + upper) / 2)));
    cases.add(floatFromBits(upper));
  }

  for (const input of cases) assertSquareRoot(input);
});

test("square root stays within tolerance for 50,000 deterministic positive binary32 samples", (t) => {
  let state = 0x9e3779b9;
  let count = 0;
  let maximumRelativeError = 0;
  let worstInput = 0;

  while (count < 50_000) {
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

test("log and exp generated graphs use responsibility subdirectories", () => {
  for (const provider of [
    "log/00.json",
    "log/normalize/compare_center/00.json",
    "log/normalize/centered_mantissa/00.json",
    "log/normalize/centered_exponent/00.json",
    "log/polynomial/00.json",
    "exp/reduce/remainder/00.json",
    "exp/polynomial/00.json",
    "exp/scale/00.json",
  ]) {
    assert.ok(fs.existsSync(path.join("Math/data/math/context_float_provider", provider)), `missing ${provider}`);
  }
  for (const predicate of [
    "exp/underflows_to_zero.json",
  ]) {
    assert.ok(fs.existsSync(path.join("Math/data/math/predicate/.validation", predicate)), `missing ${predicate}`);
  }
  for (const predicate of [
    "exp/input_finite.json",
    "exp/input_in_range.json",
    "power/below_overflow_classification.json",
    "power/exponent_large_even.json",
    "power/classifier_overflow.json",
    "power/needs_overflow_classification.json",
  ]) {
    assert.equal(fs.existsSync(path.join("Math/data/math/predicate/.validation", predicate)), false, `obsolete ${predicate} remains`);
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

test("exponential uses Java-float-compatible underflow", () => {
  assert.equal(assertSuccessfulUnary("exp", minimumNonzeroExpInput), smallestFloat);
  for (const input of [maximumZeroExpInput, -finiteLimit]) {
    const actual = assertSuccessfulUnary("exp", input);
    assert.equal(actual, 0, `exp(${input}) must underflow to positive zero`);
    assert.equal(Object.is(actual, -0), false);
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

});
test("real power preserves finite underflow results", () => {
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
    const result = runFunction("pow", { a: base, b: 1, error: "stale_error" });
    assert.equal(result.returned, undefined, `power(${base}, 1) must naturally end`);
    assert.equal(result.storage["math:"].ans, base);
    assert.equal(result.storage["math:"].error, "stale_error");
    assert.equal(result.storage["math:"].a, base);
    assert.equal(result.storage["math:"].b, 1);
  }
});

test("power preserves adjacent finite results on both base signs", () => {
  const cases = [
    [Math.fround(10), Math.fround(38.531837)],
    [Math.fround(6981463572480), 3],
    [Math.fround(-6981463572480), 3],
  ];

  for (const [a, b] of cases) {
    const result = runFunction("pow", { a, b, ans: 91, error: "stale_error" });
    assert.equal(result.returned, undefined, `power(${a}, ${b}) naturally ends`);
    assert.equal(Number.isFinite(result.storage["math:"].ans), true, `power(${a}, ${b}) ans`);
    assert.equal(result.storage["math:"].error, "stale_error");
    assert.equal(result.storage["math:"].a, a);
    assert.equal(result.storage["math:"].b, b);
    const expected = Math.fround(Math.pow(a, b));
    const relativeError = Math.abs((result.storage["math:"].ans - expected) / expected);
    assert.ok(relativeError <= 0.00005, `power(${a}, ${b}) relative error ${relativeError}`);
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

  t.diagnostic(`${cases.length} finite ambiguity-band cases; maximum error ${maximumError} at ${worstCase}`);
});

test("power stays accurate for adversarial finite cases around the overflow boundary", (t) => {
  let state = 0x452821e6;
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
      if (!expectedFinite) continue;
      assertPower(base, candidate);
      checked += 1;
    }
  }

  t.diagnostic(`${checked} finite boundary cases checked`);
  assert.ok(checked > 0);
});

test("power stays accurate on an independent finite base-adjacent sweep", (t) => {
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
      if (!expectedFinite) continue;
      assertPower(base, exponent);
      checked += 1;
    }
  }

  t.diagnostic(`${checked} independent finite boundary cases checked`);
  assert.ok(checked > 0);
});

test("negative-infinity power intermediates underflow to correctly signed zero", () => {
  for (const [a, b, negativeZero] of [
    [finiteLimit, -finiteLimit, false],
    [smallestFloat, finiteLimit, false],
    [-finiteLimit, -16_777_215, true],
    [-smallestFloat, 16_777_215, true],
  ]) {
    const result = runFunction("pow", { a, b, ans: 91, error: "stale_error" });
    assert.equal(result.returned, undefined, `power(${a}, ${b}) must naturally end`);
    assert.ok(result.storage["math:"].ans === 0);
    assert.equal(Object.is(result.storage["math:"].ans, -0), negativeZero);
    assert.equal(result.storage["math:"].error, "stale_error");
    assert.equal(result.storage["math:"].a, a);
    assert.equal(result.storage["math:"].b, b);
  }
});

function adjacentFloats(value) {
  const rounded = Math.fround(value);
  const bits = bitsFromFloat(rounded);
  if (rounded > 0) return [floatFromBits(bits - 1), rounded, floatFromBits(bits + 1)];
  if (rounded < 0) return [floatFromBits(bits + 1), rounded, floatFromBits(bits - 1)];
  return [-smallestFloat, rounded, smallestFloat];
}

function assertTrigValue(name, input, reference, tolerance = 0.00001) {
  const actual = assertSuccessfulUnary(name, input);
  const expected = reference(input);
  const absoluteError = Math.abs(actual - expected);
  assert.ok(
    absoluteError <= tolerance,
    `${name}(${input}) produced ${actual}, expected ${expected}, absolute error ${absoluteError}`,
  );
  return absoluteError;
}

function deterministicAngles(minimum, maximum, count, seed) {
  const values = [];
  let state = seed >>> 0;
  for (let index = 0; index < count; index += 1) {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    values.push(Math.fround(minimum + (state / 0x1_0000_0000) * (maximum - minimum)));
  }
  return values;
}

test("trigonometric generated graphs keep shared kernels and omit obsolete guards", () => {
  for (const provider of [
    "sin/00.json",
    "cos/00.json",
    "tan/00.json",
  ]) {
    assert.ok(fs.existsSync(path.join("Math/data/math/context_float_provider", provider)), `missing ${provider}`);
  }
  for (const provider of [
    "tan/guard/radians/00.json",
    "tan/guard/radians/compare_domain.json",
    "tan/guard/degrees/00.json",
    "tan/guard/degrees/compare_domain.json",
    "sin/fold/00.json",
    "sin/fold/compare_lower.json",
    "sin/fold/compare_upper.json",
    "sin/compare/positive_lower.json",
    "sin/compare/positive_upper.json",
    "sin/compare/negative_lower.json",
    "sin/compare/negative_upper.json",
  ]) {
    assert.equal(fs.existsSync(path.join("Math/data/math/context_float_provider", provider)), false, `obsolete ${provider} remains`);
  }
  for (const predicate of ["undefined_radians", "undefined_degrees"]) {
    assert.equal(fs.existsSync(`Math/data/math/predicate/.validation/tan/${predicate}.json`), false, `obsolete tan/${predicate} predicate remains`);
  }
});

test("log materializes three private Newton updates with small active providers", () => {
  const providerRoot = path.join("Math/data/math/context_float_provider/.common/reciprocal");
  for (const stage of ["00", "01", "02"]) {
    assert.equal(fs.existsSync(path.join(providerRoot, "log_newton", stage, "00.json")), false);
  }

  const providers = new Map();
  for (const entry of fs.readdirSync("Math/data/math/context_float_provider", { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const file = path.join(entry.parentPath, entry.name);
    const relative = path.relative("Math/data/math/context_float_provider", file).replaceAll("\\", "/").replace(/\.json$/, "");
    providers.set(`math:${relative}`, JSON.parse(fs.readFileSync(file, "utf8")));
  }
  const expandedNodes = (provider) => {
    if (typeof provider === "number") return 1;
    if (typeof provider === "string") return expandedNodes(providers.get(provider));
    return 1 + (provider.inputs ?? []).reduce((total, operand) => total + expandedNodes(operand), 0);
  };
  for (const name of ["log_initial", "log_newton"]) {
    assert.ok(expandedNodes(providers.get(`math:.common/reciprocal/${name}`)) < 60, `${name} is too large`);
  }

  const source = fs.readFileSync("Math/data/math/function/.common/log/0.start.mcfunction", "utf8");
  assert.equal((source.match(/w_log_reciprocal set compute default float math:\.common\/reciprocal\/log_newton/g) ?? []).length, 3);
});

test("tan evaluates native sine and cosine once each", () => {
  const source = fs.readFileSync("Math/data/math/function/.common/tan/0.start.mcfunction", "utf8");
  assert.equal((source.match(/math:sin\/00/g) ?? []).length, 1);
  assert.equal((source.match(/math:cos\/00/g) ?? []).length, 1);
  assert.doesNotMatch(source, /math:\.common\/normalize_period\/0\.start/);
  assert.match(source, /w_tan_sin/);
  assert.match(source, /w_tan_cos/);
});

test("native sine and cosine preserve signed zero", () => {
  for (const [name, input, expected, negativeZero = false] of [
    ["sin", 0, 0],
    ["sin", -0, -0, true],
    ["cos", 0, 1],
    ["cos", -0, 1],
    ["sin_degrees", 0, 0],
    ["sin_degrees", -0, -0, true],
    ["cos_degrees", 0, 1],
  ]) {
    const actual = assertSuccessfulUnary(name, input);
    assert.equal(actual, expected, `${name}(${input}) exact result`);
    if (expected === 0) assert.equal(Object.is(actual, -0), negativeZero, `${name}(${input}) zero sign`);
  }
});

test("radian sine and cosine meet the guaranteed domain including quadrant-adjacent floats", (t) => {
  const values = new Set();
  for (let index = 0; index <= 1600; index += 1) values.add(Math.fround(-100 + index * 0.125));
  for (const value of deterministicAngles(-100, 100, 2_000, 0x13198a2e)) values.add(value);
  for (let quadrant = -63; quadrant <= 63; quadrant += 1) {
    const boundary = Math.fround(quadrant * (Math.PI / 2));
    for (const value of adjacentFloats(boundary)) {
      if (value >= -100 && value <= 100) values.add(value);
    }
  }

  let maximumSinError = 0;
  let maximumCosError = 0;
  let worstSin;
  let worstCos;
  for (const value of values) {
    const sinError = assertTrigValue("sin", value, Math.sin);
    const cosError = assertTrigValue("cos", value, Math.cos);
    if (sinError > maximumSinError) [maximumSinError, worstSin] = [sinError, value];
    if (cosError > maximumCosError) [maximumCosError, worstCos] = [cosError, value];
  }

  t.diagnostic(`${values.size} radian samples; max sin error ${maximumSinError} at ${worstSin}; max cos error ${maximumCosError} at ${worstCos}`);
});

test("degree sine and cosine meet the guaranteed domain including quadrant-adjacent floats", (t) => {
  const values = new Set();
  for (let index = 0; index <= 2000; index += 1) values.add(Math.fround(-5000 + index * 5));
  for (const value of deterministicAngles(-5000, 5000, 2_000, 0xa4093822)) values.add(value);
  for (let quadrant = -55; quadrant <= 55; quadrant += 1) {
    for (const value of adjacentFloats(Math.fround(quadrant * 90))) values.add(value);
  }

  let maximumSinError = 0;
  let maximumCosError = 0;
  let worstSin;
  let worstCos;
  for (const value of values) {
    const radians = value * Math.PI / 180;
    const sinError = assertTrigValue("sin_degrees", value, () => Math.sin(radians));
    const cosError = assertTrigValue("cos_degrees", value, () => Math.cos(radians));
    if (sinError > maximumSinError) [maximumSinError, worstSin] = [sinError, value];
    if (cosError > maximumCosError) [maximumCosError, worstCos] = [cosError, value];
  }

  t.diagnostic(`${values.size} degree samples; max sin error ${maximumSinError} at ${worstSin}; max cos error ${maximumCosError} at ${worstCos}`);
});

test("tangent is accurate away from poles and near valid threshold boundaries", (t) => {
  let checked = 0;
  let maximumAbsoluteError = 0;
  let maximumScaledError = 0;
  let worstCase;
  for (const [name, minimum, maximum, seed, degrees] of [
    ["tan", -100, 100, 0x299f31d0, false],
    ["tan_degrees", -5000, 5000, 0x082efa98, true],
  ]) {
    for (const input of deterministicAngles(minimum, maximum, 2_000, seed)) {
      const radians = degrees ? input * Math.PI / 180 : input;
      if (Math.abs(Math.cos(radians)) < 0.25) continue;
      const actual = assertSuccessfulUnary(name, input);
      const expected = Math.tan(radians);
      const absoluteError = Math.abs(actual - expected);
      const scaledError = absoluteError / Math.max(1, Math.abs(expected));
      assert.ok(scaledError <= 0.00005, `${name}(${input}) scaled error ${scaledError}`);
      if (absoluteError > maximumAbsoluteError) [maximumAbsoluteError, worstCase] = [absoluteError, [name, input]];
      maximumScaledError = Math.max(maximumScaledError, scaledError);
      checked += 1;
    }
  }

  for (const [name, input] of [
    ["tan", Math.fround(Math.PI / 2 - 0.00004)],
    ["tan", Math.fround(Math.PI / 2 + 0.00004)],
    ["tan_degrees", Math.fround(90 - 0.00004 * 180 / Math.PI)],
    ["tan_degrees", Math.fround(90 + 0.00004 * 180 / Math.PI)],
  ]) {
    const result = runFunction(name, { a: input, ans: 91, error: "stale_error" });
    assert.equal(result.returned, undefined, `${name}(${input}) outside conservative pole band`);
    assert.ok(Number.isFinite(result.storage["math:"].ans));
    assert.equal(result.storage["math:"].error, "stale_error");
  }

  for (const [name, input] of [["tan", 0], ["tan", -0], ["tan_degrees", 0], ["tan_degrees", -0]]) {
    const actual = assertSuccessfulUnary(name, input);
    assert.equal(actual, input);
    assert.equal(Object.is(actual, -0), Object.is(input, -0));
  }

  t.diagnostic(`${checked} away-from-pole tangent samples; max absolute error ${maximumAbsoluteError} at ${worstCase}; max scaled error ${maximumScaledError}`);
});

test("trigonometric wrappers accept usable larger finite phases", () => {
  for (const [name, inputs] of [
    ["sin", [1_000, -1_000, 1_000_000]],
    ["cos", [1_000, -1_000, 1_000_000]],
    ["tan", [1_000, -1_000, 1_000_000]],
    ["sin_degrees", [10_000, -10_000, 1_000_000]],
    ["cos_degrees", [10_000, -10_000, 1_000_000]],
    ["tan_degrees", [10_000, -10_000, 1_000_000]],
  ]) {
    for (const input of inputs) {
      const result = runFunction(name, { a: Math.fround(input), error: "stale_error" });
      assert.equal(result.returned, undefined, `${name}(${input}) must retain a usable finite phase`);
      assert.ok(Number.isFinite(result.storage["math:"].ans), `${name}(${input}) must return finite ans`);
      assert.equal(result.storage["math:"].error, "stale_error");
      assert.equal(result.storage["math:"].a, Math.fround(input));
    }
  }
});

test("sine and cosine wrappers handle huge finite inputs", () => {
  const hugeInputs = [
    Math.fround(1e20),
    Math.fround(-1e20),
    Math.fround(1e30),
    Math.fround(-1e30),
    finiteLimit,
    -finiteLimit,
  ];
  for (const name of ["sin", "cos", "sin_degrees", "cos_degrees"]) {
    for (const input of hugeInputs) {
      const result = runFunction(name, { a: input, ans: 91, error: "stale_error" });
      assert.equal(result.returned, undefined, `${name}(${input}) must naturally end`);
      assert.ok(Number.isFinite(result.storage["math:"].ans), `${name}(${input}) must return finite ans`);
      assert.equal(result.storage["math:"].error, "stale_error");
      assert.equal(result.storage["math:"].a, input);
      assert.equal(result.numericTags.get(storageFieldKey("math:", "ans")), "float");
      assert.equal(result.storage["math:"].internal, undefined);
    }
  }
});
