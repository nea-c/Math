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
  storage,
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

const command = "node tools/generate-math-providers.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const finiteLimit = 3.4028234663852886e38;
const smallestNegativeFloat = -1.401298464324817e-45;
const smallestPositiveFloat = Math.fround(2 ** -149);
const smallestFiniteReciprocalInput = Math.fround(2 ** -128 + 2 ** -149);
const largestSubnormalFloat = Math.fround(2 ** -126 - 2 ** -149);
const maximumFiniteExpInput = Math.fround(88.72283172607422);
const maximumZeroExpInput = Math.fround(-103.97208404541016);
const pi = Math.fround(Math.PI);
const halfPi = Math.fround(Math.PI / 2);
const tau = Math.fround(Math.PI * 2);
const powerOverflowLogThreshold = Math.log((2 - 2 ** -24) * 2 ** 127);
const powerOverflowThresholdHigh = Math.fround(powerOverflowLogThreshold);
const powerOverflowThresholdLow = Math.fround(powerOverflowLogThreshold - powerOverflowThresholdHigh);
const powerClassifierDegree = 18;
// Widest binary32 residual threshold that keeps the adaptive square-root
// corpus within the documented relative-error bound (bits 0x384b0000).
const squareRootResidualThreshold = Math.fround(0.00004839897155761719);
const generatedFiles = [];

function privateProviderPath(relativePath) {
  return relativePath.replace(/^common\//, ".common/");
}

function privateProviderReferences(value) {
  if (typeof value === "string") return value.replace(/^math:common\//, "math:.common/");
  if (Array.isArray(value)) return value.map(privateProviderReferences);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, privateProviderReferences(child)]));
}

function emit(relativePath, value) {
  generatedFiles.push({
    kind: "json",
    relativePath: `Math/data/math/context_float_provider/${privateProviderPath(relativePath)}.json`,
    value: privateProviderReferences(value),
  });
}

function emitPredicate(relativePath, value) {
  generatedFiles.push({ kind: "json", relativePath: `Math/data/math/predicate/internal/${relativePath}.json`, value });
}

function emitFunction(path, lines) {
  const migratedLines = lines.map(line => line
    .replaceAll("compute default ", "compute default float ")
    .replaceAll("math:common/", "math:.common/"));
  generatedFiles.push({ kind: "function", relativePath: `Math/data/math/function/${path}.mcfunction`, text: `${migratedLines.join("\n")}\n` });
}

function emitFunctionTag(name, value) {
  generatedFiles.push({
    kind: "json",
    relativePath: `Math/data/math/tags/function/${name}.json`,
    value,
  });
}

function emitPublicFunction(name, lines) {
  emitFunction(PUBLIC_FUNCTION_PATHS[name], lines);
  emitFunctionTag(name, publicTag(name));
}

const x = storage("math:internal", "x");
const y = storage("math:internal", "y");
const z = storage("math:internal", "z");
const w = storage("math:internal", "w");
const publicA = storage("math:", "a");
const publicB = storage("math:", "b");
const publicT = storage("math:", "t");
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
const quaternionComponents = Array.from({ length: 4 }, (_, index) => storage("math:internal", `w_quaternion_component_${index}`));
const quaternionScaledRaw = Array.from({ length: 4 }, (_, index) => storage("math:internal", `w_quaternion_scaled_raw_${index}`));
const quaternionScaled = Array.from({ length: 4 }, (_, index) => storage("math:internal", `w_quaternion_scaled_${index}`));
const quaternionNormalized = Array.from({ length: 4 }, (_, index) => storage("math:internal", `w_quaternion_normalized_${index}`));
const atanInput = storage("math:internal", "w_atan_input");
const atanNumerator = storage("math:internal", "w_atan_numerator");
const atanSquare = storage("math:internal", "w_atan_square");
const atan2AbsoluteA = storage("math:internal", "w_atan2_absolute_a");
const atan2AbsoluteB = storage("math:internal", "w_atan2_absolute_b");
const atan2Minimum = storage("math:internal", "w_atan2_minimum");
const atan2Maximum = storage("math:internal", "w_atan2_maximum");
const quaternionAxis = Array.from({ length: 3 }, (_, index) => storage("math:internal", `w_quaternion_axis_${index}`));

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
  emitPredicate(relativePath, floatRange(storage("math:internal", materializedPath), 1, 1));
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
const storedNormalizeExponent = storage("math:internal", "w_normalize_exponent");
const storedNormalizeMultiplierA = storage("math:internal", "w_normalize_multiplier_a");
const storedNormalizeMultiplierB = storage("math:internal", "w_normalize_multiplier_b");
const storedNormalizeMantissa = storage("math:internal", "w_normalize_mantissa");
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

emit("common/constant/pi", Math.fround(Math.PI));
emit("common/constant/tau", Math.fround(Math.PI * 2));
emit("common/constant/e", Math.fround(Math.E));
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

const bezierLow = storage("math:internal", "w_bezier_low");
const bezierHigh = storage("math:internal", "w_bezier_high");
const bezierMidpoint = storage("math:internal", "w_bezier_midpoint");
const bezierInput = storage("math:internal", "w_bezier_u");
const bezierCurveX1 = storage("math:internal", "w_bezier_x1");
const bezierCurveY1 = storage("math:internal", "w_bezier_y1");
const bezierCurveX2 = storage("math:internal", "w_bezier_x2");
const bezierCurveY2 = storage("math:internal", "w_bezier_y2");

function cubicBezier(parameter, firstControl, secondControl) {
  const inverse = sum(1, product(-1, parameter));
  return sum(
    product(3, inverse, inverse, parameter, firstControl),
    product(3, inverse, parameter, parameter, secondControl),
    product(parameter, parameter, parameter),
  );
}

for (const [name, provider] of Object.entries({
  x1: publicCurveX1,
  y1: publicCurveY1,
  x2: publicCurveX2,
  y2: publicCurveY2,
})) emit(`bezier/input/${name}`, provider);
const bezierCurveX = cubicBezier(bezierMidpoint, bezierCurveX1, bezierCurveX2);
emit("bezier/midpoint", product(0.5, sum(bezierLow, bezierHigh)));
emit("bezier/x", bezierCurveX);
emit("bezier/y", cubicBezier(bezierMidpoint, bezierCurveY1, bezierCurveY2));
emit("bezier/compare_x", floatComparison(subtractExpression(bezierCurveX, bezierInput), 0));
emitPredicate("bezier/x_before_input", inlineValueCheck(
  storage("math:internal", "w_comparison.bezier_x"),
  undefined,
  -1,
));
emit("bezier/result", sum(publicA, product(
  storage("math:internal", "w_bezier_y"),
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
emit("remainder/00", modulo(x, y));
const storedRemainderXExponent = storage("math:internal", "w_remainder_x_exponent");
const storedRemainderYExponent = storage("math:internal", "w_remainder_y_exponent");
const storedRemainderShift = storage("math:internal", "w_remainder_shift");
const storedRemainderRemainingShift = storage("math:internal", "w_remainder_remaining_shift");
const storedRemainderScaledDivisor = storage("math:internal", "w_remainder_scaled_divisor");
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
const periodHalfDifference = sum(x, product(-0.5, y));
emit("common/normalize/period/positive/00", numberDispatcher([
  {
    condition: inlineValueCheck(storage("math:internal", "w_comparison.period_half"), 0, undefined),
    number_provider: subtractExpression(x, y),
  },
], x));
emit("common/normalize/period/negative/00", numberDispatcher([
  {
    condition: inlineValueCheck(storage("math:internal", "w_comparison.period_half"), 1, undefined),
    number_provider: subtractExpression(y, x),
  },
], product(-1, x)));
emit("common/normalize/period/compare_half", floatComparison(periodHalfDifference, 0));
emit("common/normalize/period/compare_original", floatComparison(z, 0));

const sineC3 = Math.fround(-1 / 6);
const sineC5 = Math.fround(1 / 120);
const sineC7 = Math.fround(-1 / 5040);
const sineC9 = Math.fround(1 / 362880);
const sineC11 = Math.fround(-1 / 39916800);
const sineC13 = Math.fround(1 / 6227020800);
const sineC15 = Math.fround(-1 / 1307674368000);
const sineC13Tail = sum(sineC13, product(x, x, sineC15));
const sineC11Tail = sum(sineC11, product(x, x, sineC13Tail));
const sineC9Tail = sum(sineC9, product(x, x, sineC11Tail));
const halfPiPrevious = previousPositiveFloat(halfPi);
const halfPiNext = nextPositiveFloat(halfPi);
emit("sin/fold/00", numberDispatcher([
  {
    condition: inlineValueCheck(storage("math:internal", "w_comparison.sin_fold_lower"), undefined, 0),
    number_provider: sum(-pi, product(-1, z)),
  },
  {
    condition: inlineValueCheck(storage("math:internal", "w_comparison.sin_fold_upper"), 0, undefined),
    number_provider: sum(pi, product(-1, z)),
  },
], z));
emit("sin/fold/compare_lower", floatComparison(z, -halfPi));
emit("sin/fold/compare_upper", floatComparison(z, halfPi));
emit("sin/polynomial/00", product(
  x,
  sum(
    1,
    product(
      x,
      x,
      sum(
        sineC3,
        product(
          x,
          x,
          sum(
            sineC5,
            product(
              x,
              x,
              sum(sineC7, product(x, x, sineC9Tail)),
            ),
          ),
        ),
      ),
    ),
  ),
));
emit("sin/00", sine(x));
emit("sin/compare/positive_lower", floatComparison(x, halfPiPrevious));
emit("sin/compare/positive_upper", floatComparison(x, halfPiNext));
emit("sin/compare/negative_lower", floatComparison(x, -halfPiNext));
emit("sin/compare/negative_upper", floatComparison(x, -halfPiPrevious));
emit("cos/00", cosine(x));
emit("tan/00", divide(
  storage("math:internal", "w_tan_sin"),
  storage("math:internal", "w_tan_cos"),
));
const tangentGuardBase = 0.00002;
const tangentGuardBaseUp = nextPositiveFloat(tangentGuardBase);
const tangentGuardInflation = 1 + 2 ** -20;
const tauAbsoluteError = Math.abs(tau - Math.PI * 2);
const tauErrorRatio = tauAbsoluteError / (Math.PI * 2);
const tangentPeriodStepError = nextPositiveFloat(tauAbsoluteError * tangentGuardInflation);
const radianGuardCoefficient = nextPositiveFloat(tauErrorRatio * tangentGuardInflation);
const radianConversion = Math.fround(Math.PI / 180);
const unitRoundoff = 2 ** -24;
const degreeGuardCoefficientExact = Math.abs(radianConversion - Math.PI / 180)
  + radianConversion * unitRoundoff
  + radianConversion * (1 + unitRoundoff) * tauErrorRatio;
const degreeGuardCoefficient = nextPositiveFloat(degreeGuardCoefficientExact * tangentGuardInflation);

function tangentGuard(domain, coefficient) {
  const absoluteInput = maximum(publicA, product(-1, publicA));
  const excess = maximum(0, sum(absoluteInput, -domain));
  return numberDispatcher([
    {
      condition: inlineValueCheck(storage("math:internal", "w_comparison.tan_domain"), undefined, 0),
      number_provider: tangentGuardBase,
    },
  ], minimum(2, sum(tangentGuardBaseUp, tangentPeriodStepError, product(excess, coefficient))));
}

emit("tan/guard/radians/00", tangentGuard(100, radianGuardCoefficient));
emit("tan/guard/degrees/00", tangentGuard(5000, degreeGuardCoefficient));
emit("tan/guard/radians/compare_domain", floatComparison(maximum(publicA, product(-1, publicA)), 100));
emit("tan/guard/degrees/compare_domain", floatComparison(maximum(publicA, product(-1, publicA)), 5000));

// Commands evaluate providers in float context before predicates coerce their
// inputs to integers. Normalize a reciprocal operand with staged float writes,
// keeping every branch decision at least one integer apart.
const stagedReciprocalAbsolute = maximum(x, product(-1, x));
const stagedReciprocalMantissa = product(0.5, stagedReciprocalAbsolute);
const storedReciprocalMantissa = storage("math:internal", "w_reciprocal_mantissa");
const storedReciprocalEstimate = storage("math:internal", "w_reciprocal_estimate");
const storedReciprocalSign = storage("math:internal", "w_reciprocal_sign");
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
const divideAMantissa = storage("math:internal", "w_divide_a_mantissa");
const divideAExponent = storage("math:internal", "w_divide_a_exponent");
const divideBMantissa = storage("math:internal", "w_divide_b_mantissa");
const divideBExponent = storage("math:internal", "w_divide_b_exponent");
const divideExponent = storage("math:internal", "w_divide_exponent");
const divideSign = storage("math:internal", "w_divide_sign");
const divideReciprocal = storage("math:internal", "w_divide_reciprocal");
const divideQuotient = storage("math:internal", "w_divide_quotient");
const divideProductHigh = storage("math:internal", "w_divide_product_high");
const divideProductLow = storage("math:internal", "w_divide_product_low");
const divideResidualHigh = storage("math:internal", "w_divide_residual_high");
const divideResidualLow = storage("math:internal", "w_divide_residual_low");
const divideCorrection = storage("math:internal", "w_divide_correction");
const divideScale = storage("math:internal", "w_divide_scale");
const divideFactor = storage("math:internal", "w_divide_factor");
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

const storedLogMantissa = storage("math:internal", "w_log_mantissa");
const storedLogReciprocal = storage("math:internal", "w_log_reciprocal");
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
emitPredicate("comparison/x_negative_integer", inlineValueCheck(x, undefined, -1));

const sqrtEstimate = storage("math:internal", "w_sqrt_estimate");
const sqrtMantissa = storage("math:internal", "w_sqrt_mantissa");
const sqrtReciprocal = storage("math:internal", "w_sqrt_reciprocal");
const sqrtScale = storage("math:internal", "w_sqrt_scale");
const sqrtResidual = storage("math:internal", "w_sqrt_residual");
const sqrtEstimateAtLeastTwo = inlineValueCheck(
  storage("math:internal", "w_comparison.sqrt_estimate_at_least_two"),
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
const logBelowCenter = inlineValueCheck(storage("math:internal", "w_comparison.log_center"), undefined, -1);
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
emit("power/positive/00", power(publicA, publicB));

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

for (const [name, value] of [
  ["a", publicA],
  ["b", publicB],
  ["min", storage("math:", "min")],
  ["max", publicMax],
  ["t", publicT],
  ["curve_0", publicCurveX1],
  ["curve_1", publicCurveY1],
  ["curve_2", publicCurveX2],
  ["curve_3", publicCurveY2],
  ["ans", publicAnswer],
  ["amplitude", publicAmplitude],
  ["period", publicPeriod],
  ["oscillations", publicOscillations],
  ["damping", publicDamping],
  ["bounces", publicBounces],
  ["decay", publicDecay],
  ["x", x],
  ...publicRotation.map((value, index) => [`rotation_${index}`, value]),
]) {
  emit(`internal/comparison/finite/${name}`, sum(value, product(-1, value)));
}

for (const [index, component] of publicRotation.entries()) {
  emit(`quaternion_to_axis_angle/input/rotation_${index}`, component);
}

const quaternionMaximum = maximum(...quaternionComponents.flatMap(component => [component, product(-1, component)]));
const quaternionScaleMultiplierA = storage("math:internal", "w_quaternion_scale_multiplier_a");
const quaternionScaleMultiplierB = storage("math:internal", "w_quaternion_scale_multiplier_b");
const quaternionMaximumMantissa = storage("math:internal", "w_quaternion_maximum_mantissa");
const quaternionInverseMaximumMantissa = storage("math:internal", "w_quaternion_inverse_maximum_mantissa");
const quaternionInverseLength = storage("math:internal", "w_quaternion_inverse_length");
const quaternionVectorMaximum = storage("math:internal", "w_quaternion_vector_maximum");
const quaternionVectorScaleMultiplierA = storage("math:internal", "w_quaternion_vector_scale_multiplier_a");
const quaternionVectorScaleMultiplierB = storage("math:internal", "w_quaternion_vector_scale_multiplier_b");
const quaternionVectorMaximumMantissa = storage("math:internal", "w_quaternion_vector_maximum_mantissa");
const quaternionInverseVectorMaximumMantissa = storage("math:internal", "w_quaternion_inverse_vector_maximum_mantissa");
const quaternionVectorScaledRaw = Array.from({ length: 3 }, (_, index) => storage("math:internal", `w_quaternion_vector_scaled_raw_${index}`));
const quaternionVectorScaled = Array.from({ length: 3 }, (_, index) => storage("math:internal", `w_quaternion_vector_scaled_${index}`));
const quaternionInverseVectorLength = storage("math:internal", "w_quaternion_inverse_vector_length");
const quaternionAngle = storage("math:internal", "w_quaternion_angle");

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

// Power needs more than a rounded b*log(a) at the overflow boundary: the
// true binary32 overflow threshold lies inside one float bin. The classifier
// evaluates log1p(m - 1), log(a), and b*log(a) as float expansions (hi + lo)
// using error-free TwoSum/TwoProduct transforms, then compares the residual
// against a split threshold.
emit("power/classify/normalize/difference/00", sum(z, -1));
emit("power/classify/polynomial/initial/00", Math.fround(
  (powerClassifierDegree % 2 === 0 ? -1 : 1) / powerClassifierDegree,
));
for (let degree = powerClassifierDegree - 1; degree >= 1; degree -= 1) {
  const exactCoefficient = (degree % 2 === 0 ? -1 : 1) / degree;
  const coefficient = Math.fround(exactCoefficient);
  const coefficientLow = Math.fround(exactCoefficient - coefficient);
  const stage = degree.toString().padStart(2, "0");
  const productHigh = product(x, z);
  emit(`power/classify/polynomial/${stage}/low/00`, sum(
    twoSumLow(productHigh, coefficient),
    twoProductLow(x, z),
    product(y, z),
    coefficientLow,
  ));
  emit(`power/classify/polynomial/${stage}/high/00`, sum(productHigh, coefficient));
}
emit("power/classify/polynomial/result/low/00", sum(
  twoProductLow(x, z),
  product(y, z),
));
emit("power/classify/polynomial/result/high/00", product(x, z));

const powerLn2High = Math.fround(Math.LN2);
const powerLn2Low = Math.fround(Math.LN2 - powerLn2High);
const powerExponentLn2High = product(w, powerLn2High);
const powerLogHigh = storage("math:internal", "w_power_log_high");
const powerLogLow = storage("math:internal", "w_power_log_low");
const powerProductHigh = storage("math:internal", "w_power_product_high");
const powerProductLow = storage("math:internal", "w_power_product_low");
const powerDelta = storage("math:internal", "w_power_delta");
emit("power/classify/log/low/00", sum(
  twoSumLow(powerExponentLn2High, x),
  twoProductLow(w, powerLn2High),
  product(w, powerLn2Low),
  y,
));
emit("power/classify/log/high/00", sum(powerExponentLn2High, x));
emit("power/classify/log/renormalize/high/00", sum(x, z));
emit("power/classify/log/renormalize/low/00", twoSumLow(x, z, powerLogHigh));
emit("power/classify/product/high/00", product(publicB, powerLogHigh));
emit("power/classify/product/low/00", sum(
  twoProductLow(publicB, powerLogHigh, powerProductHigh),
  product(publicB, powerLogLow),
));
emit("power/classify/delta/00", sum(
  subtractExpression(powerProductHigh, powerOverflowThresholdHigh),
  subtractExpression(powerProductLow, powerOverflowThresholdLow),
));
emit("power/classify/evaluation_exponent/00", minimum(
  sum(powerProductHigh, powerProductLow),
  maximumFiniteExpInput,
));

emitStagedPredicate("range/min_greater_than_max", sum(w, product(-1, z)), undefined, smallestNegativeFloat);
emitStagedPredicate(
  "reciprocal/input_in_range",
  maximum(publicA, product(-1, publicA)),
  smallestFiniteReciprocalInput,
  undefined,
);
emitStagedPredicate("divide/exact_equal", sum(publicA, product(-1, publicB)), 0, 0);
emitStagedPredicate("divide/a_negative", publicA, undefined, smallestNegativeFloat);
emitStagedPredicate("divide/b_negative", publicB, undefined, smallestNegativeFloat);
emitStagedPredicate("atan/x_negative", x, undefined, smallestNegativeFloat);
emitStagedPredicate("atan/use_reciprocal", x, nextPositiveFloat(1), undefined);
emitStagedPredicate("atan/use_pi_four", x, atanOctantBoundary, undefined);
emitStagedPredicate("atan2/a_negative", publicA, undefined, smallestNegativeFloat);
emitStagedPredicate("atan2/b_negative", publicB, undefined, smallestNegativeFloat);
emitStagedPredicate("atan2/a_dominant", subtractExpression(atan2AbsoluteA, atan2AbsoluteB), smallestPositiveFloat, undefined);
emitStagedPredicate("atan2/maximum_zero", atan2Maximum, 0, 0);
emitStagedPredicate("atan2/maximum_subnormal", atan2Maximum, undefined, largestSubnormalFloat);
emitStagedPredicate("bezier/duration_positive", publicMax, smallestPositiveFloat, undefined);
emitStagedPredicate("bezier/time_at_or_below_start", publicT, undefined, 0);
emitStagedPredicate("bezier/time_at_or_after_end", subtractExpression(publicT, publicMax), 0, undefined);
emitStagedPredicate("bezier/x1_in_range", publicCurveX1, 0, 1);
emitStagedPredicate("bezier/x2_in_range", publicCurveX2, 0, 1);
emitStagedPredicate("elastic/duration_positive", publicMax, smallestPositiveFloat, undefined);
emitStagedPredicate("elastic/amplitude_valid", publicAmplitude, 1, undefined);
emitStagedPredicate("elastic/period_positive", publicPeriod, smallestPositiveFloat, undefined);
emitStagedPredicate("elastic/time_at_or_below_start", publicT, undefined, 0);
emitStagedPredicate("elastic/time_at_or_after_end", subtractExpression(publicT, publicMax), 0, undefined);
emitStagedPredicate("elastic_decay/duration_positive", publicMax, smallestPositiveFloat, undefined);
emitStagedPredicate("elastic_decay/oscillations_positive", publicOscillations, smallestPositiveFloat, undefined);
emitStagedPredicate("elastic_decay/damping_positive", publicDamping, smallestPositiveFloat, undefined);
emitStagedPredicate("elastic_decay/time_at_or_below_start", publicT, undefined, 0);
emitStagedPredicate("elastic_decay/time_at_or_after_end", subtractExpression(publicT, publicMax), 0, undefined);
emitStagedPredicate("bounce/duration_positive", publicMax, smallestPositiveFloat, undefined);
emitStagedPredicate("bounce/time_at_or_below_start", publicT, undefined, 0);
emitStagedPredicate("bounce/time_at_or_after_end", subtractExpression(publicT, publicMax), 0, undefined);
emitStagedPredicate("bounce/duration_subnormal", publicMax, undefined, largestSubnormalFloat);
emitStagedPredicate("bounce_decay/duration_positive", publicMax, smallestPositiveFloat, undefined);
emitStagedPredicate("bounce_decay/bounces_positive", publicBounces, smallestPositiveFloat, undefined);
emitStagedPredicate("bounce_decay/decay_nonnegative", publicDecay, 0, undefined);
emitStagedPredicate("bounce_decay/time_at_or_below_start", publicT, undefined, 0);
emitStagedPredicate("bounce_decay/time_at_or_after_end", subtractExpression(publicT, publicMax), 0, undefined);
emitStagedPredicate("divide/exponent_definitely_overflows", divideExponent, 129, undefined);
emitStagedPredicate("divide/exponent_at_overflow_boundary", divideExponent, 128, 128);
emitStagedPredicate("divide/significand_at_or_above_overflow_boundary", sum(divideAMantissa, product(-1, divideBMantissa)), 0, undefined);
emitPredicate("divide/overflow_boundary", {
  type: "minecraft:all_of",
  terms: [
    inlineValueCheck(storage("math:internal", "w_comparison.predicate.divide_exponent_at_overflow_boundary.value"), 0, 0),
    inlineValueCheck(storage("math:internal", "w_comparison.predicate.divide_significand_at_or_above_overflow_boundary.minimum"), 0, undefined),
  ],
});
emitStagedPredicate("divide/exponent_underflows", divideExponent, undefined, -151);
emit("internal/comparison/x_zero", floatComparison(x, 0));
emitPredicate("range/negative", inlineValueCheck(storage("math:internal", "w_comparison.x_sign"), undefined, -1));
emitPredicate("range/positive", inlineValueCheck(storage("math:internal", "w_comparison.x_sign"), 1, undefined));
for (const [variant, guard] of [
  ["radians", "math:tan/guard/radians/00"],
  ["degrees", "math:tan/guard/degrees/00"],
]) {
  emitStagedPredicate(`tan/undefined_${variant}`,
    subtractExpression(maximum(x, product(-1, x)), guard),
    undefined,
    0,
  );
}
emitPredicate("normalize_period/original_negative", inlineValueCheck(
  storage("math:internal", "w_comparison.period_original"),
  undefined,
  -1,
));
emitPredicate("asin_positive/before_target", inlineValueCheck(
  storage("math:internal", "w_comparison.asin_positive_before_target"),
  undefined,
  -1,
));
emitStagedPredicate("inverse_trigonometry/input_in_range", x, -1, 1);
emitStagedPredicate("inverse_trigonometry/x_negative", x, undefined, smallestNegativeFloat);
emitStagedPredicate("inverse_trigonometry/use_complement", x, 0.995, undefined);
emitStagedPredicate(
  "quaternion_to_axis_angle/maximum_zero",
  storage("math:internal", "w_quaternion_maximum"),
  0,
  0,
);
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
emitStagedPredicate("quaternion_to_axis_angle/result_angle_finite", quaternionAngle, -finiteLimit, finiteLimit);
for (let index = 0; index < 3; index += 1) {
  emitStagedPredicate(
    `quaternion_to_axis_angle/result_axis_${index}_finite`,
    quaternionAxis[index],
    -finiteLimit,
    finiteLimit,
  );
}
emitPredicate("inverse_trigonometry/square_before_target", inlineValueCheck(
  storage("math:internal", "w_comparison.inverse_trigonometry_square_before_target"),
  undefined,
  -1,
));
emitStagedPredicate(
  "square_root/needs_refine",
  maximum(sqrtResidual, product(-1, sqrtResidual)),
  squareRootResidualThreshold,
  undefined,
);
emitStagedPredicate("square_root/result_finite", publicAnswer, -finiteLimit, finiteLimit);
emitStagedPredicate("exp/input_finite", x, -finiteLimit, finiteLimit);
emitStagedPredicate("exp/input_in_range", x, undefined, maximumFiniteExpInput);
emitStagedPredicate("exp/underflows_to_zero", x, undefined, maximumZeroExpInput);
emitStagedPredicate("exp/result_finite", publicAnswer, -finiteLimit, finiteLimit);
emitStagedPredicate("power/exponent_negative", y, undefined, smallestNegativeFloat);
emitStagedPredicate("power/exponent_integer", sum(publicB, product(-1, z)), 0, 0);
emitStagedPredicate("power/exponent_large_even", maximum(publicB, product(-1, publicB)), 2 ** 24, undefined);
emitStagedPredicate("power/below_overflow_classification", x, undefined, previousPositiveFloat(Math.fround(88.7)));
emitStagedPredicate("power/needs_overflow_classification", x, 88.7, 88.75);
emitStagedPredicate("power/classifier_overflow", powerDelta, smallestPositiveFloat, undefined);
emitStagedPredicate("rounding/safe_command_result", maximum(x, product(-1, x)), undefined, previousPositiveFloat(2 ** 24));
emitStagedPredicate("rounding/integer_input", maximum(x, product(-1, x)), 2 ** 23, undefined);
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

function validationLines(inputs) {
  const lines = ["data remove storage math: error"];
  for (const input of inputs) {
    lines.push(`data modify storage math:internal w_validation_${input} set compute default math:internal/comparison/finite/${input}`);
    lines.push(`execute unless data storage math:internal {w_validation_${input}:0.0f} run return run function ${functionId(FUNCTION_PATHS.invalidNumber)}`);
  }
  return lines;
}

emitFunction(FUNCTION_PATHS.invalidNumber, [
  "data remove storage math: ans",
  "data modify storage math: error set value \"invalid_number\"",
  "return fail",
]);

emitFunction(FUNCTION_PATHS.resultOutOfRange, [
  "data remove storage math: ans",
  "data modify storage math: error set value \"result_out_of_range\"",
  "return fail",
]);

emitFunction(FUNCTION_PATHS.invalidCurve, [
  "data remove storage math: ans",
  "data modify storage math: error set value \"invalid_curve\"",
  "return fail",
]);

emitFunction(FUNCTION_PATHS.invalidDuration, [
  "data remove storage math: ans",
  "data modify storage math: error set value \"invalid_duration\"",
  "return fail",
]);

emitFunction(FUNCTION_PATHS.invalidElastic, [
  "data remove storage math: ans",
  "data modify storage math: error set value \"invalid_elastic\"",
  "return fail",
]);

emitFunction(FUNCTION_PATHS.invalidBounce, [
  "data remove storage math: ans",
  "data modify storage math: error set value \"invalid_bounce\"",
  "return fail",
]);

emitFunction(FUNCTION_PATHS.invalidQuaternion, [
  "data remove storage math: ans",
  "data modify storage math: error set value \"invalid_quaternion\"",
  "return fail",
]);

emit("common/asin_positive/half_pi", halfPi);
emit("common/inverse_trigonometry/half_pi", halfPi);
emit("common/inverse_trigonometry/pi", pi);
emit("common/inverse_trigonometry/complement", sum(1, product(-1, x, x)));
emit("common/inverse_trigonometry/square_midpoint", product(0.5, sum(
  storage("math:internal", "w_inverse_trigonometry_square_low"),
  storage("math:internal", "w_inverse_trigonometry_square_high"),
)));
emit("common/inverse_trigonometry/square_compare", floatComparison(
  sum(
    product(storage("math:internal", "w_inverse_trigonometry_square_midpoint"), storage("math:internal", "w_inverse_trigonometry_square_midpoint")),
    product(-1, storage("math:internal", "w_inverse_trigonometry_square_target")),
  ),
  0,
));
emit("common/inverse_trigonometry/acos", sum(
  storage("math:internal", "w_inverse_trigonometry_half_pi"),
  product(-1, x),
));
emit("common/asin_positive/midpoint", product(0.5, sum(
  storage("math:internal", "w_asin_low"),
  storage("math:internal", "w_asin_high"),
)));
emit("common/asin_positive/compare", floatComparison(
  sum(
    storage("math:internal", "w_asin_sine"),
    product(-1, storage("math:internal", "w_asin_target")),
  ),
  0,
));

emitFunction(FUNCTION_PATHS.asinPositive, [
  "data modify storage math:internal w_asin_target set from storage math:internal x",
  "data modify storage math:internal w_asin_low set value 0.0f",
  "data modify storage math:internal w_asin_high set compute default math:common/asin_positive/half_pi",
  `function ${functionId(FUNCTION_PATHS.asinPositiveSolve)}`,
  "data modify storage math:internal x set compute default math:common/asin_positive/midpoint",
  "return 1",
]);

{
  const lines = [];
  for (let iteration = 0; iteration < 20; iteration += 1) {
    lines.push(`function ${functionId(FUNCTION_PATHS.asinPositiveStep)}`);
  }
  lines.push("return 1");
  emitFunction(FUNCTION_PATHS.asinPositiveSolve, lines);
}

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

// The public functions validate their inputs first; these internal entry points
// receive a normalized binary32 x in [-1, 1] and leave their radians result in x.
emitFunction(FUNCTION_PATHS.asin, [
  "data modify storage math:internal w_inverse_trigonometry_input set from storage math:internal x",
  "execute if data storage math:internal {w_inverse_trigonometry_input:-1.0f} run data modify storage math:internal x set compute default math:common/inverse_trigonometry/half_pi",
  "execute if data storage math:internal {w_inverse_trigonometry_input:-1.0f} run data modify storage math:internal x set compute default math:common/rounding/negate",
  "execute if data storage math:internal {w_inverse_trigonometry_input:-1.0f} run return 1",
  "execute if data storage math:internal {w_inverse_trigonometry_input:0.0f} run data modify storage math:internal x set from storage math:internal w_inverse_trigonometry_input",
  "execute if data storage math:internal {w_inverse_trigonometry_input:0.0f} run data modify storage math:internal x set compute default math:common/input/x",
  "execute if data storage math:internal {w_inverse_trigonometry_input:0.0f} run return 1",
  "execute if data storage math:internal {w_inverse_trigonometry_input:1.0f} run data modify storage math:internal x set compute default math:common/inverse_trigonometry/half_pi",
  "execute if data storage math:internal {w_inverse_trigonometry_input:1.0f} run return 1",
  ...stagePredicate("inverse_trigonometry/x_negative"),
  "execute if predicate math:internal/inverse_trigonometry/x_negative run data modify storage math:internal x set compute default math:common/rounding/negate",
  ...stagePredicate("inverse_trigonometry/use_complement"),
  "execute if predicate math:internal/inverse_trigonometry/use_complement run data modify storage math:internal w_inverse_trigonometry_square_target set compute default math:common/inverse_trigonometry/complement",
  `execute if predicate math:internal/inverse_trigonometry/use_complement run function ${functionId(FUNCTION_PATHS.inverseTrigonometrySquareRoot)}`,
  `execute if predicate math:internal/inverse_trigonometry/use_complement run function ${functionId(FUNCTION_PATHS.asinPositive)}`,
  "execute if predicate math:internal/inverse_trigonometry/use_complement run data modify storage math:internal w_inverse_trigonometry_half_pi set compute default math:common/inverse_trigonometry/half_pi",
  "execute if predicate math:internal/inverse_trigonometry/use_complement run data modify storage math:internal x set compute default math:common/inverse_trigonometry/acos",
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
  const lines = validationLines(["a"]);
  lines.push("data modify storage math:internal x set compute default math:common/input/a");
  lines.push(...stagePredicate("inverse_trigonometry/input_in_range"));
  lines.push(`execute if predicate math:internal/inverse_trigonometry/input_in_range run function ${functionId(sharedFunction)}`);
  if (degrees) lines.push("execute if predicate math:internal/inverse_trigonometry/input_in_range run data modify storage math:internal x set compute default math:common/conversion/deg");
  lines.push("execute if predicate math:internal/inverse_trigonometry/input_in_range run data modify storage math: ans set from storage math:internal x");
  lines.push("execute if predicate math:internal/inverse_trigonometry/input_in_range run return 1");
  lines.push("data remove storage math: ans");
  lines.push("data modify storage math: error set value \"non_real_result\"");
  lines.push("return fail");
  return lines;
}

emitPublicFunction("asin", inverseTrigonometryPublicLines(FUNCTION_PATHS.asin));
emitPublicFunction("asin_degrees", inverseTrigonometryPublicLines(FUNCTION_PATHS.asin, true));
emitPublicFunction("acos", inverseTrigonometryPublicLines(FUNCTION_PATHS.acos));
emitPublicFunction("acos_degrees", inverseTrigonometryPublicLines(FUNCTION_PATHS.acos, true));

emitFunction(FUNCTION_PATHS.atanEvaluate, [
  "data modify storage math:internal w_atan_square set compute default math:common/atan/square",
  "data modify storage math:internal x set compute default math:common/atan/polynomial",
  "execute if predicate math:internal/atan/use_pi_four run data modify storage math:internal x set compute default math:common/atan/after_pi_four",
  "execute if predicate math:internal/atan/use_reciprocal run data modify storage math:internal x set compute default math:common/atan/after_reciprocal",
  "execute if predicate math:internal/atan/x_negative run data modify storage math:internal x set compute default math:common/rounding/negate",
  "return 1",
]);

emitFunction(FUNCTION_PATHS.atan, [
  "data modify storage math:internal w_atan_input set from storage math:internal x",
  "execute if data storage math:internal {w_atan_input:0.0f} run return 1",
  ...stagePredicate("atan/x_negative"),
  "data modify storage math:internal x set compute default math:common/comparison/absolute",
  ...stagePredicate("atan/use_reciprocal"),
  "execute if predicate math:internal/atan/use_reciprocal run data modify storage math:internal y set value 1.0f",
  `execute if predicate math:internal/atan/use_reciprocal run function ${functionId(FUNCTION_PATHS.reciprocal)}`,
  ...stagePredicate("atan/use_pi_four"),
  "execute if predicate math:internal/atan/use_pi_four run data modify storage math:internal w_atan_numerator set compute default math:common/atan/numerator",
  "execute if predicate math:internal/atan/use_pi_four run data modify storage math:internal x set compute default math:common/atan/denominator",
  "execute if predicate math:internal/atan/use_pi_four run data modify storage math:internal y set value 1.0f",
  `execute if predicate math:internal/atan/use_pi_four run function ${functionId(FUNCTION_PATHS.reciprocal)}`,
  "execute if predicate math:internal/atan/use_pi_four run data modify storage math:internal x set compute default math:common/atan/reduced",
  `return run function ${functionId(FUNCTION_PATHS.atanEvaluate)}`,
]);

function atanPublicLines(degrees = false) {
  const lines = validationLines(["a"]);
  lines.push("data modify storage math:internal x set compute default math:common/input/a");
  lines.push(`function ${functionId(FUNCTION_PATHS.atan)}`);
  if (degrees) lines.push("data modify storage math:internal x set compute default math:common/conversion/deg");
  lines.push("data modify storage math: ans set from storage math:internal x");
  lines.push("return 1");
  return lines;
}

emitPublicFunction("atan", atanPublicLines());
emitPublicFunction("atan_degrees", atanPublicLines(true));

function atan2PublicLines(degrees = false) {
  const lines = validationLines(["a", "b"]);
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
  lines.push("execute if predicate math:internal/atan2/maximum_subnormal run data modify storage math:internal w_atan2_minimum set compute default math:atan2/scaled_minimum");
  lines.push("execute if predicate math:internal/atan2/maximum_subnormal run data modify storage math:internal w_atan2_maximum set compute default math:atan2/scaled_maximum");
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
  lines.push("return 1");
  return lines;
}

emitPublicFunction("atan2", atan2PublicLines());
emitPublicFunction("atan2_degrees", atan2PublicLines(true));

const elasticAmplitude = storage("math:internal", "w_elastic_amplitude");
const elasticPhase = storage("math:internal", "w_elastic_phase");
const elasticInversePeriod = storage("math:internal", "w_elastic_inverse_period");
const elasticU = storage("math:internal", "w_elastic_u");
const elasticDecay = storage("math:internal", "w_elastic_decay");
const elasticSine = storage("math:internal", "w_elastic_sine");
const elasticEased = storage("math:internal", "w_elastic_eased");
const elasticDecayU = storage("math:internal", "w_elastic_decay_u");
const elasticDecayFactor = storage("math:internal", "w_elastic_decay_factor");
const elasticDecayCosine = storage("math:internal", "w_elastic_decay_cosine");
const elasticDecayEased = storage("math:internal", "w_elastic_decay_eased");
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

emitFunction(FUNCTION_PATHS.elasticFinish, [
  "data modify storage math:internal w_elastic_eased set compute default math:elastic/eased",
  "data modify storage math: ans set compute default math:elastic/result",
  "data modify storage math:internal w_validation_ans set compute default math:internal/comparison/finite/ans",
  `execute unless data storage math:internal {w_validation_ans:0.0f} run return run function ${functionId(FUNCTION_PATHS.resultOutOfRange)}`,
  "return 1",
]);

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
  `return run function ${functionId(FUNCTION_PATHS.elasticFinish)}`,
]);

{
  const lines = validationLines(["a", "b", "t", "max", "amplitude"]);
  lines.push("data modify storage math:internal w_elastic_amplitude set compute default math:elastic/input/amplitude");
  lines.push("data modify storage math:internal w_validation_period set compute default math:internal/comparison/finite/period");
  lines.push(`execute unless data storage math:internal {w_validation_period:0.0f} run return run function ${functionId(FUNCTION_PATHS.invalidNumber)}`);
  lines.push(...stagePredicate("elastic/duration_positive"));
  lines.push(`execute unless predicate math:internal/elastic/duration_positive run return run function ${functionId(FUNCTION_PATHS.invalidDuration)}`);
  lines.push(...stagePredicate("elastic/amplitude_valid"));
  lines.push(`execute unless predicate math:internal/elastic/amplitude_valid run return run function ${functionId(FUNCTION_PATHS.invalidElastic)}`);
  lines.push(...stagePredicate("elastic/period_positive"));
  lines.push(`execute unless predicate math:internal/elastic/period_positive run return run function ${functionId(FUNCTION_PATHS.invalidElastic)}`);
  lines.push(...stagePredicate("elastic/time_at_or_below_start"));
  lines.push("execute if predicate math:internal/elastic/time_at_or_below_start run data modify storage math: ans set from storage math: a");
  lines.push("execute if predicate math:internal/elastic/time_at_or_below_start run return 1");
  lines.push(...stagePredicate("elastic/time_at_or_after_end"));
  lines.push("execute if predicate math:internal/elastic/time_at_or_after_end run data modify storage math: ans set from storage math: b");
  lines.push("execute if predicate math:internal/elastic/time_at_or_after_end run return 1");
  lines.push("execute if data storage math:internal {w_elastic_amplitude:1.0f} run data modify storage math:internal x set compute default math:common/asin_positive/half_pi");
  lines.push(`execute if data storage math:internal {w_elastic_amplitude:1.0f} run return run function ${functionId(FUNCTION_PATHS.elasticPhase)}`);
  lines.push("data modify storage math:internal x set from storage math:internal w_elastic_amplitude");
  lines.push("data modify storage math:internal y set value 1.0f");
  lines.push(`function ${functionId(FUNCTION_PATHS.reciprocal)}`);
  lines.push(`function ${functionId(FUNCTION_PATHS.asinPositive)}`);
  lines.push(`return run function ${functionId(FUNCTION_PATHS.elasticPhase)}`);
  emitPublicFunction("elastic", lines);
}

emitFunction(FUNCTION_PATHS.elasticDecayFinish, [
  "data modify storage math:internal w_elastic_decay_eased set compute default math:elastic_decay/eased",
  "data modify storage math: ans set compute default math:elastic_decay/result",
  "data modify storage math:internal w_validation_ans set compute default math:internal/comparison/finite/ans",
  `execute unless data storage math:internal {w_validation_ans:0.0f} run return run function ${functionId(FUNCTION_PATHS.resultOutOfRange)}`,
  "return 1",
]);

{
  const lines = validationLines(["a", "b", "t", "max", "oscillations", "damping"]);
  lines.push(...stagePredicate("elastic_decay/duration_positive"));
  lines.push(`execute unless predicate math:internal/elastic_decay/duration_positive run return run function ${functionId(FUNCTION_PATHS.invalidDuration)}`);
  lines.push(...stagePredicate("elastic_decay/oscillations_positive"));
  lines.push(`execute unless predicate math:internal/elastic_decay/oscillations_positive run return run function ${functionId(FUNCTION_PATHS.invalidElastic)}`);
  lines.push(...stagePredicate("elastic_decay/damping_positive"));
  lines.push(`execute unless predicate math:internal/elastic_decay/damping_positive run return run function ${functionId(FUNCTION_PATHS.invalidElastic)}`);
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
  lines.push(`return run function ${functionId(FUNCTION_PATHS.elasticDecayFinish)}`);
  emitPublicFunction("elastic_decay", lines);
}

const bounceU = storage("math:internal", "w_bounce_u");
const bounceEased = storage("math:internal", "w_bounce_eased");
const bounceDecayU = storage("math:internal", "w_bounce_decay_u");
const bounceDecayFactor = storage("math:internal", "w_bounce_decay_factor");
const bounceDecayWave = storage("math:internal", "w_bounce_decay_wave");
const bounceDecayEased = storage("math:internal", "w_bounce_decay_eased");
const bounceCoefficient = Math.fround(7.5625);
const shiftedBounce = (offset, base) => sum(base, product(
  bounceCoefficient,
  sum(bounceU, -offset),
  sum(bounceU, -offset),
));

const bounceScaledT = storage("math:internal", "w_bounce_scaled_t");
emit("bounce/scaled_t", product(publicT, 2 ** 126));
emit("bounce/scaled_max", product(publicMax, 2 ** 126));
emit("bounce/u", product(bounceScaledT, x));
const bounceComparisons = [4 / 11, 8 / 11, 10 / 11].map((threshold, index) => {
  const comparison = storage("math:internal", `w_comparison.bounce_${index}`);
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

emitFunction(FUNCTION_PATHS.bounceFinish, [
  "data modify storage math:internal w_bounce_eased set compute default math:bounce/eased",
  "data modify storage math: ans set compute default math:bounce/result",
  "data modify storage math:internal w_validation_ans set compute default math:internal/comparison/finite/ans",
  `execute unless data storage math:internal {w_validation_ans:0.0f} run return run function ${functionId(FUNCTION_PATHS.resultOutOfRange)}`,
  "return 1",
]);

{
  const lines = validationLines(["a", "b", "t", "max"]);
  lines.push(...stagePredicate("bounce/duration_positive"));
  lines.push(`execute unless predicate math:internal/bounce/duration_positive run return run function ${functionId(FUNCTION_PATHS.invalidDuration)}`);
  lines.push(...stagePredicate("bounce/time_at_or_below_start"));
  lines.push("execute if predicate math:internal/bounce/time_at_or_below_start run data modify storage math: ans set compute default math:common/input/a");
  lines.push("execute if predicate math:internal/bounce/time_at_or_below_start run return 1");
  lines.push(...stagePredicate("bounce/time_at_or_after_end"));
  lines.push("execute if predicate math:internal/bounce/time_at_or_after_end run data modify storage math: ans set compute default math:common/input/b");
  lines.push("execute if predicate math:internal/bounce/time_at_or_after_end run return 1");
  lines.push("data modify storage math:internal w_bounce_scaled_t set from storage math: t");
  lines.push("data modify storage math:internal x set from storage math: max");
  lines.push(...stagePredicate("bounce/duration_subnormal"));
  lines.push("execute if predicate math:internal/bounce/duration_subnormal run data modify storage math:internal w_bounce_scaled_t set compute default math:bounce/scaled_t");
  lines.push("execute if predicate math:internal/bounce/duration_subnormal run data modify storage math:internal x set compute default math:bounce/scaled_max");
  lines.push("data modify storage math:internal y set value 1.0f");
  lines.push(`function ${functionId(FUNCTION_PATHS.reciprocal)}`);
  lines.push("data modify storage math:internal w_bounce_u set compute default math:bounce/u");
  for (let index = 0; index < bounceComparisons.length; index += 1) {
    lines.push(`data modify storage math:internal w_comparison.bounce_${index} set compute default math:bounce/compare_${index}`);
  }
  lines.push(`return run function ${functionId(FUNCTION_PATHS.bounceFinish)}`);
  emitPublicFunction("bounce", lines);
}

emitFunction(FUNCTION_PATHS.bounceDecayFinish, [
  "data modify storage math:internal w_bounce_decay_eased set compute default math:bounce_decay/eased",
  "data modify storage math: ans set compute default math:bounce_decay/result",
  "data modify storage math:internal w_validation_ans set compute default math:internal/comparison/finite/ans",
  `execute unless data storage math:internal {w_validation_ans:0.0f} run return run function ${functionId(FUNCTION_PATHS.resultOutOfRange)}`,
  "return 1",
]);

{
  const lines = validationLines(["a", "b", "t", "max", "bounces", "decay"]);
  lines.push(...stagePredicate("bounce_decay/duration_positive"));
  lines.push(`execute unless predicate math:internal/bounce_decay/duration_positive run return run function ${functionId(FUNCTION_PATHS.invalidDuration)}`);
  lines.push(...stagePredicate("bounce_decay/bounces_positive"));
  lines.push(`execute unless predicate math:internal/bounce_decay/bounces_positive run return run function ${functionId(FUNCTION_PATHS.invalidBounce)}`);
  lines.push(...stagePredicate("bounce_decay/decay_nonnegative"));
  lines.push(`execute unless predicate math:internal/bounce_decay/decay_nonnegative run return run function ${functionId(FUNCTION_PATHS.invalidBounce)}`);
  lines.push(...stagePredicate("bounce_decay/time_at_or_below_start"));
  lines.push("execute if predicate math:internal/bounce_decay/time_at_or_below_start run data modify storage math: ans set compute default math:common/input/a");
  lines.push("execute if predicate math:internal/bounce_decay/time_at_or_below_start run return 1");
  lines.push(...stagePredicate("bounce_decay/time_at_or_after_end"));
  lines.push("execute if predicate math:internal/bounce_decay/time_at_or_after_end run data modify storage math: ans set compute default math:common/input/b");
  lines.push("execute if predicate math:internal/bounce_decay/time_at_or_after_end run return 1");
  lines.push("data modify storage math:internal w_bounce_scaled_t set from storage math: t");
  lines.push("data modify storage math:internal x set from storage math: max");
  lines.push(...stagePredicate("bounce/duration_subnormal"));
  lines.push("execute if predicate math:internal/bounce/duration_subnormal run data modify storage math:internal w_bounce_scaled_t set compute default math:bounce/scaled_t");
  lines.push("execute if predicate math:internal/bounce/duration_subnormal run data modify storage math:internal x set compute default math:bounce/scaled_max");
  lines.push("data modify storage math:internal y set value 1.0f");
  lines.push(`function ${functionId(FUNCTION_PATHS.reciprocal)}`);
  lines.push("data modify storage math:internal w_bounce_decay_u set compute default math:bounce_decay/u");
  lines.push("data modify storage math:internal x set compute default math:bounce_decay/phase");
  lines.push(`function ${functionId(FUNCTION_PATHS.floor)}`);
  lines.push("data modify storage math:internal w_bounce_decay_wave set compute default math:bounce_decay/wave");
  lines.push("data modify storage math:internal x set compute default math:bounce_decay/exponent");
  lines.push(`function ${functionId(FUNCTION_PATHS.exp)}`);
  lines.push("data modify storage math:internal w_bounce_decay_factor set from storage math:internal x");
  lines.push(`return run function ${functionId(FUNCTION_PATHS.bounceDecayFinish)}`);
  emitPublicFunction("bounce_decay", lines);
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

emitFunction(FUNCTION_PATHS.bezierFinish, [
  "data modify storage math:internal w_bezier_midpoint set compute default math:bezier/midpoint",
  "data modify storage math:internal w_bezier_y set compute default math:bezier/y",
  "data modify storage math: ans set compute default math:bezier/result",
  "data modify storage math:internal w_validation_ans set compute default math:internal/comparison/finite/ans",
  `execute unless data storage math:internal {w_validation_ans:0.0f} run return run function ${functionId(FUNCTION_PATHS.resultOutOfRange)}`,
  "return 1",
]);

{
  const lines = validationLines(["a", "b", "t", "max"]);
  lines.push(`execute unless data storage math: curve[3] run return run function ${functionId(FUNCTION_PATHS.invalidCurve)}`);
  lines.push(`execute if data storage math: curve[4] run return run function ${functionId(FUNCTION_PATHS.invalidCurve)}`);
  for (let index = 0; index < 4; index += 1) {
    lines.push(`execute store success storage math:internal w_validation_curve_numeric_${index} byte 1 run data get storage math: curve[${index}] 1`);
    lines.push(`execute unless data storage math:internal {w_validation_curve_numeric_${index}:1b} run return run function ${functionId(FUNCTION_PATHS.invalidCurve)}`);
  }
  for (const field of ["x1", "y1", "x2", "y2"]) {
    lines.push(`data remove storage math:internal w_bezier_${field}`);
    lines.push(`data modify storage math:internal w_bezier_${field} set compute default math:bezier/input/${field}`);
    lines.push(`execute unless data storage math:internal w_bezier_${field} run return run function ${functionId(FUNCTION_PATHS.invalidCurve)}`);
  }
  for (let index = 0; index < 4; index += 1) {
    lines.push(`data remove storage math:internal w_validation_curve_${index}`);
    lines.push(`data modify storage math:internal w_validation_curve_${index} set compute default math:internal/comparison/finite/curve_${index}`);
    lines.push(`execute unless data storage math:internal w_validation_curve_${index} run return run function ${functionId(FUNCTION_PATHS.invalidCurve)}`);
    lines.push(`execute unless data storage math:internal {w_validation_curve_${index}:0.0f} run return run function ${functionId(FUNCTION_PATHS.invalidNumber)}`);
  }
  lines.push(...stagePredicate("bezier/duration_positive"));
  lines.push(`execute unless predicate math:internal/bezier/duration_positive run return run function ${functionId(FUNCTION_PATHS.invalidDuration)}`);
  lines.push(...stagePredicate("bezier/x1_in_range"));
  lines.push(`execute unless predicate math:internal/bezier/x1_in_range run return run function ${functionId(FUNCTION_PATHS.invalidCurve)}`);
  lines.push(...stagePredicate("bezier/x2_in_range"));
  lines.push(`execute unless predicate math:internal/bezier/x2_in_range run return run function ${functionId(FUNCTION_PATHS.invalidCurve)}`);
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
  lines.push(`return run function ${functionId(FUNCTION_PATHS.bezierFinish)}`);
  emitPublicFunction("bezier", lines);
}

function wrapper(name, inputs, provider, inputMap) {
  const lines = validationLines(inputs);
  for (const [internalName, publicName] of Object.entries(inputMap)) {
    lines.push(`data modify storage math:internal ${internalName} set from storage math: ${publicName}`);
  }
  lines.push(`data modify storage math: ans set compute default ${provider}`);
  if (["add", "sub", "mul", "square", "cube", "deg", "lerp"].includes(name)) {
    lines.push("data modify storage math:internal w_validation_ans set compute default math:internal/comparison/finite/ans");
    lines.push(`execute unless data storage math:internal {w_validation_ans:0.0f} run return run function ${functionId(FUNCTION_PATHS.resultOutOfRange)}`);
  }
  lines.push("return 1");
  emitPublicFunction(name, lines);
}

wrapper("add", ["a", "b"], "math:common/arithmetic/add", { x: "a", y: "b" });
wrapper("sub", ["a", "b"], "math:common/arithmetic/subtract", { x: "a", y: "b" });
wrapper("mul", ["a", "b"], "math:common/arithmetic/multiply", { x: "a", y: "b" });
wrapper("abs", ["a"], "math:common/comparison/absolute", { x: "a" });
wrapper("min", ["a", "b"], "math:common/comparison/minimum", { x: "a", y: "b" });
wrapper("max", ["a", "b"], "math:common/comparison/maximum", { x: "a", y: "b" });
wrapper("square", ["a"], "math:common/arithmetic/square", { x: "a" });
wrapper("cube", ["a"], "math:common/arithmetic/cube", { x: "a" });
wrapper("rad", ["a"], "math:common/conversion/rad", { x: "a" });
wrapper("deg", ["a"], "math:common/conversion/deg", { x: "a" });
wrapper("lerp", ["a", "b", "t"], "math:common/arithmetic/lerp", { x: "a", y: "b", z: "t" });
wrapper("floor", ["a"], "math:common/rounding/floor", { x: "a" });
wrapper("ceil", ["a"], "math:common/rounding/ceil", { x: "a" });
wrapper("round", ["a"], "math:common/rounding/round", { x: "a" });
wrapper("truncate", ["a"], "math:common/rounding/truncate", { x: "a" });
for (const name of ["pi", "tau", "e"]) wrapper(name, [], `math:common/constant/${name}`, {});

emitFunction(FUNCTION_PATHS.floor, [
  "data modify storage math:internal z set compute default math:common/rounding/floor",
  "return 1",
]);

emitFunction(FUNCTION_PATHS.truncate, [
  "data modify storage math:internal z set compute default math:common/rounding/truncate",
  "return 1",
]);

function divisionByZeroLines() {
  return [
    "execute if data storage math:internal {x:0.0f} run data remove storage math: ans",
    "execute if data storage math:internal {x:0.0f} run data modify storage math: error set value \"division_by_zero\"",
    "execute if data storage math:internal {x:0.0f} run return fail",
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

emitFunction(FUNCTION_PATHS.divideUnderflow, [
  "data modify storage math: ans set value 0.0f",
  "execute if data storage math:internal {w_divide_sign:-1.0f} run data modify storage math: ans set value -0.0f",
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

{
  const lines = validationLines(["a"]);
  lines.push("data modify storage math:internal x set from storage math: a");
  lines.push(...divisionByZeroLines());
  lines.push("data remove storage math: ans");
  lines.push("data modify storage math: ans set compute default math:common/arithmetic/reciprocal");
  lines.push(`execute unless data storage math: ans run return run function ${functionId(FUNCTION_PATHS.resultOutOfRange)}`);
  lines.push("data modify storage math:internal w_validation_ans set compute default math:internal/comparison/finite/ans");
  lines.push(`execute unless data storage math:internal {w_validation_ans:0.0f} run return run function ${functionId(FUNCTION_PATHS.resultOutOfRange)}`);
  lines.push("return 1");
  emitPublicFunction("reciprocal", lines);
}

{
  const lines = validationLines(["a"]);
  lines.push("data modify storage math:internal x set from storage math: a");
  lines.push("data modify storage math:internal w_comparison.x_sign set compute default math:internal/comparison/x_zero");
  lines.push("execute if predicate math:internal/range/negative run data remove storage math: ans");
  lines.push("execute if predicate math:internal/range/negative run data modify storage math: error set value \"negative_square_root\"");
  lines.push("execute if predicate math:internal/range/negative run return fail");
  lines.push("execute if data storage math:internal {x:0.0f} run data modify storage math: ans set value 0.0f");
  lines.push("execute if data storage math:internal {x:0.0f} run return 1");
  lines.push("data modify storage math: ans set compute default math:square_root/00");
  lines.push("return 1");
  emitPublicFunction("sqrt", lines);
}

function internalSquareRootLines(inputProvider, outputPath) {
  return [
    `data modify storage math:internal x set compute default ${inputProvider}`,
    `data modify storage math:internal ${outputPath} set compute default math:square_root/00`,
  ];
}

{
  const lines = ["data remove storage math: error"];
  lines.push(`execute unless data storage math: rotation[3] run return run function ${functionId(FUNCTION_PATHS.invalidQuaternion)}`);
  lines.push(`execute if data storage math: rotation[4] run return run function ${functionId(FUNCTION_PATHS.invalidQuaternion)}`);
  for (let index = 0; index < 4; index += 1) {
    lines.push(`execute store success storage math:internal w_validation_rotation_numeric_${index} byte 1 run data get storage math: rotation[${index}] 1`);
    lines.push(`execute unless data storage math:internal {w_validation_rotation_numeric_${index}:1b} run return run function ${functionId(FUNCTION_PATHS.invalidQuaternion)}`);
  }
  for (let index = 0; index < 4; index += 1) {
    lines.push(`data modify storage math:internal w_quaternion_component_${index} set compute default math:quaternion_to_axis_angle/input/rotation_${index}`);
    lines.push(`data modify storage math:internal w_validation_rotation_${index} set compute default math:internal/comparison/finite/rotation_${index}`);
    lines.push(`execute unless data storage math:internal {w_validation_rotation_${index}:0.0f} run return run function ${functionId(FUNCTION_PATHS.invalidQuaternion)}`);
  }
  lines.push("data modify storage math:internal w_quaternion_maximum set compute default math:quaternion_to_axis_angle/normalize/maximum");
  lines.push(...stagePredicate("quaternion_to_axis_angle/maximum_zero"));
  lines.push(`execute if predicate math:internal/quaternion_to_axis_angle/maximum_zero run return run function ${functionId(FUNCTION_PATHS.invalidQuaternion)}`);
  lines.push(`return run function ${functionId(FUNCTION_PATHS.quaternionNormalize)}`);
  emitPublicFunction("quaternion_to_axis_angle", lines);
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
  "execute if predicate math:internal/quaternion_to_axis_angle/scalar_negative run data modify storage math:internal w_quaternion_angle set compute default math:common/constant/tau",
  `return run function ${functionId(FUNCTION_PATHS.quaternionFinish)}`,
]);

{
  const lines = [];
  for (const name of ["angle", "axis_0", "axis_1", "axis_2"]) {
    lines.push(...stagePredicate(`quaternion_to_axis_angle/result_${name}_finite`));
    lines.push(`execute unless predicate math:internal/quaternion_to_axis_angle/result_${name}_finite run return run function ${functionId(FUNCTION_PATHS.resultOutOfRange)}`);
  }
  lines.push("data modify storage math: ans set value {angle:0.0f,axis:[0.0f,0.0f,0.0f]}");
  lines.push("data modify storage math: ans.angle set compute default math:quaternion_to_axis_angle/output/stored_angle");
  for (let index = 0; index < 3; index += 1) {
    lines.push(`data modify storage math: ans.axis[${index}] set compute default math:quaternion_to_axis_angle/output/stored_axis_${index}`);
  }
  lines.push("return 1");
  emitFunction(FUNCTION_PATHS.quaternionFinish, lines);
}

emitFunction(FUNCTION_PATHS.logPrepare, [
  `function ${functionId(FUNCTION_PATHS.normalizeBinary32)}`,
  "data modify storage math:internal w_comparison.log_center set compute default math:log/normalize/compare_center/00",
  "data modify storage math:internal z set compute default math:log/normalize/centered_mantissa/00",
  "data modify storage math:internal w set compute default math:log/normalize/centered_exponent/00",
  "return 1",
]);

emitFunction(FUNCTION_PATHS.log, [
  `function ${functionId(FUNCTION_PATHS.logPrepare)}`,
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

function resultOutOfRangeLines(predicate = "math:internal/exp/input_in_range") {
  const relativePath = predicate.replace("math:internal/", "");
  return [
    ...stagePredicate(relativePath),
    `execute unless predicate ${predicate} run data remove storage math: ans`,
    `execute unless predicate ${predicate} run data modify storage math: error set value "result_out_of_range"`,
    `execute unless predicate ${predicate} run return fail`,
  ];
}

{
  const lines = [
    "data modify storage math:internal x set from storage math: a",
    "data modify storage math:internal x set compute default math:common/comparison/absolute",
    `function ${functionId(FUNCTION_PATHS.logPrepare)}`,
    "data modify storage math:internal z set compute default math:power/classify/normalize/difference/00",
    "data modify storage math:internal x set compute default math:power/classify/polynomial/initial/00",
    "data modify storage math:internal y set value 0.0f",
  ];
  for (let degree = powerClassifierDegree - 1; degree >= 1; degree -= 1) {
    const stage = degree.toString().padStart(2, "0");
    lines.push(`data modify storage math:internal y set compute default math:power/classify/polynomial/${stage}/low/00`);
    lines.push(`data modify storage math:internal x set compute default math:power/classify/polynomial/${stage}/high/00`);
  }
  lines.push("data modify storage math:internal y set compute default math:power/classify/polynomial/result/low/00");
  lines.push("data modify storage math:internal x set compute default math:power/classify/polynomial/result/high/00");
  lines.push("data modify storage math:internal z set compute default math:power/classify/log/low/00");
  lines.push("data modify storage math:internal x set compute default math:power/classify/log/high/00");
  lines.push("data modify storage math:internal w_power_log_high set compute default math:power/classify/log/renormalize/high/00");
  lines.push("data modify storage math:internal w_power_log_low set compute default math:power/classify/log/renormalize/low/00");
  lines.push("data modify storage math:internal w_power_product_high set compute default math:power/classify/product/high/00");
  lines.push("data modify storage math:internal w_power_product_low set compute default math:power/classify/product/low/00");
  lines.push("data modify storage math:internal w_power_delta set compute default math:power/classify/delta/00");
  lines.push("return 1");
  emitFunction(FUNCTION_PATHS.powerClassifyOverflow, lines);
}

function finalPowerResultLines(negativeResult) {
  const lines = [`function ${functionId(FUNCTION_PATHS.exp)}`];
  lines.push(negativeResult
    ? "data modify storage math: ans set compute default math:common/rounding/negate"
    : "data modify storage math: ans set compute default math:common/input/x");
  lines.push(...resultOutOfRangeLines("math:internal/exp/result_finite"));
  lines.push("return 1");
  return lines;
}

function powerNonfiniteLines(negativeResult) {
  return [
    "data modify storage math:internal w_comparison.x_sign set compute default math:internal/comparison/x_zero",
    `execute if predicate math:internal/range/negative run data modify storage math: ans set value ${negativeResult ? "-0.0f" : "0.0f"}`,
    "execute if predicate math:internal/range/negative run return 1",
    "data remove storage math: ans",
    "data modify storage math: error set value \"result_out_of_range\"",
    "return fail",
  ];
}

function powerBoundaryLines(negativeResult) {
  return [
    ...stagePredicate("power/needs_overflow_classification"),
    "execute unless predicate math:internal/power/needs_overflow_classification run data remove storage math: ans",
    "execute unless predicate math:internal/power/needs_overflow_classification run data modify storage math: error set value \"result_out_of_range\"",
    "execute unless predicate math:internal/power/needs_overflow_classification run return fail",
    `function ${functionId(FUNCTION_PATHS.powerClassifyOverflow)}`,
    ...stagePredicate("power/classifier_overflow"),
    "execute if predicate math:internal/power/classifier_overflow run data remove storage math: ans",
    "execute if predicate math:internal/power/classifier_overflow run data modify storage math: error set value \"result_out_of_range\"",
    "execute if predicate math:internal/power/classifier_overflow run return fail",
    "data modify storage math:internal x set compute default math:power/classify/evaluation_exponent/00",
    ...finalPowerResultLines(negativeResult),
  ];
}

function powerEvaluationLines(negativeResult) {
  const lines = [
    `function ${functionId(FUNCTION_PATHS.log)}`,
    "data modify storage math:internal x set compute default math:power/positive/00",
    ...stagePredicate("power/below_overflow_classification"),
    `execute unless predicate math:internal/power/below_overflow_classification run return run function ${functionId(negativeResult ? FUNCTION_PATHS.powerBoundaryNegative : FUNCTION_PATHS.powerBoundaryPositive)}`,
    ...stagePredicate("exp/underflows_to_zero"),
    `execute if predicate math:internal/exp/underflows_to_zero run data modify storage math: ans set value ${negativeResult ? "-0.0f" : "0.0f"}`,
    "execute if predicate math:internal/exp/underflows_to_zero run return 1",
  ];
  lines.push(`execute if data storage math:internal {x:-103.97207641601562f} run data modify storage math: ans set compute default math:exp/minimum/${negativeResult ? "negative/" : ""}00`);
  lines.push("execute if data storage math:internal {x:-103.97207641601562f} run return 1");
  lines.push(`function ${functionId(FUNCTION_PATHS.exp)}`);
  lines.push(negativeResult
    ? "data modify storage math: ans set compute default math:common/rounding/negate"
    : "data modify storage math: ans set compute default math:common/input/x");
  lines.push("return 1");
  return lines;
}

emitFunction(FUNCTION_PATHS.powerNonfinitePositive, powerNonfiniteLines(false));
emitFunction(FUNCTION_PATHS.powerNonfiniteNegative, powerNonfiniteLines(true));
emitFunction(FUNCTION_PATHS.powerBoundaryPositive, powerBoundaryLines(false));
emitFunction(FUNCTION_PATHS.powerBoundaryNegative, powerBoundaryLines(true));
const nativePowerResultLines = [
  "data remove storage math: ans",
  "data modify storage math: ans set compute default math:power/positive/00",
  `execute unless data storage math: ans run return run function ${functionId(FUNCTION_PATHS.resultOutOfRange)}`,
  "data modify storage math:internal w_validation_ans set compute default math:internal/comparison/finite/ans",
  `execute unless data storage math:internal {w_validation_ans:0.0f} run return run function ${functionId(FUNCTION_PATHS.resultOutOfRange)}`,
  "return 1",
];
emitFunction(FUNCTION_PATHS.powerPositive, nativePowerResultLines);
emitFunction(FUNCTION_PATHS.powerNegativeOdd, nativePowerResultLines);

emitFunction(FUNCTION_PATHS.powerZero, [
  "execute if data storage math:internal {y:0.0f} run data modify storage math: ans set value 1.0f",
  "execute if data storage math:internal {y:0.0f} run return 1",
  ...stagePredicate("power/exponent_negative"),
  "execute if predicate math:internal/power/exponent_negative run data remove storage math: ans",
  "execute if predicate math:internal/power/exponent_negative run data modify storage math: error set value \"zero_to_negative_power\"",
  "execute if predicate math:internal/power/exponent_negative run return fail",
  "data modify storage math: ans set value 0.0f",
  "return 1",
]);

emitFunction(FUNCTION_PATHS.powerNegative, [
  "data modify storage math:internal x set from storage math:internal y",
  `function ${functionId(FUNCTION_PATHS.truncate)}`,
  ...stagePredicate("power/exponent_integer"),
  "execute unless predicate math:internal/power/exponent_integer run data remove storage math: ans",
  "execute unless predicate math:internal/power/exponent_integer run data modify storage math: error set value \"non_real_result\"",
  "execute unless predicate math:internal/power/exponent_integer run return fail",
  `return run function ${functionId(FUNCTION_PATHS.powerNegativeOdd)}`,
]);

{
  const lines = validationLines(["a"]);
  lines.push("data modify storage math:internal x set from storage math: a");
  lines.push("data modify storage math:internal w_comparison.x_sign set compute default math:internal/comparison/x_zero");
  lines.push("execute if predicate math:internal/range/negative run data remove storage math: ans");
  lines.push("execute if predicate math:internal/range/negative run data modify storage math: error set value \"non_real_result\"");
  lines.push("execute if predicate math:internal/range/negative run return fail");
  lines.push("execute if data storage math:internal {x:0.0f} run data remove storage math: ans");
  lines.push("execute if data storage math:internal {x:0.0f} run data modify storage math: error set value \"non_real_result\"");
  lines.push("execute if data storage math:internal {x:0.0f} run return fail");
  lines.push(`function ${functionId(FUNCTION_PATHS.log)}`);
  lines.push("data modify storage math: ans set compute default math:common/input/x");
  lines.push("return 1");
  emitPublicFunction("log", lines);
}

{
  const lines = validationLines(["a"]);
  lines.push("data modify storage math:internal x set from storage math: a");
  lines.push(...resultOutOfRangeLines());
  lines.push(...stagePredicate("exp/underflows_to_zero"));
  lines.push("execute if predicate math:internal/exp/underflows_to_zero run data modify storage math: ans set value 0.0f");
  lines.push("execute if predicate math:internal/exp/underflows_to_zero run return 1");
  lines.push("execute if data storage math:internal {x:-103.97207641601562f} run data modify storage math: ans set compute default math:exp/minimum/00");
  lines.push("execute if data storage math:internal {x:-103.97207641601562f} run return 1");
  lines.push(`function ${functionId(FUNCTION_PATHS.exp)}`);
  lines.push("data modify storage math: ans set compute default math:common/input/x");
  lines.push(...resultOutOfRangeLines("math:internal/exp/result_finite"));
  lines.push("return 1");
  emitPublicFunction("exp", lines);
}

{
  const lines = validationLines(["a", "b"]);
  lines.push("data modify storage math:internal x set from storage math: a");
  lines.push("data modify storage math:internal y set from storage math: b");
  lines.push(`execute if data storage math:internal {x:0.0f} run return run function ${functionId(FUNCTION_PATHS.powerZero)}`);
  lines.push("execute if data storage math:internal {y:1.0f} run data modify storage math: ans set compute default math:common/input/x");
  lines.push("execute if data storage math:internal {y:1.0f} run return 1");
  lines.push("data modify storage math:internal w_comparison.x_sign set compute default math:internal/comparison/x_zero");
  lines.push(`execute if predicate math:internal/range/negative run return run function ${functionId(FUNCTION_PATHS.powerNegative)}`);
  lines.push(`return run function ${functionId(FUNCTION_PATHS.powerPositive)}`);
  emitPublicFunction("pow", lines);
}

{
  const lines = validationLines(["a", "b"]);
  lines.push("data modify storage math:internal x set from storage math: b");
  lines.push(...divisionByZeroLines());
  lines.push("data modify storage math:internal x set from storage math: a");
  lines.push("data modify storage math:internal y set from storage math: b");
  lines.push("data modify storage math: ans set compute default math:common/arithmetic/divide");
  lines.push("data modify storage math:internal w_validation_ans set compute default math:internal/comparison/finite/ans");
  lines.push(`execute unless data storage math:internal {w_validation_ans:0.0f} run return run function ${functionId(FUNCTION_PATHS.resultOutOfRange)}`);
  lines.push("return 1");
  emitPublicFunction("div", lines);
}

const reduceRemainderNearPath = ".common/reduce_remainder/1.near";
const reduceRemainderShallowOnePath = ".common/reduce_remainder/2.shallow_one";
const reduceRemainderShallowTwoPath = ".common/reduce_remainder/3.shallow_two";
const reduceRemainderFinishOnePath = ".common/reduce_remainder/4.finish_one";
const reduceRemainderFinishTwoPath = ".common/reduce_remainder/5.finish_two";
const reduceRemainderDescendingPath = ".common/reduce_remainder/6.descend";

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

function shallowRemainderLines(finishPath, nextPath) {
  const lines = [
    ...stagePredicate("rounding/remainder/y_too_large_to_double"),
    "execute if predicate math:internal/rounding/remainder/y_too_large_to_double run data modify storage math:internal x set compute default math:common/arithmetic/subtract",
    `execute if predicate math:internal/rounding/remainder/y_too_large_to_double run return run function ${functionId(finishPath)}`,
    "data modify storage math:internal w set compute default math:common/rounding/double_y",
    ...stagePredicate("rounding/remainder/w_greater_than_x"),
    "execute if predicate math:internal/rounding/remainder/w_greater_than_x run data modify storage math:internal x set compute default math:common/arithmetic/subtract",
    `execute if predicate math:internal/rounding/remainder/w_greater_than_x run return run function ${functionId(finishPath)}`,
  ];
  if (nextPath) {
    lines.push("data modify storage math:internal y set from storage math:internal w");
    lines.push(`return run function ${functionId(nextPath)}`);
  } else {
    lines.push("return fail");
  }
  return lines;
}

emitFunction(reduceRemainderFinishOnePath, fixedRemainderDescentLines(1));
emitFunction(reduceRemainderFinishTwoPath, fixedRemainderDescentLines(2));
emitFunction(reduceRemainderShallowOnePath, shallowRemainderLines(
  reduceRemainderFinishOnePath,
  reduceRemainderShallowTwoPath,
));
emitFunction(reduceRemainderShallowTwoPath, shallowRemainderLines(reduceRemainderFinishTwoPath));
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
  "execute if predicate math:internal/rounding/remainder/w_greater_than_x run data modify storage math:internal w_remainder_scaled_divisor set compute default math:common/reduce_remainder/half_scaled_divisor",
  "execute if predicate math:internal/rounding/remainder/w_greater_than_x run data modify storage math:internal w_remainder_shift set compute default math:common/reduce_remainder/decrement_shift",
  "data modify storage math:internal w_remainder_remaining_shift set from storage math:internal w_remainder_shift",
  "data modify storage math:internal y set from storage math:internal w_remainder_scaled_divisor",
  `function ${functionId(reduceRemainderDescendingPath)}`,
  "data modify storage math:internal y set from storage math:internal w_remainder_divisor",
  "data modify storage math:internal z set from storage math:internal w_remainder_original",
  "return 1",
]);

{
  const lines = validationLines(["a", "b"]);
  lines.push("data modify storage math:internal x set from storage math: b");
  lines.push(...divisionByZeroLines());
  lines.push("data modify storage math:internal x set from storage math: a");
  lines.push("data modify storage math:internal y set from storage math: b");
  lines.push("data modify storage math: ans set compute default math:remainder/00");
  lines.push("return 1");
  emitPublicFunction("remainder", lines);
}

emitFunction(FUNCTION_PATHS.moduloNegativeB, [
  "execute if predicate math:internal/rounding/public/a_negative run data modify storage math:internal x set from storage math:internal z",
  "execute if predicate math:internal/rounding/public/a_negative run data modify storage math: ans set compute default math:common/rounding/negate",
  "execute if predicate math:internal/rounding/public/a_negative run return 1",
  "data modify storage math:internal x set from storage math:internal z",
  "data modify storage math: ans set compute default math:common/arithmetic/subtract",
  "return 1",
]);

{
  const lines = validationLines(["a", "b"]);
  lines.push("data modify storage math:internal x set from storage math: b");
  lines.push(...divisionByZeroLines());
  lines.push(...exactRemainderLines());
  lines.push(...stagePredicate("rounding/remainder/zero"));
  lines.push("execute if predicate math:internal/rounding/remainder/zero run data modify storage math: ans set value 0.0f");
  lines.push("execute if predicate math:internal/rounding/remainder/zero run return 1");
  lines.push(...stagePredicate("rounding/public/a_negative"));
  lines.push(...stagePredicate("rounding/public/b_negative"));
  lines.push(`execute if predicate math:internal/rounding/public/b_negative run return run function ${functionId(FUNCTION_PATHS.moduloNegativeB)}`);
  lines.push("execute unless predicate math:internal/rounding/public/a_negative run data modify storage math: ans set compute default math:common/input/z");
  lines.push("execute unless predicate math:internal/rounding/public/a_negative run return 1");
  lines.push("data modify storage math:internal x set from storage math:internal y");
  lines.push("data modify storage math:internal y set from storage math:internal z");
  lines.push("data modify storage math: ans set compute default math:common/arithmetic/subtract");
  lines.push("return 1");
  emitPublicFunction("mod", lines);
}

emitFunction(FUNCTION_PATHS.normalizePeriod, [
  "data modify storage math:internal z set from storage math:internal x",
  "data modify storage math:internal x set compute default math:common/comparison/absolute",
  `function ${functionId(FUNCTION_PATHS.reduceRemainder)}`,
  "data modify storage math:internal w_comparison.period_half set compute default math:common/normalize/period/compare_half",
  "data modify storage math:internal w_comparison.period_original set compute default math:common/normalize/period/compare_original",
  "data modify storage math:internal w set from storage math:internal z",
  `execute if predicate math:internal/normalize_period/original_negative run return run function ${functionId(FUNCTION_PATHS.normalizePeriodNegative)}`,
  "data modify storage math:internal z set compute default math:common/normalize/period/positive/00",
  "return 1",
]);

emitFunction(FUNCTION_PATHS.normalizePeriodNegative, [
  "data modify storage math:internal z set compute default math:common/normalize/period/negative/00",
  "return 1",
]);

emitFunction(FUNCTION_PATHS.sinEvaluate, [
  "data modify storage math:internal w_comparison.sin_fold_lower set compute default math:sin/fold/compare_lower",
  "data modify storage math:internal w_comparison.sin_fold_upper set compute default math:sin/fold/compare_upper",
  "data modify storage math:internal x set compute default math:sin/fold/00",
  "data modify storage math:internal w_comparison.sin_positive_lower set compute default math:sin/compare/positive_lower",
  "data modify storage math:internal w_comparison.sin_positive_upper set compute default math:sin/compare/positive_upper",
  "data modify storage math:internal w_comparison.sin_negative_lower set compute default math:sin/compare/negative_lower",
  "data modify storage math:internal w_comparison.sin_negative_upper set compute default math:sin/compare/negative_upper",
  "data modify storage math:internal x set compute default math:sin/00",
  "return 1",
]);

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

function tangentResultLines(predicate, variant) {
  return [
    "data modify storage math:internal x set from storage math:internal w_tan_cos",
    `data modify storage math:internal w_comparison.tan_domain set compute default math:tan/guard/${variant}/compare_domain`,
    ...stagePredicate(`tan/undefined_${variant}`),
    `execute if predicate ${predicate} run data remove storage math: ans`,
    `execute if predicate ${predicate} run data modify storage math: error set value "undefined_tangent"`,
    `execute if predicate ${predicate} run return fail`,
    "data modify storage math: ans set compute default math:tan/00",
    "return 1",
  ];
}

function trigWrapper(name, kernelPath, isTangent, degrees, zeroResult) {
  const lines = validationLines(["a"]);
  lines.push("data modify storage math:internal x set from storage math: a");
  if (degrees) lines.push("data modify storage math:internal x set compute default math:common/conversion/rad");
  lines.push(`execute if data storage math:internal {x:0.0f} run data modify storage math: ans set ${zeroResult}`);
  lines.push("execute if data storage math:internal {x:0.0f} run return 1");
  if (isTangent) {
    lines.push(`function ${functionId(kernelPath)}`);
    const variant = degrees ? "degrees" : "radians";
    lines.push(...tangentResultLines(`math:internal/tan/undefined_${variant}`, variant));
  } else {
    lines.push(`function ${functionId(kernelPath)}`);
    lines.push("data modify storage math: ans set compute default math:common/input/x");
    lines.push("return 1");
  }
  emitPublicFunction(name, lines);
}

for (const degrees of [false, true]) {
  const suffix = degrees ? "_degrees" : "";
  trigWrapper(`sin${suffix}`, FUNCTION_PATHS.sin, false, degrees, "compute default math:common/input/x");
  trigWrapper(`cos${suffix}`, FUNCTION_PATHS.cos, false, degrees, "value 1.0f");
  trigWrapper(`tan${suffix}`, FUNCTION_PATHS.tan, true, degrees, "compute default math:common/input/x");
}

{
  const lines = validationLines(["a"]);
  lines.push("data modify storage math:internal x set from storage math: a");
  lines.push("data modify storage math: ans set value 0.0f");
  lines.push("data modify storage math:internal w_comparison.x_sign set compute default math:internal/comparison/x_zero");
  lines.push("execute if predicate math:internal/range/negative run data modify storage math: ans set value -1.0f");
  lines.push("execute if predicate math:internal/range/positive run data modify storage math: ans set value 1.0f");
  lines.push("return 1");
  emitPublicFunction("sign", lines);
}

{
  const lines = validationLines(["a", "min", "max"]);
  lines.push("data modify storage math:internal x set from storage math: a");
  lines.push("data modify storage math:internal z set from storage math: min");
  lines.push("data modify storage math:internal w set from storage math: max");
  lines.push(...stagePredicate("range/min_greater_than_max"));
  lines.push("execute if predicate math:internal/range/min_greater_than_max run data remove storage math: ans");
  lines.push("execute if predicate math:internal/range/min_greater_than_max run data modify storage math: error set value \"invalid_clamp_range\"");
  lines.push("execute if predicate math:internal/range/min_greater_than_max run return fail");
  lines.push("data modify storage math: ans set compute default math:common/comparison/clamp");
  lines.push("return 1");
  emitPublicFunction("clamp", lines);
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
      }
    }
  }
  fs.rmSync(path.join(targetRoot, "Math", "data", "math", "number_provider"), { recursive: true, force: true });
  fs.rmSync(path.join(targetRoot, "Math", "data", "math", "context_float_provider", "common"), { recursive: true, force: true });
  fs.rmSync(path.join(targetRoot, "Math", "data", "math", "function", "internal"), { recursive: true, force: true });
  fs.rmSync(path.join(targetRoot, "Math", "data", "math", "function", "common"), { recursive: true, force: true });
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
