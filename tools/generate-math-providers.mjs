import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  absolute,
  ceil,
  cosine,
  divide,
  floor,
  floatComparison,
  modulo,
  maximum,
  minimum,
  negate,
  power,
  product,
  round,
  sine,
  squareRoot,
  storage as rawStorage,
  subtract,
  sum,
  truncate,
  writeGeneratedJson,
} from "./math-provider-lib.mjs";
import {
  FUNCTION_PATHS,
  PUBLIC_FUNCTION_PATHS,
  functionId,
  publicTag,
} from "./function-layout.mjs";
import { optimizeProviderResources } from "./provider-resource-optimizer.mjs";

const command = "node tools/generate-math-providers.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const finiteLimit = 3.4028234663852886e38;
const smallestNegativeFloat = -1.401298464324817e-45;
const smallestPositiveFloat = Math.fround(2 ** -149);
const smallestFiniteReciprocalInput = Math.fround(2 ** -128 + 2 ** -149);
const largestSubnormalFloat = Math.fround(2 ** -126 - 2 ** -149);
const maximumZeroExpInput = Math.fround(-103.97208404541016);
const pi = Math.fround(Math.PI);
const halfPi = Math.fround(Math.PI / 2);
const tau = Math.fround(Math.PI * 2);
const generatedFiles = [];

const renamedSharedProviders = new Map([
  ["common/arithmetic/add", "common/add"],
  ["common/arithmetic/subtract", "common/sub"],
  ["common/arithmetic/multiply", "common/mul"],
  ["common/arithmetic/divide", "common/div"],
  ["common/arithmetic/reciprocal", "common/reciprocal"],
  ["common/arithmetic/square", "common/square"],
  ["common/arithmetic/cube", "common/cube"],
  ["common/arithmetic/lerp", "common/lerp"],
  ["common/comparison/absolute", "common/abs"],
  ["common/comparison/minimum", "common/min"],
  ["common/comparison/maximum", "common/max"],
  ["common/comparison/clamp", "common/clamp"],
  ["common/conversion/rad", "common/rad"],
  ["common/conversion/deg", "common/deg"],
]);

function canonicalProviderPath(relativePath) {
  const renamed = renamedSharedProviders.get(relativePath) ?? relativePath;
  return renamed
    .replace(/^common\//, ".common/")
    .replace(/^internal\/comparison\//, ".validation/")
    .replace(/^internal\/reciprocal\//, ".common/reciprocal/")
    .replace(/^power\//, "pow/")
    .replace(/^square_root\//, "sqrt/");
}

function canonicalProviderReference(value) {
  if (!value.startsWith("math:")) return value;
  return `math:${canonicalProviderPath(value.slice("math:".length))}`;
}

function privateProviderReferences(value) {
  if (typeof value === "string") return canonicalProviderReference(value);
  if (Array.isArray(value)) return value.map(privateProviderReferences);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, privateProviderReferences(child)]));
}

function emit(relativePath, value) {
  generatedFiles.push({
    kind: "json",
    relativePath: `Math/data/math/context_float_provider/${canonicalProviderPath(relativePath)}.json`,
    value: privateProviderReferences(value),
  });
}

function emitPredicate(relativePath, value) {
  generatedFiles.push({ kind: "json", relativePath: `Math/data/math/predicate/.validation/${relativePath}.json`, value });
}

function compactFunctionReturns(lines) {
  const compacted = [];
  for (const line of lines) {
    const successReturn = line.match(/^(execute (?:if|unless) .+? run )return 1$/);
    const previous = compacted.at(-1);
    if (successReturn && previous?.startsWith(successReturn[1])) {
      compacted[compacted.length - 1] = `${successReturn[1]}return run ${previous.slice(successReturn[1].length)}`;
    } else {
      compacted.push(line);
    }
  }

  if (compacted.at(-1) === "return 1" && /^(?:data modify|function) /.test(compacted.at(-2) ?? "")) {
    compacted.splice(-2, 2, `return run ${compacted.at(-2)}`);
  }
  return compacted;
}

function emitFunction(path, lines) {
  const migratedLines = compactFunctionReturns(lines.map(line => line
    .replaceAll(/compute default (?!float\b)/g, "compute default float ")
    .replaceAll(/storage math:internal ([A-Za-z0-9_.\[\]-]+)/g, "storage math: internal.$1")
    .replaceAll(/storage math:internal \{([^{}]+)\}/g, "storage math: {internal:{$1}}")
    .replaceAll(/math:(?:common\/(?:arithmetic\/(?:add|subtract|multiply|divide|reciprocal|square|cube|lerp)|comparison\/(?:absolute|minimum|maximum|clamp)|conversion\/(?:rad|deg))|common\/[^ ]+|power\/[^ ]+|square_root\/[^ ]+)/g,
      reference => canonicalProviderReference(reference))
    .replaceAll(/(compute default float )math:internal\/comparison\//g, "$1math:.validation/")
    .replaceAll(/(compute default float )math:internal\/reciprocal\//g, "$1math:.common/reciprocal/")
    .replaceAll(/(predicate )math:internal\//g, "$1math:.validation/")));
  generatedFiles.push({ kind: "function", relativePath: `Math/data/math/function/${path}.mcfunction`, text: `${migratedLines.join("\n")}\n` });
}

function emitFunctionTag(name, value) {
  generatedFiles.push({
    kind: "json",
    relativePath: `Math/data/math/tags/function/${name}.json`,
    value,
  });
}

const publicPreamble = [
  "data remove storage math: ans",
];
const publicCleanup = "data remove storage math: internal";
const inlineProvider = provider => JSON.stringify(provider);
const computeInline = (target, provider) =>
  `data modify storage math: ${target} set compute default float ${inlineProvider(provider)}`;

function emitDirectPublicFunction(name, computeLines) {
  emitFunction(PUBLIC_FUNCTION_PATHS[name], [
    ...publicPreamble,
    ...computeLines,
    publicCleanup,
  ]);
  emitFunctionTag(name, publicTag(name));
}

function emitControlledPublicFunction(name, computePath, computeLines) {
  emitFunction(PUBLIC_FUNCTION_PATHS[name], [
    ...publicPreamble,
    `function ${functionId(computePath)}`,
    publicCleanup,
  ]);
  emitFunction(computePath, computeLines);
  emitFunctionTag(name, publicTag(name));
}

const internalPath = (pathText) => `internal.${pathText}`;
const internalStorage = (pathText) => rawStorage("math:", internalPath(pathText));
const storage = rawStorage;

const x = internalStorage("x");
const y = internalStorage("y");
const z = internalStorage("z");
const w = internalStorage("w");
const publicA = storage("math:", "a");
const publicB = storage("math:", "b");
const publicT = storage("math:", "t");
const publicMin = storage("math:", "min");
const publicMax = storage("math:", "max");
const publicCurveX1 = storage("math:", "curve[0]");
const publicCurveY1 = storage("math:", "curve[1]");
const publicCurveX2 = storage("math:", "curve[2]");
const publicCurveY2 = storage("math:", "curve[3]");
const publicAnswer = storage("math:", "ans");
const publicAmplitude = storage("math:", "amplitude");
const publicPeriod = storage("math:", "period");
const publicOscillations = storage("math:", "oscillations");
const publicDamping = storage("math:", "damping");
const publicBounces = storage("math:", "bounces");
const publicDecay = storage("math:", "decay");
const publicRotation = Array.from({ length: 4 }, (_, index) => storage("math:", `rotation[${index}]`));
const quaternionComponents = publicRotation;
const quaternionScaledRaw = Array.from({ length: 4 }, (_, index) => internalStorage(`w_quaternion_scaled_raw_${index}`));
const quaternionScaled = Array.from({ length: 4 }, (_, index) => internalStorage(`w_quaternion_scaled_${index}`));
const quaternionNormalized = Array.from({ length: 4 }, (_, index) => internalStorage(`w_quaternion_normalized_${index}`));
const atanInput = internalStorage("w_atan_input");
const atanNumerator = internalStorage("w_atan_numerator");
const atanSquare = internalStorage("w_atan_square");
const atan2AbsoluteA = internalStorage("w_atan2_absolute_a");
const atan2AbsoluteB = internalStorage("w_atan2_absolute_b");
const atan2Minimum = internalStorage("w_atan2_minimum");
const atan2Maximum = internalStorage("w_atan2_maximum");
const quaternionAxis = Array.from({ length: 3 }, (_, index) => internalStorage(`w_quaternion_axis_${index}`));

function inlineValueCheck(value, min, max) {
  return floatRange(value, min, max);
}

function floatRange(value, min, max) {
  const test = {};
  if (min !== undefined) test.min = min;
  if (max !== undefined) test.max = max;
  return {
    type: "minecraft:float_value_check",
    value,
    test,
  };
}

const stagedPredicateCommands = new Map();

function emitStagedPredicate(relativePath, value, min, max) {
  const providerPath = `internal/comparison/predicate/${relativePath}/value`;
  const materializedPath = `w_comparison.predicate.${relativePath.replaceAll("/", "_")}`;
  emit(providerPath, numberDispatcher([{
    condition: floatRange(value, min, max),
    number_provider: 1,
  }], 0));
  emitPredicate(relativePath, floatRange(internalStorage(materializedPath), 1, 1));
  stagedPredicateCommands.set(relativePath, [
    `data modify storage math:internal ${materializedPath} set compute default math:${providerPath}`,
  ]);
}

function stagePredicate(relativePath) {
  const lines = stagedPredicateCommands.get(relativePath);
  if (!lines) throw new Error(`No staged predicate registered for ${relativePath}`);
  return lines;
}

function numberDispatcher(cases, defaultValue = 0) {
  return {
    type: "minecraft:number_dispatcher",
    cases: cases.map(({ number_provider: value, ...entry }) => ({ ...entry, value })),
    default: defaultValue,
  };
}

function balancedRangeLookup(entries, selector, selectValue) {
  if (entries.length === 1) return selectValue(entries[0]);
  const middle = Math.floor(entries.length / 2);
  const lower = entries.slice(0, middle);
  const upper = entries.slice(middle);
  return numberDispatcher([{
    condition: inlineValueCheck(selector, undefined, lower.at(-1).maximum),
    number_provider: balancedRangeLookup(lower, selector, selectValue),
  }], balancedRangeLookup(upper, selector, selectValue));
}

function balancedNumberLookup(entries, selectValue) {
  return balancedRangeLookup(
    entries.map(entry => ({ ...entry, maximum: entry.exponent })),
    z,
    selectValue,
  );
}

function boundedSum(operands, maximumOperands = 16) {
  let level = operands;
  while (level.length > maximumOperands) {
    const next = [];
    for (let index = 0; index < level.length; index += maximumOperands) {
      next.push(sum(level.slice(index, index + maximumOperands)));
    }
    level = next;
  }
  return sum(level);
}

function subtractExpression(left, right) {
  return subtract(left, right);
}

function twoSumLow(left, right, high = sum(left, right)) {
  const recoveredRight = subtractExpression(high, left);
  return sum(
    subtractExpression(left, subtractExpression(high, recoveredRight)),
    subtractExpression(right, recoveredRight),
  );
}

function splitHigh(value) {
  const scaled = product(4097, value);
  return subtractExpression(scaled, subtractExpression(scaled, value));
}

function twoProductLow(left, right, high = product(left, right)) {
  const leftHigh = splitHigh(left);
  const leftLow = subtractExpression(left, leftHigh);
  const rightHigh = splitHigh(right);
  const rightLow = subtractExpression(right, rightHigh);
  return sum(
    subtractExpression(product(leftHigh, rightHigh), high),
    product(leftHigh, rightLow),
    product(leftLow, rightHigh),
    product(leftLow, rightLow),
  );
}

function previousPositiveFloat(value) {
  const rounded = Math.fround(value);
  if (rounded === Infinity) return Math.fround(finiteLimit);
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setFloat32(0, rounded);
  view.setUint32(0, view.getUint32(0) - 1);
  return view.getFloat32(0);
}

function nextPositiveFloat(value) {
  const rounded = Math.fround(value);
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setFloat32(0, rounded);
  view.setUint32(0, view.getUint32(0) + 1);
  return view.getFloat32(0);
}

// The common contract accepts a positive magnitude. Callers that retain a
// sign (reciprocal) restore it after the shared normalization stage.
const normalizeMagnitude = x;
const normalizeExponentEntries = [];
for (let exponent = -149; exponent <= 127; exponent += 1) {
  const multiplierExponent = -exponent;
  normalizeExponentEntries.push({
    exponent,
    maximum: exponent,
    scale: Math.fround(2 ** exponent),
    multiplierA: multiplierExponent > 127 ? Math.fround(2 ** 127) : Math.fround(2 ** multiplierExponent),
    multiplierB: multiplierExponent > 127 ? Math.fround(2 ** (multiplierExponent - 127)) : 1,
  });
}

// Each clipped adjacent-float comparison contributes one exact integer step.
// Materializing the sum gives an exponent selector in [-149, 127] without an
// infinite constant, even for the minimum subnormal input.
const normalizeExponentSteps = [];
for (let exponent = -148; exponent <= 127; exponent += 1) {
  const threshold = Math.fround(2 ** exponent);
  const previous = previousPositiveFloat(threshold);
  const spacing = Math.fround(threshold - previous);
  const difference = sum(normalizeMagnitude, -previous);
  const adjacentStep = spacing < Math.fround(2 ** -127)
    ? product(difference, Math.fround(2 ** 127), Math.fround(1 / (spacing * 2 ** 127)))
    : product(difference, Math.fround(1 / spacing));
  normalizeExponentSteps.push(minimum(
    1,
    maximum(0, adjacentStep),
  ));
}
const storedNormalizeExponent = internalStorage("w_normalize_exponent");
const storedNormalizeMultiplierA = internalStorage("w_normalize_multiplier_a");
const storedNormalizeMultiplierB = internalStorage("w_normalize_multiplier_b");
const storedNormalizeMantissa = internalStorage("w_normalize_mantissa");
emit("common/normalize/binary32/exponent", boundedSum([-149, ...normalizeExponentSteps]));
emit("common/normalize/binary32/multiplier_a", balancedRangeLookup(
  normalizeExponentEntries,
  storedNormalizeExponent,
  entry => entry.multiplierA,
));
const normalizeSecondMultiplierEntries = normalizeExponentEntries.filter(entry => entry.exponent <= -128);
emit("common/normalize/binary32/multiplier_b", numberDispatcher([{
  condition: inlineValueCheck(storedNormalizeExponent, undefined, -128),
  number_provider: balancedRangeLookup(
    normalizeSecondMultiplierEntries,
    storedNormalizeExponent,
    entry => entry.multiplierB,
  ),
}], 1));
emit("common/normalize/binary32/mantissa_a", product(x, storedNormalizeMultiplierA));
emit("common/normalize/binary32/mantissa_b", product(storedNormalizeMantissa, storedNormalizeMultiplierB));

for (const [name, provider] of Object.entries({ a: publicA, b: publicB, x, y, z, w })) emit(`common/input/${name}`, provider);

emit("common/arithmetic/add", sum(x, y));
emit("common/arithmetic/subtract", subtract(x, y));
emit("common/arithmetic/multiply", product(x, y));
emit("common/arithmetic/divide", divide(x, y));
emit("common/arithmetic/reciprocal", divide(1, x));
emit("common/arithmetic/square", power(x, 2));
emit("common/arithmetic/cube", power(x, 3));
emit("common/arithmetic/lerp", sum(x, product(z, subtract(y, x))));
emit("common/comparison/absolute", absolute(x));
emit("common/comparison/minimum", minimum(x, y));
emit("common/comparison/maximum", maximum(x, y));
emit("common/comparison/clamp", maximum(minimum(x, w), z));
emit("common/conversion/rad", product(x, Math.fround(Math.PI / 180)));
emit("common/conversion/deg", product(x, Math.fround(180 / Math.PI)));

const bezierLow = internalStorage("w_bezier_low");
const bezierHigh = internalStorage("w_bezier_high");
const bezierMidpoint = internalStorage("w_bezier_midpoint");
const bezierInput = internalStorage("w_bezier_u");
const bezierCurveX1 = publicCurveX1;
const bezierCurveY1 = publicCurveY1;
const bezierCurveX2 = publicCurveX2;
const bezierCurveY2 = publicCurveY2;

function cubicBezier(parameter, firstControl, secondControl) {
  const inverse = sum(1, product(-1, parameter));
  return sum(
    product(3, inverse, inverse, parameter, firstControl),
    product(3, inverse, parameter, parameter, secondControl),
    product(parameter, parameter, parameter),
  );
}

const bezierCurveX = cubicBezier(bezierMidpoint, bezierCurveX1, bezierCurveX2);
emit("bezier/midpoint", product(0.5, sum(bezierLow, bezierHigh)));
emit("bezier/x", bezierCurveX);
emit("bezier/y", cubicBezier(bezierMidpoint, bezierCurveY1, bezierCurveY2));
emit("bezier/compare_x", floatComparison(subtractExpression(bezierCurveX, bezierInput), 0));
emitPredicate("bezier/x_before_input", inlineValueCheck(
  internalStorage("w_comparison.bezier_x"),
  undefined,
  -1,
));
emit("bezier/result", sum(publicA, product(
  internalStorage("w_bezier_y"),
  sum(publicB, product(-1, publicA)),
)));
emit("common/rounding/negate", negate(x));
emit("common/rounding/floor", floor(x));
emit("common/rounding/ceil", ceil(x));
emit("common/rounding/round", round(x));
emit("common/rounding/truncate", truncate(x));
emit("common/rounding/add_half", sum(x, 0.5));
emit("common/rounding/quotient", product(x, w));
emit("common/rounding/reduce", sum(w, product(-1, z, y)));
emit("common/rounding/double_y", product(2, y));
emit("common/rounding/half_y", product(0.5, y));
const storedRemainderXExponent = internalStorage("w_remainder_x_exponent");
const storedRemainderYExponent = internalStorage("w_remainder_y_exponent");
const storedRemainderShift = internalStorage("w_remainder_shift");
const storedRemainderRemainingShift = internalStorage("w_remainder_remaining_shift");
const storedRemainderScaledDivisor = internalStorage("w_remainder_scaled_divisor");
emit("common/reduce_remainder/shift", sum(storedRemainderXExponent, product(-1, storedRemainderYExponent)));
const remainderShifts = Array.from({ length: 277 }, (_, shift) => ({
  shift,
  factors: [
    Math.min(shift, 127),
    Math.min(Math.max(shift - 127, 0), 127),
    Math.max(shift - 254, 0),
  ].filter(bits => bits > 0).map(bits => 2 ** bits),
}));
for (let stage = 0; stage < 3; stage += 1) {
  const factorPath = `common/reduce_remainder/factor_${stage}`;
  const factorBands = [];
  for (const entry of remainderShifts) {
    const factor = entry.factors[stage] ?? 1;
    const previous = factorBands.at(-1);
    if (previous && Object.is(previous.factor, factor)) previous.maximum = entry.shift;
    else factorBands.push({ maximum: entry.shift, factor });
  }
  emit(factorPath, balancedRangeLookup(
    factorBands,
    storedRemainderShift,
    entry => entry.factor,
  ));
  emit(`common/reduce_remainder/scale_${stage}`, product(
    storedRemainderScaledDivisor,
    `math:${factorPath}`,
  ));
}
emit("common/reduce_remainder/half_scaled_divisor", product(0.5, storedRemainderScaledDivisor));
emit("common/reduce_remainder/decrement_shift", sum(storedRemainderShift, -1));
emit("common/reduce_remainder/decrement_remaining_shift", sum(storedRemainderRemainingShift, -1));
emit("sin/00", sine(x));
emit("cos/00", cosine(x));
emit("tan/00", divide(
  internalStorage("w_tan_sin"),
  internalStorage("w_tan_cos"),
));
// Commands evaluate providers in float context before predicates coerce their
// inputs to integers. Normalize a reciprocal operand with staged float writes,
// keeping every branch decision at least one integer apart.
const stagedReciprocalAbsolute = maximum(x, product(-1, x));
const stagedReciprocalMantissa = product(0.5, stagedReciprocalAbsolute);
const storedReciprocalMantissa = internalStorage("w_reciprocal_mantissa");
const storedReciprocalEstimate = internalStorage("w_reciprocal_estimate");
const storedReciprocalSign = internalStorage("w_reciprocal_sign");
emit("internal/reciprocal/mantissa", stagedReciprocalMantissa);
emit("internal/reciprocal/initial_estimate", sum(
  Math.fround(48 / 17),
  product(Math.fround(-32 / 17), storedReciprocalMantissa),
));
emit("internal/reciprocal/newton", product(
  storedReciprocalEstimate,
  sum(2, product(-1, storedReciprocalMantissa, storedReciprocalEstimate)),
));
emit("internal/reciprocal/compare/below_one", floatComparison(stagedReciprocalAbsolute, 1));
emit("internal/reciprocal/compare/at_least_two", product(
  sum(stagedReciprocalAbsolute, -2),
  Math.fround(2 ** 24),
));
emit("internal/reciprocal/compare/below_half", floatComparison(stagedReciprocalAbsolute, 0.5));
emit("internal/reciprocal/compare/at_least_four", product(
  sum(stagedReciprocalAbsolute, -4),
  Math.fround(2 ** 22),
));
emit("internal/reciprocal/double_x", product(2, x));
emit("internal/reciprocal/double_y", product(2, y));
emit("internal/reciprocal/half_x", product(0.5, x));
emit("internal/reciprocal/half_y", product(0.5, y));
emit("internal/reciprocal/scale_a", product(y, storedNormalizeMultiplierA));
emit("internal/reciprocal/scale_b", product(x, storedNormalizeMultiplierB));
emit("internal/reciprocal/apply_sign", product(x, storedReciprocalSign));
emit("internal/reciprocal/normalized", product(
  x,
  0.25,
  storedReciprocalEstimate,
  storedReciprocalEstimate,
));
const divideAMantissa = internalStorage("w_divide_a_mantissa");
const divideAExponent = internalStorage("w_divide_a_exponent");
const divideBMantissa = internalStorage("w_divide_b_mantissa");
const divideBExponent = internalStorage("w_divide_b_exponent");
const divideExponent = internalStorage("w_divide_exponent");
const divideSign = internalStorage("w_divide_sign");
const divideReciprocal = internalStorage("w_divide_reciprocal");
const divideQuotient = internalStorage("w_divide_quotient");
const divideProductHigh = internalStorage("w_divide_product_high");
const divideProductLow = internalStorage("w_divide_product_low");
const divideResidualHigh = internalStorage("w_divide_residual_high");
const divideResidualLow = internalStorage("w_divide_residual_low");
const divideCorrection = internalStorage("w_divide_correction");
const divideScale = internalStorage("w_divide_scale");
const divideFactor = internalStorage("w_divide_factor");
emit("internal/divide/normalized_reciprocal", product(0.5, storedReciprocalEstimate));
emit("internal/divide/product/high", product(divideBMantissa, divideQuotient));
emit("internal/divide/product/low", twoProductLow(divideBMantissa, divideQuotient));
emit("internal/divide/residual/high", subtractExpression(divideAMantissa, divideProductHigh));
emit("internal/divide/residual/low", sum(
  twoSumLow(divideAMantissa, product(-1, divideProductHigh)),
  product(-1, divideProductLow),
));
emit("internal/divide/correction", product(
  sum(divideResidualHigh, divideResidualLow),
  divideReciprocal,
));
emit("internal/divide/refined_quotient", sum(divideQuotient, divideCorrection));
emit("internal/divide/exponent_difference", sum(divideAExponent, product(-1, divideBExponent)));
emit("internal/divide/flip_sign", product(-1, divideSign));
emit("internal/divide/result", product(
  x,
  divideSign,
  divideFactor,
  divideScale,
));

const storedLogMantissa = internalStorage("w_log_mantissa");
const storedLogReciprocal = internalStorage("w_log_reciprocal");
emit("internal/reciprocal/log_mantissa", product(0.25, x));
emit("internal/reciprocal/log_initial", sum(
  Math.fround(48 / 17),
  product(Math.fround(-32 / 17), storedLogMantissa),
));
emit("internal/reciprocal/log_newton", product(
  storedLogReciprocal,
  sum(2, product(-1, storedLogMantissa, storedLogReciprocal)),
));
emit("internal/reciprocal/log_denominator", product(0.25, storedLogReciprocal));
emitPredicate("comparison/negative_integer", inlineValueCheck(w, undefined, -1));

const sqrtEstimate = internalStorage("w_sqrt_estimate");
const sqrtMantissa = internalStorage("w_sqrt_mantissa");
const sqrtReciprocal = internalStorage("w_sqrt_reciprocal");
const sqrtScale = internalStorage("w_sqrt_scale");
const sqrtEstimateAtLeastTwo = inlineValueCheck(
  internalStorage("w_comparison.sqrt_estimate_at_least_two"),
  0,
  undefined,
);
emit("square_root/normalize/half_exponent", product(0.5, storedNormalizeExponent));
emit("square_root/normalize/mantissa_multiplier", sum(
  1,
  storedNormalizeExponent,
  product(-2, z),
));
emit("square_root/normalize/mantissa", product(
  storedNormalizeMantissa,
  "math:square_root/normalize/mantissa_multiplier",
));
emit("square_root/approximate/00", product(0.5, sum(sqrtMantissa, 1)));
emit("square_root/reciprocal/compare_at_least_two", floatComparison(sqrtEstimate, 2));
emit("square_root/reciprocal/input", numberDispatcher([{
  condition: sqrtEstimateAtLeastTwo,
  number_provider: product(0.5, sqrtEstimate),
}], sqrtEstimate));
emit("square_root/reciprocal/numerator", numberDispatcher([{
  condition: sqrtEstimateAtLeastTwo,
  number_provider: 0.5,
}], 1));
emit("square_root/newton/update", product(0.5, sum(
  sqrtEstimate,
  product(sqrtMantissa, sqrtReciprocal),
)));
emit("square_root/residual", sum(
  product(sqrtEstimate, sqrtEstimate),
  product(-1, sqrtMantissa),
));
emit("square_root/00", squareRoot(x));

// Center the logarithm mantissa around one. Keeping the shared normalizer's
// raw [1, 2) interval causes cancellation in log(m) + e*ln(2) for inputs near
// one; [1/sqrt(2), sqrt(2)] keeps the relative error within the public bound.
emit("log/normalize/compare_center/00", product(
  sum(storedNormalizeMantissa, -Math.fround(Math.SQRT2)),
  Math.fround(2 ** 23),
));
const logBelowCenter = inlineValueCheck(internalStorage("w_comparison.log_center"), undefined, -1);
emit("log/normalize/centered_mantissa/00", numberDispatcher([{
  condition: logBelowCenter,
  number_provider: storedNormalizeMantissa,
}], product(0.5, storedNormalizeMantissa)));
emit("log/normalize/centered_exponent/00", numberDispatcher([{
  condition: logBelowCenter,
  number_provider: storedNormalizeExponent,
}], sum(storedNormalizeExponent, 1)));
emit("log/normalize/numerator/00", sum(z, -1));
emit("log/normalize/denominator/00", sum(z, 2));
emit("log/normalize/u/00", product(x, z));

const logUSquared = product(z, z);
const logHorner = sum(1, product(logUSquared, sum(
  Math.fround(1 / 3),
  product(logUSquared, sum(
    Math.fround(1 / 5),
    product(logUSquared, sum(
      Math.fround(1 / 7),
      product(logUSquared, sum(
        Math.fround(1 / 9),
        product(logUSquared, Math.fround(1 / 11)),
      )),
    )),
  )),
)));
emit("log/polynomial/00", product(2, z, logHorner));
emit("log/00", sum(
  "math:log/polynomial/00",
  product(w, Math.fround(Math.LN2)),
));

emit("exp/reduce/quotient/00", product(x, Math.fround(1 / Math.LN2)));
emit("exp/reduce/remainder/00", sum(w, product(-Math.fround(Math.LN2), z)));
emit("exp/minimum/00", smallestPositiveFloat);
emit("exp/minimum/negative/00", -smallestPositiveFloat);

let expPolynomial = Math.fround(1 / 40320);
for (const coefficient of [1 / 5040, 1 / 720, 1 / 120, 1 / 24, 1 / 6, 1 / 2, 1, 1]) {
  expPolynomial = sum(Math.fround(coefficient), product(x, expPolynomial));
}
emit("exp/polynomial/00", expPolynomial);

const expScaleBands = [];
for (let exponent = -150; exponent <= 128; exponent += 1) {
  expScaleBands.push({
    exponent,
    scale: exponent === -150
      ? smallestPositiveFloat
      : exponent === 128
        ? Math.fround(2 ** 127)
        : Math.fround(2 ** exponent),
  });
}
const supportedExpExponent = inlineValueCheck(z, -150, 128);
emit("exp/scale/00", numberDispatcher([{
  condition: supportedExpExponent,
  number_provider: balancedNumberLookup(expScaleBands, (band) => band.scale),
}]));
emit("exp/factor/00", numberDispatcher([{
  condition: supportedExpExponent,
  number_provider: numberDispatcher([
    {
      condition: inlineValueCheck(z, -150, -150),
      number_provider: 0.5,
    },
    {
      condition: inlineValueCheck(z, 128, 128),
      number_provider: 2,
    },
  ], 1),
}]));
emit("exp/00", product(
  "math:exp/polynomial/00",
  "math:exp/factor/00",
  "math:exp/scale/00",
));

const atanPiFour = Math.fround(Math.PI / 4);
const atanHalfPi = Math.fround(Math.PI / 2);
const atanPi = Math.fround(Math.PI);
const atanOctantBoundary = Math.fround(Math.SQRT2 - 1);
let atanPolynomial = Math.fround(1 / 13);
for (const coefficient of [-1 / 11, 1 / 9, -1 / 7, 1 / 5, -1 / 3]) {
  atanPolynomial = sum(Math.fround(coefficient), product(atanSquare, atanPolynomial));
}
atanPolynomial = product(x, sum(1, product(atanSquare, atanPolynomial)));
emit("common/atan/square", product(x, x));
emit("common/atan/polynomial", atanPolynomial);
emit("common/atan/numerator", sum(x, -1));
emit("common/atan/denominator", sum(x, 1));
emit("common/atan/reduced", product(atanNumerator, x));
emit("common/atan/pi_four", atanPiFour);
emit("common/atan/half_pi", atanHalfPi);
emit("common/atan/pi", atanPi);
emit("common/atan/after_pi_four", sum(atanPiFour, x));
emit("common/atan/after_reciprocal", sum(atanHalfPi, product(-1, x)));

emit("atan2/absolute_a", maximum(publicA, product(-1, publicA)));
emit("atan2/absolute_b", maximum(publicB, product(-1, publicB)));
emit("atan2/minimum", minimum(atan2AbsoluteA, atan2AbsoluteB));
emit("atan2/maximum", maximum(atan2AbsoluteA, atan2AbsoluteB));
emit("atan2/scaled_minimum", product(atan2Minimum, 2 ** 126));
emit("atan2/scaled_maximum", product(atan2Maximum, 2 ** 126));
emit("atan2/ratio", product(atan2Minimum, x));
emit("atan2/from_y_axis", sum(atanHalfPi, product(-1, x)));
emit("atan2/from_negative_x", sum(atanPi, product(-1, x)));

const quaternionMaximum = maximum(...quaternionComponents.flatMap(component => [component, product(-1, component)]));
const quaternionScaleMultiplierA = internalStorage("w_quaternion_scale_multiplier_a");
const quaternionScaleMultiplierB = internalStorage("w_quaternion_scale_multiplier_b");
const quaternionMaximumMantissa = internalStorage("w_quaternion_maximum_mantissa");
const quaternionInverseMaximumMantissa = internalStorage("w_quaternion_inverse_maximum_mantissa");
const quaternionInverseLength = internalStorage("w_quaternion_inverse_length");
const quaternionVectorMaximum = internalStorage("w_quaternion_vector_maximum");
const quaternionVectorScaleMultiplierA = internalStorage("w_quaternion_vector_scale_multiplier_a");
const quaternionVectorScaleMultiplierB = internalStorage("w_quaternion_vector_scale_multiplier_b");
const quaternionVectorMaximumMantissa = internalStorage("w_quaternion_vector_maximum_mantissa");
const quaternionInverseVectorMaximumMantissa = internalStorage("w_quaternion_inverse_vector_maximum_mantissa");
const quaternionVectorScaledRaw = Array.from({ length: 3 }, (_, index) => internalStorage(`w_quaternion_vector_scaled_raw_${index}`));
const quaternionVectorScaled = Array.from({ length: 3 }, (_, index) => internalStorage(`w_quaternion_vector_scaled_${index}`));
const quaternionInverseVectorLength = internalStorage("w_quaternion_inverse_vector_length");
const quaternionAngle = internalStorage("w_quaternion_angle");

emit("quaternion_to_axis_angle/normalize/maximum", quaternionMaximum);
for (let index = 0; index < 4; index += 1) {
  emit(`quaternion_to_axis_angle/normalize/scaled_raw_${index}`, product(
    quaternionComponents[index],
    quaternionScaleMultiplierA,
    quaternionScaleMultiplierB,
  ));
  emit(`quaternion_to_axis_angle/normalize/scaled_${index}`, product(
    quaternionScaledRaw[index],
    quaternionInverseMaximumMantissa,
  ));
}
emit("quaternion_to_axis_angle/normalize/scaled_square_sum", sum(
  ...quaternionScaled.map(component => product(component, component)),
));
emit("quaternion_to_axis_angle/normalize/normalized_0", product(quaternionScaled[0], quaternionInverseLength));
emit("quaternion_to_axis_angle/normalize/normalized_1", product(quaternionScaled[1], quaternionInverseLength));
emit("quaternion_to_axis_angle/normalize/normalized_2", product(quaternionScaled[2], quaternionInverseLength));
emit("quaternion_to_axis_angle/normalize/normalized_3", product(quaternionScaled[3], quaternionInverseLength));
emit("quaternion_to_axis_angle/normalize/clamped_w", maximum(-1, minimum(1, quaternionNormalized[3])));

emit("quaternion_to_axis_angle/vector/maximum", maximum(
  ...quaternionComponents.slice(0, 3).flatMap(component => [component, product(-1, component)]),
));
for (let index = 0; index < 3; index += 1) {
  emit(`quaternion_to_axis_angle/vector/scaled_raw_${index}`, product(
    quaternionComponents[index],
    quaternionVectorScaleMultiplierA,
    quaternionVectorScaleMultiplierB,
  ));
  emit(`quaternion_to_axis_angle/vector/scaled_${index}`, product(
    quaternionVectorScaledRaw[index],
    quaternionInverseVectorMaximumMantissa,
  ));
}
emit("quaternion_to_axis_angle/vector/scaled_square_sum", sum(
  ...quaternionVectorScaled.map(component => product(component, component)),
));
for (let index = 0; index < 3; index += 1) {
  emit(`quaternion_to_axis_angle/output/axis_${index}`, product(
    quaternionVectorScaled[index],
    quaternionInverseVectorLength,
  ));
}
emit("quaternion_to_axis_angle/output/angle", product(2, x));
emit("quaternion_to_axis_angle/output/stored_angle", quaternionAngle);
for (let index = 0; index < 3; index += 1) {
  emit(`quaternion_to_axis_angle/output/stored_axis_${index}`, quaternionAxis[index]);
}

emitStagedPredicate("atan/x_negative", x, undefined, smallestNegativeFloat);
emitStagedPredicate("atan/use_reciprocal", x, nextPositiveFloat(1), undefined);
emitStagedPredicate("atan/use_pi_four", x, atanOctantBoundary, undefined);
emitStagedPredicate("atan2/a_negative", publicA, undefined, smallestNegativeFloat);
emitStagedPredicate("atan2/b_negative", publicB, undefined, smallestNegativeFloat);
emitStagedPredicate("atan2/a_dominant", subtractExpression(atan2AbsoluteA, atan2AbsoluteB), smallestPositiveFloat, undefined);
emitStagedPredicate("atan2/maximum_zero", atan2Maximum, 0, 0);
emitStagedPredicate("atan2/maximum_subnormal", atan2Maximum, undefined, largestSubnormalFloat);
emitStagedPredicate("bezier/time_at_or_below_start", publicT, undefined, 0);
emitStagedPredicate("bezier/time_at_or_after_end", subtractExpression(publicT, publicMax), 0, undefined);
emitStagedPredicate("elastic/time_at_or_below_start", publicT, undefined, 0);
emitStagedPredicate("elastic/time_at_or_after_end", subtractExpression(publicT, publicMax), 0, undefined);
emitStagedPredicate("elastic_decay/time_at_or_below_start", publicT, undefined, 0);
emitStagedPredicate("elastic_decay/time_at_or_after_end", subtractExpression(publicT, publicMax), 0, undefined);
emitStagedPredicate("bounce/time_at_or_below_start", publicT, undefined, 0);
emitStagedPredicate("bounce/time_at_or_after_end", subtractExpression(publicT, publicMax), 0, undefined);
emitStagedPredicate("bounce/duration_subnormal", publicMax, undefined, largestSubnormalFloat);
emitStagedPredicate("bounce_decay/time_at_or_below_start", publicT, undefined, 0);
emitStagedPredicate("bounce_decay/time_at_or_after_end", subtractExpression(publicT, publicMax), 0, undefined);
emit("internal/comparison/x_zero", floatComparison(x, 0));
emitPredicate("range/negative", inlineValueCheck(internalStorage("w_comparison.x_sign"), undefined, -1));
emitPredicate("range/positive", inlineValueCheck(internalStorage("w_comparison.x_sign"), 1, undefined));
emitPredicate("asin_positive/before_target", inlineValueCheck(
  internalStorage("w_comparison.asin_positive_before_target"),
  undefined,
  -1,
));
emitStagedPredicate("inverse_trigonometry/x_negative", x, undefined, smallestNegativeFloat);
emitStagedPredicate("inverse_trigonometry/use_complement", x, 0.995, undefined);
for (let index = 0; index < 4; index += 1) {
  emitStagedPredicate(
    `quaternion_to_axis_angle/scaled_${index}_positive_maximum`,
    subtractExpression(quaternionScaledRaw[index], quaternionMaximumMantissa),
    0,
    0,
  );
  emitStagedPredicate(
    `quaternion_to_axis_angle/scaled_${index}_negative_maximum`,
    sum(quaternionScaledRaw[index], quaternionMaximumMantissa),
    0,
    0,
  );
}
emitStagedPredicate("quaternion_to_axis_angle/vector_zero", quaternionVectorMaximum, 0, 0);
for (let index = 0; index < 3; index += 1) {
  emitStagedPredicate(
    `quaternion_to_axis_angle/vector_${index}_positive_maximum`,
    subtractExpression(quaternionVectorScaledRaw[index], quaternionVectorMaximumMantissa),
    0,
    0,
  );
  emitStagedPredicate(
    `quaternion_to_axis_angle/vector_${index}_negative_maximum`,
    sum(quaternionVectorScaledRaw[index], quaternionVectorMaximumMantissa),
    0,
    0,
  );
}
emitStagedPredicate(
  "quaternion_to_axis_angle/scalar_negative",
  quaternionComponents[3],
  undefined,
  smallestNegativeFloat,
);
emitPredicate("inverse_trigonometry/square_before_target", inlineValueCheck(
  internalStorage("w_comparison.inverse_trigonometry_square_before_target"),
  undefined,
  -1,
));
emitStagedPredicate("exp/underflows_to_zero", x, undefined, maximumZeroExpInput);
emitStagedPredicate("rounding/remainder/can_subtract_y", sum(x, product(-1, y)), 0, undefined);
// With x >= y, x - y is exact while x < 2y (Sterbenz's lemma), and cannot
// round back down to y once x > 2y. This avoids the lossy 0.5*x subnormal
// guard without overflowing at the top-end divisor-doubling boundary.
emitStagedPredicate("rounding/remainder/within_double", subtractExpression(y, subtractExpression(x, y)), smallestPositiveFloat, undefined);
emitStagedPredicate("rounding/remainder/near_ratio", sum(y, product(-0.125, x)), smallestPositiveFloat, undefined);
emitStagedPredicate("rounding/remainder/w_greater_than_x", sum(w, product(-1, x)), -smallestNegativeFloat, undefined);
emitStagedPredicate("rounding/remainder/y_too_large_to_double", y, 2 ** 127, undefined);
emitStagedPredicate("rounding/remainder/zero", z, 0, 0);
emitPredicate("rounding/remainder/shift_positive", inlineValueCheck(storedRemainderRemainingShift, 1, undefined));
emitStagedPredicate("rounding/public/a_negative", publicA, undefined, smallestNegativeFloat);
emitStagedPredicate("rounding/public/b_negative", publicB, undefined, smallestNegativeFloat);

emit("common/asin_positive/half_pi", halfPi);
emit("common/inverse_trigonometry/half_pi", halfPi);
emit("common/inverse_trigonometry/pi", pi);
emit("common/inverse_trigonometry/complement", sum(1, product(-1, x, x)));
emit("common/inverse_trigonometry/square_midpoint", product(0.5, sum(
  internalStorage("w_inverse_trigonometry_square_low"),
  internalStorage("w_inverse_trigonometry_square_high"),
)));
emit("common/inverse_trigonometry/square_compare", floatComparison(
  sum(
    product(internalStorage("w_inverse_trigonometry_square_midpoint"), internalStorage("w_inverse_trigonometry_square_midpoint")),
    product(-1, internalStorage("w_inverse_trigonometry_square_target")),
  ),
  0,
));
emit("common/inverse_trigonometry/acos", sum(
  internalStorage("w_inverse_trigonometry_half_pi"),
  product(-1, x),
));
emit("common/asin_positive/midpoint", product(0.5, sum(
  internalStorage("w_asin_low"),
  internalStorage("w_asin_high"),
)));
emit("common/asin_positive/compare", floatComparison(
  sum(
    internalStorage("w_asin_sine"),
    product(-1, internalStorage("w_asin_target")),
  ),
  0,
));

emitFunction(FUNCTION_PATHS.asinPositive, [
  "data modify storage math:internal w_asin_target set from storage math:internal x",
  "data modify storage math:internal w_asin_low set value 0.0f",
  "data modify storage math:internal w_asin_high set compute default math:common/asin_positive/half_pi",
  ...Array.from({ length: 20 }, () => `function ${functionId(FUNCTION_PATHS.asinPositiveStep)}`),
  "data modify storage math:internal x set compute default math:common/asin_positive/midpoint",
  "return 1",
]);

emitFunction(FUNCTION_PATHS.asinPositiveStep, [
  "data modify storage math:internal w_asin_midpoint set compute default math:common/asin_positive/midpoint",
  "data modify storage math:internal x set from storage math:internal w_asin_midpoint",
  `function ${functionId(FUNCTION_PATHS.sin)}`,
  "data modify storage math:internal w_asin_sine set from storage math:internal x",
  "data modify storage math:internal w_comparison.asin_positive_before_target set compute default math:common/asin_positive/compare",
  "execute if predicate math:internal/asin_positive/before_target run data modify storage math:internal w_asin_low set from storage math:internal w_asin_midpoint",
  "execute unless predicate math:internal/asin_positive/before_target run data modify storage math:internal w_asin_high set from storage math:internal w_asin_midpoint",
  "return 1",
]);

emitFunction(FUNCTION_PATHS.inverseTrigonometrySquareRoot, [
  "data modify storage math:internal w_inverse_trigonometry_square_low set value 0.0f",
  "data modify storage math:internal w_inverse_trigonometry_square_high set value 0.125f",
  ...Array.from({ length: 18 }, () => `function ${functionId(FUNCTION_PATHS.inverseTrigonometrySquareRootStep)}`),
  "data modify storage math:internal x set compute default math:common/inverse_trigonometry/square_midpoint",
  "return 1",
]);

emitFunction(FUNCTION_PATHS.inverseTrigonometrySquareRootStep, [
  "data modify storage math:internal w_inverse_trigonometry_square_midpoint set compute default math:common/inverse_trigonometry/square_midpoint",
  "data modify storage math:internal w_comparison.inverse_trigonometry_square_before_target set compute default math:common/inverse_trigonometry/square_compare",
  "execute if predicate math:internal/inverse_trigonometry/square_before_target run data modify storage math:internal w_inverse_trigonometry_square_low set from storage math:internal w_inverse_trigonometry_square_midpoint",
  "execute unless predicate math:internal/inverse_trigonometry/square_before_target run data modify storage math:internal w_inverse_trigonometry_square_high set from storage math:internal w_inverse_trigonometry_square_midpoint",
  "return 1",
]);

// The public functions stage a binary32 x in [-1, 1] and these internal entry
// points leave their radians result in x.
emitFunction(FUNCTION_PATHS.asinNegativeOne, [
  "data modify storage math:internal x set compute default math:common/inverse_trigonometry/half_pi",
  "return run data modify storage math:internal x set compute default math:common/rounding/negate",
]);

emitFunction(FUNCTION_PATHS.asinComplement, [
  "data modify storage math:internal w_inverse_trigonometry_square_target set compute default math:common/inverse_trigonometry/complement",
  `function ${functionId(FUNCTION_PATHS.inverseTrigonometrySquareRoot)}`,
  `function ${functionId(FUNCTION_PATHS.asinPositive)}`,
  "data modify storage math:internal w_inverse_trigonometry_half_pi set compute default math:common/inverse_trigonometry/half_pi",
  "data modify storage math:internal x set compute default math:common/inverse_trigonometry/acos",
]);

emitFunction(FUNCTION_PATHS.asin, [
  "data modify storage math:internal w_inverse_trigonometry_input set from storage math:internal x",
  `execute if data storage math:internal {w_inverse_trigonometry_input:-1.0f} run return run function ${functionId(FUNCTION_PATHS.asinNegativeOne)}`,
  "execute if data storage math:internal {w_inverse_trigonometry_input:0.0f} run return 1",
  "execute if data storage math:internal {w_inverse_trigonometry_input:1.0f} run data modify storage math:internal x set compute default math:common/inverse_trigonometry/half_pi",
  "execute if data storage math:internal {w_inverse_trigonometry_input:1.0f} run return 1",
  ...stagePredicate("inverse_trigonometry/x_negative"),
  "execute if predicate math:internal/inverse_trigonometry/x_negative run data modify storage math:internal x set compute default math:common/rounding/negate",
  ...stagePredicate("inverse_trigonometry/use_complement"),
  `execute if predicate math:internal/inverse_trigonometry/use_complement run function ${functionId(FUNCTION_PATHS.asinComplement)}`,
  `execute unless predicate math:internal/inverse_trigonometry/use_complement run function ${functionId(FUNCTION_PATHS.asinPositive)}`,
  "execute if predicate math:internal/inverse_trigonometry/x_negative run data modify storage math:internal x set compute default math:common/rounding/negate",
  "return 1",
]);

emitFunction(FUNCTION_PATHS.acos, [
  "data modify storage math:internal w_inverse_trigonometry_input set from storage math:internal x",
  "execute if data storage math:internal {w_inverse_trigonometry_input:-1.0f} run data modify storage math:internal x set compute default math:common/inverse_trigonometry/pi",
  "execute if data storage math:internal {w_inverse_trigonometry_input:-1.0f} run return 1",
  "execute if data storage math:internal {w_inverse_trigonometry_input:0.0f} run data modify storage math:internal x set compute default math:common/inverse_trigonometry/half_pi",
  "execute if data storage math:internal {w_inverse_trigonometry_input:0.0f} run return 1",
  "execute if data storage math:internal {w_inverse_trigonometry_input:1.0f} run data modify storage math:internal x set value 0.0f",
  "execute if data storage math:internal {w_inverse_trigonometry_input:1.0f} run return 1",
  `function ${functionId(FUNCTION_PATHS.asin)}`,
  "data modify storage math:internal w_inverse_trigonometry_half_pi set compute default math:common/inverse_trigonometry/half_pi",
  "data modify storage math:internal x set compute default math:common/inverse_trigonometry/acos",
  "return 1",
]);

function inverseTrigonometryPublicLines(sharedFunction, degrees = false) {
  const lines = [];
  lines.push("data modify storage math:internal x set compute default math:common/input/a");
  lines.push(`function ${functionId(sharedFunction)}`);
  if (degrees) lines.push("data modify storage math:internal x set compute default math:common/conversion/deg");
  lines.push("data modify storage math: ans set from storage math:internal x");
  return lines;
}

emitDirectPublicFunction("asin", inverseTrigonometryPublicLines(FUNCTION_PATHS.asin));
emitDirectPublicFunction("asin_degrees", inverseTrigonometryPublicLines(FUNCTION_PATHS.asin, true));
emitDirectPublicFunction("acos", inverseTrigonometryPublicLines(FUNCTION_PATHS.acos));
emitDirectPublicFunction("acos_degrees", inverseTrigonometryPublicLines(FUNCTION_PATHS.acos, true));

emitFunction(FUNCTION_PATHS.atanReciprocal, [
  "data modify storage math:internal y set value 1.0f",
  `return run function ${functionId(FUNCTION_PATHS.reciprocal)}`,
]);

emitFunction(FUNCTION_PATHS.atanPiFour, [
  "data modify storage math:internal w_atan_numerator set compute default math:common/atan/numerator",
  "data modify storage math:internal x set compute default math:common/atan/denominator",
  "data modify storage math:internal y set value 1.0f",
  `function ${functionId(FUNCTION_PATHS.reciprocal)}`,
  "data modify storage math:internal x set compute default math:common/atan/reduced",
]);

emitFunction(FUNCTION_PATHS.atan, [
  "data modify storage math:internal w_atan_input set from storage math:internal x",
  "execute if data storage math:internal {w_atan_input:0.0f} run return 1",
  ...stagePredicate("atan/x_negative"),
  "data modify storage math:internal x set compute default math:common/comparison/absolute",
  ...stagePredicate("atan/use_reciprocal"),
  `execute if predicate math:internal/atan/use_reciprocal run function ${functionId(FUNCTION_PATHS.atanReciprocal)}`,
  ...stagePredicate("atan/use_pi_four"),
  `execute if predicate math:internal/atan/use_pi_four run function ${functionId(FUNCTION_PATHS.atanPiFour)}`,
  "data modify storage math:internal w_atan_square set compute default math:common/atan/square",
  "data modify storage math:internal x set compute default math:common/atan/polynomial",
  "execute if predicate math:internal/atan/use_pi_four run data modify storage math:internal x set compute default math:common/atan/after_pi_four",
  "execute if predicate math:internal/atan/use_reciprocal run data modify storage math:internal x set compute default math:common/atan/after_reciprocal",
  "execute if predicate math:internal/atan/x_negative run data modify storage math:internal x set compute default math:common/rounding/negate",
  "return 1",
]);

function atanPublicLines(degrees = false) {
  const lines = [];
  lines.push("data modify storage math:internal x set compute default math:common/input/a");
  lines.push(`function ${functionId(FUNCTION_PATHS.atan)}`);
  if (degrees) lines.push("data modify storage math:internal x set compute default math:common/conversion/deg");
  lines.push("data modify storage math: ans set from storage math:internal x");
  return lines;
}

emitDirectPublicFunction("atan", atanPublicLines());
emitDirectPublicFunction("atan_degrees", atanPublicLines(true));

function atan2PublicLines(degrees = false) {
  const lines = [];
  lines.push("data modify storage math:internal w_atan2_absolute_a set compute default math:atan2/absolute_a");
  lines.push("data modify storage math:internal w_atan2_absolute_b set compute default math:atan2/absolute_b");
  lines.push("data modify storage math:internal w_atan2_minimum set compute default math:atan2/minimum");
  lines.push("data modify storage math:internal w_atan2_maximum set compute default math:atan2/maximum");
  lines.push(...stagePredicate("atan2/maximum_zero"));
  lines.push("execute if predicate math:internal/atan2/maximum_zero run data modify storage math: ans set value 0.0f");
  lines.push("execute if predicate math:internal/atan2/maximum_zero run return 1");
  lines.push(...stagePredicate("atan2/a_dominant"));
  lines.push(...stagePredicate("atan2/a_negative"));
  lines.push(...stagePredicate("atan2/b_negative"));
  lines.push(...stagePredicate("atan2/maximum_subnormal"));
  lines.push(`execute if predicate math:internal/atan2/maximum_subnormal run function ${functionId(FUNCTION_PATHS.atan2ScaleSubnormal)}`);
  lines.push("data modify storage math:internal x set from storage math:internal w_atan2_maximum");
  lines.push("data modify storage math:internal y set value 1.0f");
  lines.push(`function ${functionId(FUNCTION_PATHS.reciprocal)}`);
  lines.push("data modify storage math:internal x set compute default math:atan2/ratio");
  lines.push(`function ${functionId(FUNCTION_PATHS.atan)}`);
  lines.push("execute if predicate math:internal/atan2/a_dominant run data modify storage math:internal x set compute default math:atan2/from_y_axis");
  lines.push("execute if predicate math:internal/atan2/b_negative run data modify storage math:internal x set compute default math:atan2/from_negative_x");
  lines.push("execute if predicate math:internal/atan2/a_negative run data modify storage math:internal x set compute default math:common/rounding/negate");
  if (degrees) lines.push("data modify storage math:internal x set compute default math:common/conversion/deg");
  lines.push("data modify storage math: ans set from storage math:internal x");
  return lines;
}

emitFunction(FUNCTION_PATHS.atan2ScaleSubnormal, [
  "data modify storage math:internal w_atan2_minimum set compute default math:atan2/scaled_minimum",
  "data modify storage math:internal w_atan2_maximum set compute default math:atan2/scaled_maximum",
]);

emitControlledPublicFunction("atan2", FUNCTION_PATHS.atan2Compute, atan2PublicLines());
emitControlledPublicFunction("atan2_degrees", FUNCTION_PATHS.atan2DegreesCompute, atan2PublicLines(true));

const elasticAmplitude = internalStorage("w_elastic_amplitude");
const elasticPhase = internalStorage("w_elastic_phase");
const elasticInversePeriod = internalStorage("w_elastic_inverse_period");
const elasticU = internalStorage("w_elastic_u");
const elasticDecay = internalStorage("w_elastic_decay");
const elasticSine = internalStorage("w_elastic_sine");
const elasticEased = internalStorage("w_elastic_eased");
const elasticDecayU = internalStorage("w_elastic_decay_u");
const elasticDecayFactor = internalStorage("w_elastic_decay_factor");
const elasticDecayCosine = internalStorage("w_elastic_decay_cosine");
const elasticDecayEased = internalStorage("w_elastic_decay_eased");
const interpolationResult = (eased) => sum(publicA, product(eased, sum(publicB, product(-1, publicA))));

emit("elastic/input/amplitude", publicAmplitude);
emit("elastic/phase", product(publicPeriod, x, Math.fround(1 / (Math.PI * 2))));
emit("elastic/u", product(publicT, x));
emit("elastic/exponent", product(Math.fround(-10 * Math.LN2), elasticU));
emit("elastic/angle", product(sum(publicT, product(-1, elasticPhase)), tau, elasticInversePeriod));
emit("elastic/eased", sum(1, product(elasticAmplitude, elasticDecay, elasticSine)));
emit("elastic/result", interpolationResult(elasticEased));
emit("elastic_decay/u", product(publicT, x));
emit("elastic_decay/exponent", product(-1, publicDamping, elasticDecayU));
emit("elastic_decay/angle", product(tau, publicOscillations, elasticDecayU));
emit("elastic_decay/eased", sum(1, product(-1, elasticDecayFactor, elasticDecayCosine)));
emit("elastic_decay/result", interpolationResult(elasticDecayEased));

emitFunction(FUNCTION_PATHS.elasticPhase, [
  "data modify storage math:internal w_elastic_phase set compute default math:elastic/phase",
  "data modify storage math:internal x set from storage math: max",
  "data modify storage math:internal y set value 1.0f",
  `function ${functionId(FUNCTION_PATHS.reciprocal)}`,
  "data modify storage math:internal w_elastic_u set compute default math:elastic/u",
  "data modify storage math:internal x set compute default math:elastic/exponent",
  `function ${functionId(FUNCTION_PATHS.exp)}`,
  "data modify storage math:internal w_elastic_decay set from storage math:internal x",
  "data modify storage math:internal x set from storage math: period",
  "data modify storage math:internal y set value 1.0f",
  `function ${functionId(FUNCTION_PATHS.reciprocal)}`,
  "data modify storage math:internal w_elastic_inverse_period set from storage math:internal x",
  "data modify storage math:internal x set compute default math:elastic/angle",
  `function ${functionId(FUNCTION_PATHS.sin)}`,
  "data modify storage math:internal w_elastic_sine set from storage math:internal x",
  "data modify storage math:internal w_elastic_eased set compute default math:elastic/eased",
  "data modify storage math: ans set compute default math:elastic/result",
]);

emitFunction(FUNCTION_PATHS.elasticUnitAmplitude, [
  "data modify storage math:internal x set compute default math:common/asin_positive/half_pi",
  `return run function ${functionId(FUNCTION_PATHS.elasticPhase)}`,
]);

{
  const lines = [];
  lines.push("data modify storage math:internal w_elastic_amplitude set compute default math:elastic/input/amplitude");
  lines.push(...stagePredicate("elastic/time_at_or_below_start"));
  lines.push("execute if predicate math:internal/elastic/time_at_or_below_start run data modify storage math: ans set from storage math: a");
  lines.push("execute if predicate math:internal/elastic/time_at_or_below_start run return 1");
  lines.push(...stagePredicate("elastic/time_at_or_after_end"));
  lines.push("execute if predicate math:internal/elastic/time_at_or_after_end run data modify storage math: ans set from storage math: b");
  lines.push("execute if predicate math:internal/elastic/time_at_or_after_end run return 1");
  lines.push(`execute if data storage math:internal {w_elastic_amplitude:1.0f} run return run function ${functionId(FUNCTION_PATHS.elasticUnitAmplitude)}`);
  lines.push("data modify storage math:internal x set from storage math:internal w_elastic_amplitude");
  lines.push("data modify storage math:internal y set value 1.0f");
  lines.push(`function ${functionId(FUNCTION_PATHS.reciprocal)}`);
  lines.push(`function ${functionId(FUNCTION_PATHS.asinPositive)}`);
  lines.push(`function ${functionId(FUNCTION_PATHS.elasticPhase)}`);
  emitControlledPublicFunction("elastic", FUNCTION_PATHS.elasticCompute, lines);
}

{
  const lines = [];
  lines.push(...stagePredicate("elastic_decay/time_at_or_below_start"));
  lines.push("execute if predicate math:internal/elastic_decay/time_at_or_below_start run data modify storage math: ans set from storage math: a");
  lines.push("execute if predicate math:internal/elastic_decay/time_at_or_below_start run return 1");
  lines.push(...stagePredicate("elastic_decay/time_at_or_after_end"));
  lines.push("execute if predicate math:internal/elastic_decay/time_at_or_after_end run data modify storage math: ans set from storage math: b");
  lines.push("execute if predicate math:internal/elastic_decay/time_at_or_after_end run return 1");
  lines.push("data modify storage math:internal x set from storage math: max");
  lines.push("data modify storage math:internal y set value 1.0f");
  lines.push(`function ${functionId(FUNCTION_PATHS.reciprocal)}`);
  lines.push("data modify storage math:internal w_elastic_decay_u set compute default math:elastic_decay/u");
  lines.push("data modify storage math:internal x set compute default math:elastic_decay/exponent");
  lines.push(`function ${functionId(FUNCTION_PATHS.exp)}`);
  lines.push("data modify storage math:internal w_elastic_decay_factor set from storage math:internal x");
  lines.push("data modify storage math:internal x set compute default math:elastic_decay/angle");
  lines.push(`function ${functionId(FUNCTION_PATHS.cos)}`);
  lines.push("data modify storage math:internal w_elastic_decay_cosine set from storage math:internal x");
  lines.push("data modify storage math:internal w_elastic_decay_eased set compute default math:elastic_decay/eased");
  lines.push("data modify storage math: ans set compute default math:elastic_decay/result");
  emitControlledPublicFunction("elastic_decay", FUNCTION_PATHS.elasticDecayCompute, lines);
}

const bounceU = internalStorage("w_bounce_u");
const bounceEased = internalStorage("w_bounce_eased");
const bounceDecayU = internalStorage("w_bounce_decay_u");
const bounceDecayFactor = internalStorage("w_bounce_decay_factor");
const bounceDecayWave = internalStorage("w_bounce_decay_wave");
const bounceDecayEased = internalStorage("w_bounce_decay_eased");
const bounceCoefficient = Math.fround(7.5625);
const shiftedBounce = (offset, base) => sum(base, product(
  bounceCoefficient,
  sum(bounceU, -offset),
  sum(bounceU, -offset),
));

const bounceScaledT = internalStorage("w_bounce_scaled_t");
emit("bounce/scaled_t", product(publicT, 2 ** 126));
emit("bounce/scaled_max", product(publicMax, 2 ** 126));
emit("bounce/u", product(bounceScaledT, x));
const bounceComparisons = [4 / 11, 8 / 11, 10 / 11].map((threshold, index) => {
  const comparison = internalStorage(`w_comparison.bounce_${index}`);
  emit(`bounce/compare_${index}`, floatComparison(bounceU, Math.fround(threshold)));
  return comparison;
});
emit("bounce/eased", numberDispatcher([
  {
    condition: inlineValueCheck(bounceComparisons[0], undefined, 0),
    number_provider: product(bounceCoefficient, bounceU, bounceU),
  },
  {
    condition: inlineValueCheck(bounceComparisons[1], undefined, 0),
    number_provider: shiftedBounce(Math.fround(6 / 11), Math.fround(0.75)),
  },
  {
    condition: inlineValueCheck(bounceComparisons[2], undefined, 0),
    number_provider: shiftedBounce(Math.fround(9 / 11), Math.fround(0.9375)),
  },
], shiftedBounce(Math.fround(21 / 22), Math.fround(0.984375))));
emit("bounce/result", interpolationResult(bounceEased));
emit("bounce_decay/u", product(bounceScaledT, x));
emit("bounce_decay/exponent", product(-1, publicDecay, bounceDecayU));
emit("bounce_decay/phase", sum(product(sum(publicBounces, 0.5), bounceDecayU), 0.5));
const bounceDecayCenteredPhase = sum(product(2, sum(x, product(-1, z))), -1);
emit("bounce_decay/wave", sum(1, product(-1, bounceDecayCenteredPhase, bounceDecayCenteredPhase)));
emit("bounce_decay/eased", sum(1, product(
  -1,
  bounceDecayFactor,
  bounceDecayWave,
)));
emit("bounce_decay/result", interpolationResult(bounceDecayEased));

emitFunction(FUNCTION_PATHS.bounceScaleSubnormal, [
  "data modify storage math:internal w_bounce_scaled_t set compute default math:bounce/scaled_t",
  "data modify storage math:internal x set compute default math:bounce/scaled_max",
]);

{
  const lines = [];
  lines.push(...stagePredicate("bounce/time_at_or_below_start"));
  lines.push("execute if predicate math:internal/bounce/time_at_or_below_start run data modify storage math: ans set compute default math:common/input/a");
  lines.push("execute if predicate math:internal/bounce/time_at_or_below_start run return 1");
  lines.push(...stagePredicate("bounce/time_at_or_after_end"));
  lines.push("execute if predicate math:internal/bounce/time_at_or_after_end run data modify storage math: ans set compute default math:common/input/b");
  lines.push("execute if predicate math:internal/bounce/time_at_or_after_end run return 1");
  lines.push("data modify storage math:internal w_bounce_scaled_t set from storage math: t");
  lines.push("data modify storage math:internal x set from storage math: max");
  lines.push(...stagePredicate("bounce/duration_subnormal"));
  lines.push(`execute if predicate math:internal/bounce/duration_subnormal run function ${functionId(FUNCTION_PATHS.bounceScaleSubnormal)}`);
  lines.push("data modify storage math:internal y set value 1.0f");
  lines.push(`function ${functionId(FUNCTION_PATHS.reciprocal)}`);
  lines.push("data modify storage math:internal w_bounce_u set compute default math:bounce/u");
  for (let index = 0; index < bounceComparisons.length; index += 1) {
    lines.push(`data modify storage math:internal w_comparison.bounce_${index} set compute default math:bounce/compare_${index}`);
  }
  lines.push("data modify storage math:internal w_bounce_eased set compute default math:bounce/eased");
  lines.push("data modify storage math: ans set compute default math:bounce/result");
  emitControlledPublicFunction("bounce", FUNCTION_PATHS.bounceCompute, lines);
}

{
  const lines = [];
  lines.push(...stagePredicate("bounce_decay/time_at_or_below_start"));
  lines.push("execute if predicate math:internal/bounce_decay/time_at_or_below_start run data modify storage math: ans set compute default math:common/input/a");
  lines.push("execute if predicate math:internal/bounce_decay/time_at_or_below_start run return 1");
  lines.push(...stagePredicate("bounce_decay/time_at_or_after_end"));
  lines.push("execute if predicate math:internal/bounce_decay/time_at_or_after_end run data modify storage math: ans set compute default math:common/input/b");
  lines.push("execute if predicate math:internal/bounce_decay/time_at_or_after_end run return 1");
  lines.push("data modify storage math:internal w_bounce_scaled_t set from storage math: t");
  lines.push("data modify storage math:internal x set from storage math: max");
  lines.push(...stagePredicate("bounce/duration_subnormal"));
  lines.push(`execute if predicate math:internal/bounce/duration_subnormal run function ${functionId(FUNCTION_PATHS.bounceScaleSubnormal)}`);
  lines.push("data modify storage math:internal y set value 1.0f");
  lines.push(`function ${functionId(FUNCTION_PATHS.reciprocal)}`);
  lines.push("data modify storage math:internal w_bounce_decay_u set compute default math:bounce_decay/u");
  lines.push("data modify storage math:internal x set compute default math:bounce_decay/phase");
  lines.push(`function ${functionId(FUNCTION_PATHS.floor)}`);
  lines.push("data modify storage math:internal w_bounce_decay_wave set compute default math:bounce_decay/wave");
  lines.push("data modify storage math:internal x set compute default math:bounce_decay/exponent");
  lines.push(`function ${functionId(FUNCTION_PATHS.exp)}`);
  lines.push("data modify storage math:internal w_bounce_decay_factor set from storage math:internal x");
  lines.push("data modify storage math:internal w_bounce_decay_eased set compute default math:bounce_decay/eased");
  lines.push("data modify storage math: ans set compute default math:bounce_decay/result");
  emitControlledPublicFunction("bounce_decay", FUNCTION_PATHS.bounceDecayCompute, lines);
}

{
  const lines = [];
  for (let iteration = 0; iteration < 20; iteration += 1) {
    lines.push("data modify storage math:internal w_bezier_midpoint set compute default math:bezier/midpoint");
    lines.push("data modify storage math:internal w_comparison.bezier_x set compute default math:bezier/compare_x");
    lines.push("execute if predicate math:internal/bezier/x_before_input run data modify storage math:internal w_bezier_low set from storage math:internal w_bezier_midpoint");
    lines.push("execute unless predicate math:internal/bezier/x_before_input run data modify storage math:internal w_bezier_high set from storage math:internal w_bezier_midpoint");
  }
  lines.push("return 1");
  emitFunction(FUNCTION_PATHS.bezierSolve, lines);
}

{
  const lines = [];
  lines.push(...stagePredicate("bezier/time_at_or_below_start"));
  lines.push("execute if predicate math:internal/bezier/time_at_or_below_start run data modify storage math: ans set from storage math: a");
  lines.push("execute if predicate math:internal/bezier/time_at_or_below_start run return 1");
  lines.push(...stagePredicate("bezier/time_at_or_after_end"));
  lines.push("execute if predicate math:internal/bezier/time_at_or_after_end run data modify storage math: ans set from storage math: b");
  lines.push("execute if predicate math:internal/bezier/time_at_or_after_end run return 1");
  lines.push("data modify storage math:internal x set from storage math: max");
  lines.push("data modify storage math:internal y set from storage math: t");
  lines.push(`function ${functionId(FUNCTION_PATHS.reciprocal)}`);
  lines.push("data modify storage math:internal w_bezier_u set from storage math:internal x");
  lines.push("data modify storage math:internal w_bezier_low set value 0.0f");
  lines.push("data modify storage math:internal w_bezier_high set value 1.0f");
  lines.push(`function ${functionId(FUNCTION_PATHS.bezierSolve)}`);
  lines.push("data modify storage math:internal w_bezier_midpoint set compute default math:bezier/midpoint");
  lines.push("data modify storage math:internal w_bezier_y set compute default math:bezier/y");
  lines.push("data modify storage math: ans set compute default math:bezier/result");
  emitControlledPublicFunction("bezier", FUNCTION_PATHS.bezierCompute, lines);
}

function wrapper(name, provider) {
  emitDirectPublicFunction(name, [computeInline("ans", provider)]);
}

wrapper("add", sum(publicA, publicB));
wrapper("sub", subtract(publicA, publicB));
wrapper("mul", product(publicA, publicB));
wrapper("abs", absolute(publicA));
wrapper("min", minimum(publicA, publicB));
wrapper("max", maximum(publicA, publicB));
wrapper("square", power(publicA, 2));
wrapper("cube", power(publicA, 3));
wrapper("rad", product(publicA, Math.fround(Math.PI / 180)));
wrapper("deg", product(publicA, Math.fround(180 / Math.PI)));
wrapper("lerp", sum(publicA, product(publicT, subtract(publicB, publicA))));
wrapper("floor", floor(publicA));
wrapper("ceil", ceil(publicA));
wrapper("round", round(publicA));
wrapper("truncate", truncate(publicA));
wrapper("div", divide(publicA, publicB));
wrapper("reciprocal", divide(1, publicA));
wrapper("remainder", modulo(publicA, publicB));
wrapper("sqrt", squareRoot(publicA));
wrapper("pow", power(publicA, publicB));
for (const [name, literal] of [
  ["e", "2.7182817459106445f"],
  ["pi", "3.1415927410125732f"],
  ["tau", "6.2831854820251465f"],
]) {
  emitDirectPublicFunction(name, [
    `data modify storage math: ans set value ${literal}`,
  ]);
}

emitFunction(FUNCTION_PATHS.floor, [
  "data modify storage math:internal z set compute default math:common/rounding/floor",
  "return 1",
]);

function stopOnZeroLines() {
  return [
    "execute if data storage math:internal {x:0.0f} run return 1",
  ];
}

emitFunction(FUNCTION_PATHS.normalizeBinary32, [
  "data modify storage math:internal w_normalize_exponent set compute default math:common/normalize/binary32/exponent",
  "data modify storage math:internal z set from storage math:internal w_normalize_exponent",
  "data modify storage math:internal w_normalize_scale set compute default math:exp/scale/00",
  "data modify storage math:internal w_normalize_multiplier_a set compute default math:common/normalize/binary32/multiplier_a",
  "data modify storage math:internal w_normalize_multiplier_b set compute default math:common/normalize/binary32/multiplier_b",
  "data modify storage math:internal w_normalize_mantissa set compute default math:common/normalize/binary32/mantissa_a",
  "data modify storage math:internal w_normalize_mantissa set compute default math:common/normalize/binary32/mantissa_b",
  "return 1",
]);

function reciprocalFinishLines(iterations) {
  const lines = [
    "data modify storage math:internal w_reciprocal_mantissa set compute default math:internal/reciprocal/mantissa",
    "data modify storage math:internal w_reciprocal_estimate set compute default math:internal/reciprocal/initial_estimate",
  ];
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    lines.push("data modify storage math:internal w_reciprocal_estimate set compute default math:internal/reciprocal/newton");
  }
  lines.push(
    "data modify storage math:internal x set compute default math:internal/reciprocal/normalized",
    "data modify storage math:internal x set compute default math:common/arithmetic/multiply",
    "return 1",
  );
  return lines;
}

emitFunction(FUNCTION_PATHS.reciprocalFinish, reciprocalFinishLines(3));

emitFunction(FUNCTION_PATHS.reciprocal, [
  "data modify storage math:internal w set compute default math:internal/reciprocal/compare/below_one",
  `execute if predicate math:internal/comparison/negative_integer run return run function ${functionId(FUNCTION_PATHS.reciprocalNormalizeLow)}`,
  "data modify storage math:internal w set compute default math:internal/reciprocal/compare/at_least_two",
  `execute unless predicate math:internal/comparison/negative_integer run return run function ${functionId(FUNCTION_PATHS.reciprocalNormalizeHigh)}`,
  `return run function ${functionId(FUNCTION_PATHS.reciprocalFinish)}`,
]);

emitFunction(FUNCTION_PATHS.reciprocalNormalizeLow, [
  "data modify storage math:internal w set compute default math:internal/reciprocal/compare/below_half",
  `execute if predicate math:internal/comparison/negative_integer run return run function ${functionId(FUNCTION_PATHS.reciprocalNormalizeShared)}`,
  "data modify storage math:internal x set compute default math:internal/reciprocal/double_x",
  "data modify storage math:internal y set compute default math:internal/reciprocal/double_y",
  `return run function ${functionId(FUNCTION_PATHS.reciprocalFinish)}`,
]);

emitFunction(FUNCTION_PATHS.reciprocalNormalizeHigh, [
  "data modify storage math:internal w set compute default math:internal/reciprocal/compare/at_least_four",
  `execute unless predicate math:internal/comparison/negative_integer run return run function ${functionId(FUNCTION_PATHS.reciprocalNormalizeShared)}`,
  "data modify storage math:internal x set compute default math:internal/reciprocal/half_x",
  "data modify storage math:internal y set compute default math:internal/reciprocal/half_y",
  `return run function ${functionId(FUNCTION_PATHS.reciprocalFinish)}`,
]);

emitFunction(FUNCTION_PATHS.reciprocalNormalizeShared, [
  "data modify storage math:internal w_reciprocal_sign set value 1.0f",
  "data modify storage math:internal w_comparison.x_sign set compute default math:internal/comparison/x_zero",
  "execute if predicate math:internal/range/negative run data modify storage math:internal w_reciprocal_sign set value -1.0f",
  "data modify storage math:internal x set compute default math:common/comparison/absolute",
  `function ${functionId(FUNCTION_PATHS.normalizeBinary32)}`,
  "data modify storage math:internal x set from storage math:internal w_normalize_mantissa",
  "data modify storage math:internal y set compute default math:internal/reciprocal/scale_a",
  `function ${functionId(FUNCTION_PATHS.reciprocalFinish)}`,
  "data modify storage math:internal x set compute default math:internal/reciprocal/scale_b",
  "data modify storage math:internal x set compute default math:internal/reciprocal/apply_sign",
  "return 1",
]);

function exactRemainderLines() {
  return [
    "data modify storage math:internal x set from storage math: a",
    "data modify storage math:internal x set compute default math:common/comparison/absolute",
    "data modify storage math:internal z set from storage math:internal x",
    "data modify storage math:internal x set from storage math: b",
    "data modify storage math:internal x set compute default math:common/comparison/absolute",
    "data modify storage math:internal y set from storage math:internal x",
    "data modify storage math:internal x set from storage math:internal z",
    `function ${functionId(FUNCTION_PATHS.reduceRemainder)}`,
    "data modify storage math:internal z set compute default math:common/input/x",
  ];
}

function internalSquareRootLines(inputProvider, outputPath) {
  return [
    `data modify storage math:internal x set compute default ${inputProvider}`,
    `data modify storage math:internal ${outputPath} set compute default math:square_root/00`,
  ];
}

{
  const lines = [];
  lines.push("data modify storage math:internal w_quaternion_maximum set compute default math:quaternion_to_axis_angle/normalize/maximum");
  lines.push(`function ${functionId(FUNCTION_PATHS.quaternionNormalize)}`);
  emitDirectPublicFunction("quaternion_to_axis_angle", lines);
}

{
  const lines = [
    "data modify storage math:internal x set from storage math:internal w_quaternion_maximum",
    `function ${functionId(FUNCTION_PATHS.normalizeBinary32)}`,
    "data modify storage math:internal w_quaternion_scale_multiplier_a set from storage math:internal w_normalize_multiplier_a",
    "data modify storage math:internal w_quaternion_scale_multiplier_b set from storage math:internal w_normalize_multiplier_b",
    "data modify storage math:internal w_quaternion_maximum_mantissa set from storage math:internal w_normalize_mantissa",
  ];
  for (let index = 0; index < 4; index += 1) {
    lines.push(`data modify storage math:internal w_quaternion_scaled_raw_${index} set compute default math:quaternion_to_axis_angle/normalize/scaled_raw_${index}`);
  }
  lines.push(
    "data modify storage math:internal x set from storage math:internal w_quaternion_maximum_mantissa",
    "data modify storage math:internal y set value 1.0f",
    `function ${functionId(FUNCTION_PATHS.reciprocal)}`,
    "data modify storage math:internal w_quaternion_inverse_maximum_mantissa set from storage math:internal x",
  );
  for (let index = 0; index < 4; index += 1) {
    lines.push(...stagePredicate(`quaternion_to_axis_angle/scaled_${index}_positive_maximum`));
    lines.push(...stagePredicate(`quaternion_to_axis_angle/scaled_${index}_negative_maximum`));
    lines.push(`data modify storage math:internal w_quaternion_scaled_${index} set compute default math:quaternion_to_axis_angle/normalize/scaled_${index}`);
    lines.push(`execute if predicate math:internal/quaternion_to_axis_angle/scaled_${index}_positive_maximum run data modify storage math:internal w_quaternion_scaled_${index} set value 1.0f`);
    lines.push(`execute if predicate math:internal/quaternion_to_axis_angle/scaled_${index}_negative_maximum run data modify storage math:internal w_quaternion_scaled_${index} set value -1.0f`);
  }
  lines.push("data modify storage math:internal w_quaternion_scaled_square_sum set compute default math:quaternion_to_axis_angle/normalize/scaled_square_sum");
  lines.push(...internalSquareRootLines(
    "math:quaternion_to_axis_angle/normalize/scaled_square_sum",
    "w_quaternion_length",
  ));
  lines.push(
    "data modify storage math:internal x set from storage math:internal w_quaternion_length",
    "data modify storage math:internal y set value 1.0f",
    `function ${functionId(FUNCTION_PATHS.reciprocal)}`,
    "data modify storage math:internal w_quaternion_inverse_length set from storage math:internal x",
  );
  for (let index = 0; index < 4; index += 1) {
    lines.push(`data modify storage math:internal w_quaternion_normalized_${index} set compute default math:quaternion_to_axis_angle/normalize/normalized_${index}`);
  }
  lines.push(`return run function ${functionId(FUNCTION_PATHS.quaternionVector)}`);
  emitFunction(FUNCTION_PATHS.quaternionNormalize, lines);
}

{
  const lines = [
    "data modify storage math:internal w_quaternion_vector_maximum set compute default math:quaternion_to_axis_angle/vector/maximum",
    ...stagePredicate("quaternion_to_axis_angle/vector_zero"),
    `execute if predicate math:internal/quaternion_to_axis_angle/vector_zero run return run function ${functionId(FUNCTION_PATHS.quaternionScalar)}`,
    "data modify storage math:internal x set from storage math:internal w_quaternion_vector_maximum",
    `function ${functionId(FUNCTION_PATHS.normalizeBinary32)}`,
    "data modify storage math:internal w_quaternion_vector_scale_multiplier_a set from storage math:internal w_normalize_multiplier_a",
    "data modify storage math:internal w_quaternion_vector_scale_multiplier_b set from storage math:internal w_normalize_multiplier_b",
    "data modify storage math:internal w_quaternion_vector_maximum_mantissa set from storage math:internal w_normalize_mantissa",
  ];
  for (let index = 0; index < 3; index += 1) {
    lines.push(`data modify storage math:internal w_quaternion_vector_scaled_raw_${index} set compute default math:quaternion_to_axis_angle/vector/scaled_raw_${index}`);
  }
  lines.push(
    "data modify storage math:internal x set from storage math:internal w_quaternion_vector_maximum_mantissa",
    "data modify storage math:internal y set value 1.0f",
    `function ${functionId(FUNCTION_PATHS.reciprocal)}`,
    "data modify storage math:internal w_quaternion_inverse_vector_maximum_mantissa set from storage math:internal x",
  );
  for (let index = 0; index < 3; index += 1) {
    lines.push(...stagePredicate(`quaternion_to_axis_angle/vector_${index}_positive_maximum`));
    lines.push(...stagePredicate(`quaternion_to_axis_angle/vector_${index}_negative_maximum`));
    lines.push(`data modify storage math:internal w_quaternion_vector_scaled_${index} set compute default math:quaternion_to_axis_angle/vector/scaled_${index}`);
    lines.push(`execute if predicate math:internal/quaternion_to_axis_angle/vector_${index}_positive_maximum run data modify storage math:internal w_quaternion_vector_scaled_${index} set value 1.0f`);
    lines.push(`execute if predicate math:internal/quaternion_to_axis_angle/vector_${index}_negative_maximum run data modify storage math:internal w_quaternion_vector_scaled_${index} set value -1.0f`);
  }
  lines.push(...internalSquareRootLines(
    "math:quaternion_to_axis_angle/vector/scaled_square_sum",
    "w_quaternion_vector_length",
  ));
  lines.push(
    "data modify storage math:internal x set from storage math:internal w_quaternion_vector_length",
    "data modify storage math:internal y set value 1.0f",
    `function ${functionId(FUNCTION_PATHS.reciprocal)}`,
    "data modify storage math:internal w_quaternion_inverse_vector_length set from storage math:internal x",
  );
  for (let index = 0; index < 3; index += 1) {
    lines.push(`data modify storage math:internal w_quaternion_axis_${index} set compute default math:quaternion_to_axis_angle/output/axis_${index}`);
  }
  lines.push(
    "data modify storage math:internal x set compute default math:quaternion_to_axis_angle/normalize/clamped_w",
    `function ${functionId(FUNCTION_PATHS.acos)}`,
    "data modify storage math:internal w_quaternion_angle set compute default math:quaternion_to_axis_angle/output/angle",
    `return run function ${functionId(FUNCTION_PATHS.quaternionFinish)}`,
  );
  emitFunction(FUNCTION_PATHS.quaternionVector, lines);
}

emitFunction(FUNCTION_PATHS.quaternionScalar, [
  "data modify storage math:internal w_quaternion_axis_0 set value 0.0f",
  "data modify storage math:internal w_quaternion_axis_1 set value 1.0f",
  "data modify storage math:internal w_quaternion_axis_2 set value 0.0f",
  "data modify storage math:internal w_quaternion_angle set value 0.0f",
  ...stagePredicate("quaternion_to_axis_angle/scalar_negative"),
  "execute if predicate math:internal/quaternion_to_axis_angle/scalar_negative run data modify storage math:internal w_quaternion_angle set value 6.2831854820251465f",
  `return run function ${functionId(FUNCTION_PATHS.quaternionFinish)}`,
]);

{
  const lines = [];
  lines.push("data modify storage math: ans set value {angle:0.0f,axis:[0.0f,0.0f,0.0f]}");
  lines.push("data modify storage math: ans.angle set compute default math:quaternion_to_axis_angle/output/stored_angle");
  for (let index = 0; index < 3; index += 1) {
    lines.push(`data modify storage math: ans.axis[${index}] set compute default math:quaternion_to_axis_angle/output/stored_axis_${index}`);
  }
  lines.push("return 1");
  emitFunction(FUNCTION_PATHS.quaternionFinish, lines);
}

emitFunction(FUNCTION_PATHS.log, [
  `function ${functionId(FUNCTION_PATHS.normalizeBinary32)}`,
  "data modify storage math:internal w_comparison.log_center set compute default math:log/normalize/compare_center/00",
  "data modify storage math:internal z set compute default math:log/normalize/centered_mantissa/00",
  "data modify storage math:internal w set compute default math:log/normalize/centered_exponent/00",
  "data modify storage math:internal z set compute default math:log/normalize/numerator/00",
  "data modify storage math:internal x set compute default math:log/normalize/denominator/00",
  "data modify storage math:internal w_log_mantissa set compute default math:internal/reciprocal/log_mantissa",
  "data modify storage math:internal w_log_reciprocal set compute default math:internal/reciprocal/log_initial",
  "data modify storage math:internal w_log_reciprocal set compute default math:internal/reciprocal/log_newton",
  "data modify storage math:internal w_log_reciprocal set compute default math:internal/reciprocal/log_newton",
  "data modify storage math:internal w_log_reciprocal set compute default math:internal/reciprocal/log_newton",
  "data modify storage math:internal x set compute default math:internal/reciprocal/log_denominator",
  "data modify storage math:internal z set compute default math:log/normalize/u/00",
  "data modify storage math:internal x set compute default math:log/00",
  "return 1",
]);

emitFunction(FUNCTION_PATHS.exp, [
  "data modify storage math:internal w set from storage math:internal x",
  "data modify storage math:internal x set compute default math:exp/reduce/quotient/00",
  "data modify storage math:internal x set compute default math:common/rounding/add_half",
  `function ${functionId(FUNCTION_PATHS.floor)}`,
  "data modify storage math:internal x set compute default math:exp/reduce/remainder/00",
  "data modify storage math:internal x set compute default math:exp/00",
  "return 1",
]);

{
  const lines = [];
  lines.push("data modify storage math:internal x set from storage math: a");
  lines.push(`function ${functionId(FUNCTION_PATHS.log)}`);
  lines.push("data modify storage math: ans set compute default math:common/input/x");
  emitDirectPublicFunction("log", lines);
}

{
  const lines = [];
  lines.push("data modify storage math:internal x set from storage math: a");
  lines.push(...stagePredicate("exp/underflows_to_zero"));
  lines.push("execute if predicate math:internal/exp/underflows_to_zero run data modify storage math: ans set value 0.0f");
  lines.push("execute if predicate math:internal/exp/underflows_to_zero run return 1");
  lines.push("execute if data storage math:internal {x:-103.97207641601562f} run data modify storage math: ans set compute default math:exp/minimum/00");
  lines.push("execute if data storage math:internal {x:-103.97207641601562f} run return 1");
  lines.push(`function ${functionId(FUNCTION_PATHS.exp)}`);
  lines.push("data modify storage math: ans set compute default math:common/input/x");
  emitControlledPublicFunction("exp", FUNCTION_PATHS.expCompute, lines);
}

const reduceRemainderNearPath = ".common/reduce_remainder/1.near";
const reduceRemainderShallowOnePath = ".common/reduce_remainder/2.shallow_one";
const reduceRemainderShallowTwoPath = ".common/reduce_remainder/3.shallow_two";
const reduceRemainderDescendingPath = ".common/reduce_remainder/4.descend";
const reduceRemainderSubtractFinishOnePath = ".common/reduce_remainder/5.subtract_finish_one";
const reduceRemainderSubtractFinishTwoPath = ".common/reduce_remainder/6.subtract_finish_two";
const reduceRemainderAdjustScaledPath = ".common/reduce_remainder/7.adjust_scaled";

function fixedRemainderDescentLines(levels) {
  const lines = [];
  for (let level = 0; level < levels; level += 1) {
    lines.push("data modify storage math:internal y set compute default math:common/rounding/half_y");
    lines.push(...stagePredicate("rounding/remainder/can_subtract_y"));
    lines.push("execute if predicate math:internal/rounding/remainder/can_subtract_y run data modify storage math:internal x set compute default math:common/arithmetic/subtract");
  }
  lines.push("return 1");
  return lines;
}

function shallowRemainderLines(subtractFinishPath, nextPath) {
  const lines = [
    ...stagePredicate("rounding/remainder/y_too_large_to_double"),
    `execute if predicate math:internal/rounding/remainder/y_too_large_to_double run return run function ${functionId(subtractFinishPath)}`,
    "data modify storage math:internal w set compute default math:common/rounding/double_y",
    ...stagePredicate("rounding/remainder/w_greater_than_x"),
    `execute if predicate math:internal/rounding/remainder/w_greater_than_x run return run function ${functionId(subtractFinishPath)}`,
  ];
  if (nextPath) {
    lines.push("data modify storage math:internal y set from storage math:internal w");
    lines.push(`return run function ${functionId(nextPath)}`);
  } else {
    lines.push("return 1");
  }
  return lines;
}

emitFunction(reduceRemainderSubtractFinishOnePath, [
  "data modify storage math:internal x set compute default math:common/arithmetic/subtract",
  ...fixedRemainderDescentLines(1),
]);
emitFunction(reduceRemainderSubtractFinishTwoPath, [
  "data modify storage math:internal x set compute default math:common/arithmetic/subtract",
  ...fixedRemainderDescentLines(2),
]);
emitFunction(reduceRemainderShallowOnePath, shallowRemainderLines(
  reduceRemainderSubtractFinishOnePath,
  reduceRemainderShallowTwoPath,
));
emitFunction(reduceRemainderShallowTwoPath, shallowRemainderLines(reduceRemainderSubtractFinishTwoPath));
emitFunction(reduceRemainderNearPath, [
  "data modify storage math:internal w set compute default math:common/rounding/double_y",
  "data modify storage math:internal y set from storage math:internal w",
  `return run function ${functionId(reduceRemainderShallowOnePath)}`,
]);

emitFunction(reduceRemainderDescendingPath, [
  ...stagePredicate("rounding/remainder/can_subtract_y"),
  "execute if predicate math:internal/rounding/remainder/can_subtract_y run data modify storage math:internal x set compute default math:common/arithmetic/subtract",
  "execute unless predicate math:internal/rounding/remainder/shift_positive run return 1",
  "data modify storage math:internal y set compute default math:common/rounding/half_y",
  "data modify storage math:internal w_remainder_remaining_shift set compute default math:common/reduce_remainder/decrement_remaining_shift",
  `return run function ${functionId(reduceRemainderDescendingPath)}`,
]);

emitFunction(reduceRemainderAdjustScaledPath, [
  "data modify storage math:internal w_remainder_scaled_divisor set compute default math:common/reduce_remainder/half_scaled_divisor",
  "data modify storage math:internal w_remainder_shift set compute default math:common/reduce_remainder/decrement_shift",
]);

emitFunction(FUNCTION_PATHS.reduceRemainder, [
  ...stagePredicate("rounding/remainder/can_subtract_y"),
  "execute unless predicate math:internal/rounding/remainder/can_subtract_y run return 1",
  ...stagePredicate("rounding/remainder/within_double"),
  "execute if predicate math:internal/rounding/remainder/within_double run data modify storage math:internal x set compute default math:common/arithmetic/subtract",
  "execute if predicate math:internal/rounding/remainder/within_double run return 1",
  ...stagePredicate("rounding/remainder/near_ratio"),
  `execute if predicate math:internal/rounding/remainder/near_ratio run return run function ${functionId(reduceRemainderNearPath)}`,
  "data modify storage math:internal w_remainder_original set from storage math:internal z",
  "data modify storage math:internal w_remainder_x set from storage math:internal x",
  "data modify storage math:internal w_remainder_divisor set from storage math:internal y",
  `function ${functionId(FUNCTION_PATHS.normalizeBinary32)}`,
  "data modify storage math:internal w_remainder_x_exponent set from storage math:internal w_normalize_exponent",
  "data modify storage math:internal x set from storage math:internal y",
  `function ${functionId(FUNCTION_PATHS.normalizeBinary32)}`,
  "data modify storage math:internal w_remainder_y_exponent set from storage math:internal w_normalize_exponent",
  "data modify storage math:internal w_remainder_shift set compute default math:common/reduce_remainder/shift",
  "data modify storage math:internal w_remainder_scaled_divisor set from storage math:internal y",
  "data modify storage math:internal w_remainder_scaled_divisor set compute default math:common/reduce_remainder/scale_0",
  "data modify storage math:internal w_remainder_scaled_divisor set compute default math:common/reduce_remainder/scale_1",
  "data modify storage math:internal w_remainder_scaled_divisor set compute default math:common/reduce_remainder/scale_2",
  "data modify storage math:internal x set from storage math:internal w_remainder_x",
  "data modify storage math:internal w set from storage math:internal w_remainder_scaled_divisor",
  ...stagePredicate("rounding/remainder/w_greater_than_x"),
  `execute if predicate math:internal/rounding/remainder/w_greater_than_x run function ${functionId(reduceRemainderAdjustScaledPath)}`,
  "data modify storage math:internal w_remainder_remaining_shift set from storage math:internal w_remainder_shift",
  "data modify storage math:internal y set from storage math:internal w_remainder_scaled_divisor",
  `function ${functionId(reduceRemainderDescendingPath)}`,
  "data modify storage math:internal y set from storage math:internal w_remainder_divisor",
  "data modify storage math:internal z set from storage math:internal w_remainder_original",
  "return 1",
]);

emitFunction(FUNCTION_PATHS.moduloNegativeA, [
  "data modify storage math:internal x set from storage math:internal z",
  "return run data modify storage math: ans set compute default math:common/rounding/negate",
]);

emitFunction(FUNCTION_PATHS.moduloNegativeB, [
  `execute if predicate math:internal/rounding/public/a_negative run return run function ${functionId(FUNCTION_PATHS.moduloNegativeA)}`,
  "data modify storage math:internal x set from storage math:internal z",
  "data modify storage math: ans set compute default math:common/arithmetic/subtract",
  "return 1",
]);

{
  const lines = [];
  lines.push(`execute if data storage math: {b:0.0f} run return run ${computeInline("ans", modulo(publicA, publicB))}`);
  lines.push("data modify storage math:internal x set from storage math: b");
  lines.push(...exactRemainderLines());
  lines.push(...stagePredicate("rounding/remainder/zero"));
  lines.push("execute if predicate math:internal/rounding/remainder/zero run data modify storage math: ans set value 0.0f");
  lines.push("execute if predicate math:internal/rounding/remainder/zero run return 1");
  lines.push(...stagePredicate("rounding/public/a_negative"));
  lines.push(...stagePredicate("rounding/public/b_negative"));
  lines.push(`execute if predicate math:internal/rounding/public/b_negative run function ${functionId(FUNCTION_PATHS.moduloNegativeB)}`);
  lines.push("execute if predicate math:internal/rounding/public/b_negative run return 1");
  lines.push("execute unless predicate math:internal/rounding/public/a_negative run data modify storage math: ans set compute default math:common/input/z");
  lines.push("execute unless predicate math:internal/rounding/public/a_negative run return 1");
  lines.push("data modify storage math:internal x set from storage math:internal y");
  lines.push("data modify storage math:internal y set from storage math:internal z");
  lines.push("data modify storage math: ans set compute default math:common/arithmetic/subtract");
  emitControlledPublicFunction("mod", FUNCTION_PATHS.moduloCompute, lines);
}

emitFunction(FUNCTION_PATHS.sin, [
  "data modify storage math:internal x set compute default math:sin/00",
  "return 1",
]);

emitFunction(FUNCTION_PATHS.cos, [
  "data modify storage math:internal x set compute default math:cos/00",
  "return 1",
]);

emitFunction(FUNCTION_PATHS.tan, [
  "data modify storage math:internal w_tan_sin set compute default math:sin/00",
  "data modify storage math:internal w_tan_cos set compute default math:cos/00",
  "return 1",
]);

function tangentResultLines() {
  return [
    "data modify storage math:internal x set from storage math:internal w_tan_cos",
    "data modify storage math: ans set compute default math:tan/00",
  ];
}

function trigWrapper(name, computePath, kernelPath, isTangent, degrees, zeroResult) {
  const lines = [];
  lines.push("data modify storage math:internal x set from storage math: a");
  if (degrees) lines.push("data modify storage math:internal x set compute default math:common/conversion/rad");
  lines.push(`execute if data storage math:internal {x:0.0f} run data modify storage math: ans set ${zeroResult}`);
  lines.push("execute if data storage math:internal {x:0.0f} run return 1");
  if (isTangent) {
    lines.push(`function ${functionId(kernelPath)}`);
    lines.push(...tangentResultLines());
  } else {
    lines.push(`function ${functionId(kernelPath)}`);
    lines.push("data modify storage math: ans set compute default math:common/input/x");
  }
  emitControlledPublicFunction(name, computePath, lines);
}

for (const degrees of [false, true]) {
  const suffix = degrees ? "_degrees" : "";
  trigWrapper(`sin${suffix}`, degrees ? FUNCTION_PATHS.sineDegreesCompute : FUNCTION_PATHS.sineCompute, FUNCTION_PATHS.sin, false, degrees, "compute default math:common/input/x");
  trigWrapper(`cos${suffix}`, degrees ? FUNCTION_PATHS.cosineDegreesCompute : FUNCTION_PATHS.cosineCompute, FUNCTION_PATHS.cos, false, degrees, "value 1.0f");
  trigWrapper(`tan${suffix}`, degrees ? FUNCTION_PATHS.tangentDegreesCompute : FUNCTION_PATHS.tangentCompute, FUNCTION_PATHS.tan, true, degrees, "compute default math:common/input/x");
}

{
  const lines = [];
  lines.push("data modify storage math:internal x set from storage math: a");
  lines.push("data modify storage math: ans set value 0.0f");
  lines.push("data modify storage math:internal w_comparison.x_sign set compute default math:internal/comparison/x_zero");
  lines.push("execute if predicate math:internal/range/negative run data modify storage math: ans set value -1.0f");
  lines.push("execute if predicate math:internal/range/positive run data modify storage math: ans set value 1.0f");
  emitDirectPublicFunction("sign", lines);
}

{
  wrapper("clamp", minimum(maximum(publicA, publicMin), publicMax));
}

function generate(targetRoot) {
  if (targetRoot === root) {
    const manifestPath = path.join(root, "tools", "generated-math-files.json");
    if (fs.existsSync(manifestPath)) {
      const previous = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      const next = new Set(generatedPaths());
      for (const relativePath of previous.files ?? []) {
        if (next.has(relativePath)) continue;
        const target = path.resolve(root, ...relativePath.split("/"));
        if (!target.startsWith(`${root}${path.sep}`)) {
          throw new Error(`Refusing to remove generated path outside repository: ${relativePath}`);
        }
        fs.rmSync(target, { force: true });
        const generatedDataRoot = path.join(root, "Math", "data", "math");
        let parent = path.dirname(target);
        while (parent.startsWith(`${generatedDataRoot}${path.sep}`)) {
          try {
            fs.rmdirSync(parent);
          } catch (error) {
            if (["ENOENT", "ENOTEMPTY"].includes(error.code)) break;
            throw error;
          }
          parent = path.dirname(parent);
        }
      }
    }
  }
  fs.rmSync(path.join(targetRoot, "Math", "data", "math", "number_provider"), { recursive: true, force: true });
  fs.rmSync(path.join(targetRoot, "Math", "data", "math", "context_float_provider", "common"), { recursive: true, force: true });
  fs.rmSync(path.join(targetRoot, "Math", "data", "math", "context_float_provider", "internal"), { recursive: true, force: true });
  fs.rmSync(path.join(targetRoot, "Math", "data", "math", "predicate", "internal"), { recursive: true, force: true });
  for (const obsolete of [
    [".common", "arithmetic"],
    [".common", "comparison"],
    [".common", "constant"],
    [".common", "conversion"],
    ["bezier", "input"],
    ["power"],
    ["square_root"],
  ]) {
    fs.rmSync(path.join(targetRoot, "Math", "data", "math", "context_float_provider", ...obsolete), { recursive: true, force: true });
  }
  fs.rmSync(path.join(targetRoot, "Math", "data", "math", "function", "internal"), { recursive: true, force: true });
  fs.rmSync(path.join(targetRoot, "Math", "data", "math", "function", "common"), { recursive: true, force: true });
  fs.rmSync(path.join(targetRoot, "Math", "data", "math", "function", ".common", "_error"), { recursive: true, force: true });
  fs.rmSync(path.join(targetRoot, "Math", "data", "math", "function", ".common", "invalid_number"), { recursive: true, force: true });
  fs.rmSync(path.join(targetRoot, "Math", "data", "math", "function", ".common", "result_out_of_range"), { recursive: true, force: true });
  for (const file of generatedFiles) {
    if (file.kind === "json") {
      writeGeneratedJson(targetRoot, file.relativePath.replace(/\.json$/, ""), file.value);
    } else {
      const target = path.join(targetRoot, ...file.relativePath.split("/"));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, file.text);
    }
  }
  if (targetRoot === root) {
    fs.writeFileSync(
      path.join(root, "tools", "generated-math-files.json"),
      JSON.stringify({ command, files: generatedPaths() }, null, 2) + "\n",
    );
  }
}

function generatedPaths() {
  return generatedFiles.map(({ relativePath }) => relativePath).sort();
}

function check() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "math-provider-generation-"));
  try {
    generate(tempRoot);
    const manifest = JSON.parse(fs.readFileSync(path.join(root, "tools", "generated-math-files.json"), "utf8"));
    const expectedPaths = generatedPaths();
    if (manifest.command !== command || !Array.isArray(manifest.files)) {
      throw new Error("tools/generated-math-files.json must contain the generator command and a files array");
    }
    if (JSON.stringify(manifest.files) !== JSON.stringify(expectedPaths)) {
      throw new Error("tools/generated-math-files.json does not match the generated provider paths");
    }
    for (const relativePath of expectedPaths) {
      const expected = fs.readFileSync(path.join(tempRoot, ...relativePath.split("/")), "utf8");
      const actual = fs.readFileSync(path.join(root, ...relativePath.split("/")), "utf8");
      if (actual.replaceAll("\r\n", "\n") !== expected.replaceAll("\r\n", "\n")) {
        throw new Error(`Generated provider differs: ${relativePath}`);
      }
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

generatedFiles.splice(0, generatedFiles.length, ...optimizeProviderResources(generatedFiles, {
  maxInlineBytes: 128,
}));

try {
  if (process.argv.includes("--check")) {
    check();
  } else {
    generate(root);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
