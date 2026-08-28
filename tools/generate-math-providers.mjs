import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  floatComparison,
  maximum,
  minimum,
  product,
  storage,
  sum,
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
const generatedFiles = [];

function emit(relativePath, value) {
  generatedFiles.push({ kind: "json", relativePath: `Math/data/math/number_provider/${relativePath}.json`, value });
}

function emitPredicate(relativePath, value) {
  generatedFiles.push({ kind: "json", relativePath: `Math/data/math/predicate/internal/${relativePath}.json`, value });
}

function emitFunction(path, lines) {
  generatedFiles.push({ kind: "function", relativePath: `Math/data/math/function/${path}.mcfunction`, text: `${lines.join("\n")}\n` });
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

function inlineValueCheck(value, min, max) {
  return floatRange(value, min, max);
}

function floatRange(value, min, max) {
  const range = {};
  if (min !== undefined) range.min = min;
  if (max !== undefined) range.max = max;
  return {
    type: "minecraft:value_check",
    value,
    range,
  };
}

const stagedPredicateCommands = new Map();

function emitStagedPredicate(relativePath, value, min, max) {
  const storagePath = `w_comparison.predicate.${relativePath.replaceAll("/", "_")}`;
  const stages = [];
  const terms = [];
  const addBoundary = (name, threshold, range) => {
    const providerPath = `internal/comparison/predicate/${relativePath}/${name}`;
    const materializedPath = `${storagePath}.${name}`;
    emit(providerPath, floatComparison(value, threshold));
    stages.push(`data modify storage math:internal ${materializedPath} set compute default math:${providerPath}`);
    terms.push(inlineValueCheck(storage("math:internal", materializedPath), range.min, range.max));
  };

  if (min !== undefined && max !== undefined && Object.is(min, max)) {
    addBoundary("value", min, { min: 0, max: 0 });
  } else {
    if (min !== undefined) addBoundary("minimum", min, { min: 0 });
    if (max !== undefined) addBoundary("maximum", max, { max: 0 });
  }
  emitPredicate(relativePath, terms.length === 1 ? terms[0] : { type: "minecraft:all_of", terms });
  stagedPredicateCommands.set(relativePath, stages);
}

function stagePredicate(relativePath) {
  const lines = stagedPredicateCommands.get(relativePath);
  if (!lines) throw new Error(`No staged predicate registered for ${relativePath}`);
  return lines;
}

function numberDispatcher(cases, defaultValue = 0) {
  return {
    type: "minecraft:number_dispatcher",
    cases,
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

function subtractExpression(left, right) {
  return sum(left, product(-1, right));
}

function twoSumLow(left, right) {
  const high = sum(left, right);
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

function twoProductLow(left, right) {
  const high = product(left, right);
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
emit("common/normalize/binary32/exponent", sum(-149, ...normalizeExponentSteps));
emit("common/normalize/binary32/scale", balancedRangeLookup(
  normalizeExponentEntries,
  storedNormalizeExponent,
  entry => entry.scale,
));
emit("common/normalize/binary32/multiplier_a", balancedRangeLookup(
  normalizeExponentEntries,
  storedNormalizeExponent,
  entry => entry.multiplierA,
));
emit("common/normalize/binary32/multiplier_b", balancedRangeLookup(
  normalizeExponentEntries,
  storedNormalizeExponent,
  entry => entry.multiplierB,
));
emit("common/normalize/binary32/mantissa_a", product(x, storedNormalizeMultiplierA));
emit("common/normalize/binary32/mantissa_b", product(storedNormalizeMantissa, storedNormalizeMultiplierB));

for (const [name, provider] of Object.entries({ x, y, z, w })) emit(`common/input/${name}`, provider);

emit("common/constant/pi", Math.fround(Math.PI));
emit("common/constant/tau", Math.fround(Math.PI * 2));
emit("common/constant/e", Math.fround(Math.E));
emit("common/arithmetic/add", sum(x, y));
emit("common/arithmetic/subtract", sum(x, product(-1, y)));
emit("common/arithmetic/multiply", product(x, y));
emit("common/arithmetic/square", product(x, x));
emit("common/arithmetic/cube", product(x, x, x));
emit("common/arithmetic/lerp", sum(x, product(z, sum(y, product(-1, x)))));
emit("common/comparison/absolute", maximum(x, product(-1, x)));
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
emit("bezier/next_low", numberDispatcher([{
  condition: inlineValueCheck(storage("math:internal", "w_comparison.bezier_x"), undefined, -1),
  number_provider: bezierMidpoint,
}], bezierLow));
emit("bezier/next_high", numberDispatcher([{
  condition: inlineValueCheck(storage("math:internal", "w_comparison.bezier_x"), 0, undefined),
  number_provider: bezierMidpoint,
}], bezierHigh));
emit("bezier/result", sum(publicA, product(
  storage("math:internal", "w_bezier_y"),
  sum(publicB, product(-1, publicA)),
)));
emit("common/rounding/negate", product(-1, x));
emit("common/rounding/add_half", sum(x, 0.5));
emit("common/rounding/quotient", product(x, w));
emit("common/rounding/reduce", sum(w, product(-1, z, y)));
emit("common/rounding/double_y", product(2, y));
emit("common/rounding/half_y", product(0.5, y));
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
              sum(sineC7, product(x, x, sineC9)),
            ),
          ),
        ),
      ),
    ),
  ),
));
emit("sin/00", numberDispatcher([
  {
    condition: {
      type: "minecraft:all_of",
      terms: [
        inlineValueCheck(storage("math:internal", "w_comparison.sin_positive_lower"), 0, undefined),
        inlineValueCheck(storage("math:internal", "w_comparison.sin_positive_upper"), undefined, 0),
      ],
    },
    number_provider: 1,
  },
  {
    condition: {
      type: "minecraft:all_of",
      terms: [
        inlineValueCheck(storage("math:internal", "w_comparison.sin_negative_lower"), 0, undefined),
        inlineValueCheck(storage("math:internal", "w_comparison.sin_negative_upper"), undefined, 0),
      ],
    },
    number_provider: -1,
  },
], "math:sin/polynomial/00"));
emit("sin/compare/positive_lower", floatComparison(x, halfPiPrevious));
emit("sin/compare/positive_upper", floatComparison(x, halfPiNext));
emit("sin/compare/negative_lower", floatComparison(x, -halfPiNext));
emit("sin/compare/negative_upper", floatComparison(x, -halfPiPrevious));
emit("cos/00", sum(x, halfPi));
emit("tan/00", product(storage("math:internal", "w_tan_sin"), x));
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
const divideScaleEntries = [];
for (let exponent = -150; exponent <= 128; exponent += 1) {
  divideScaleEntries.push({
    exponent,
    maximum: exponent,
    scale: exponent === -150
      ? smallestPositiveFloat
      : exponent === 128
        ? Math.fround(2 ** 127)
        : Math.fround(2 ** exponent),
    factor: exponent === -150 ? 0.5 : exponent === 128 ? 2 : 1,
  });
}
emit("internal/divide/scale", balancedRangeLookup(divideScaleEntries, divideExponent, entry => entry.scale));
emit("internal/divide/factor", balancedRangeLookup(divideScaleEntries, divideExponent, entry => entry.factor));

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

emit("square_root/normalize/compare_below_one/00", product(sum(z, -1), Math.fround(2 ** 24)));
emit("square_root/normalize/compare_at_least_four/00", product(sum(z, -4), Math.fround(2 ** 22)));
emit("square_root/normalize/quadruple_mantissa/00", product(4, z));
emit("square_root/normalize/quarter_mantissa/00", product(0.25, z));
emit("square_root/normalize/half_scale/00", product(0.5, w));
emit("square_root/normalize/double_scale/00", product(2, w));

emit("square_root/approximate/00", product(0.5, sum(y, 1)));
for (let stage = 0; stage < 3; stage += 1) {
  emit(`square_root/newton/${stage.toString().padStart(2, "0")}/00`, product(
    0.5,
    sum(z, product(y, w)),
  ));
}
emit("square_root/00", product(
  w,
  z,
));

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
emit("power/positive/00", product(x, y));

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
  ["x", x],
]) {
  emit(`internal/comparison/finite/${name}`, sum(value, product(-1, value)));
}

// Power needs more than a rounded b*log(a) at the overflow boundary: the
// true binary32 overflow threshold lies inside one float bin. The classifier
// evaluates log1p(m - 1), log(a), and b*log(a) as float expansions (hi + lo)
// using error-free TwoSum/TwoProduct transforms, then compares the residual
// against a split threshold.
emit("power/classify/normalize/difference/00", sum(z, -1));
emit("power/classify/polynomial/initial/00", Math.fround(-1 / 32));
for (let degree = 31; degree >= 1; degree -= 1) {
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
emit("power/classify/log/low/00", sum(
  twoSumLow(powerExponentLn2High, x),
  twoProductLow(w, powerLn2High),
  product(w, powerLn2Low),
  y,
));
emit("power/classify/log/high/00", sum(powerExponentLn2High, x));
emit("power/classify/log/renormalize/low/00", twoSumLow(x, y));
emit("power/classify/log/renormalize/high/00", sum(x, y));
emit("power/classify/product/low/00", sum(
  twoProductLow(publicB, x),
  product(publicB, y),
));
emit("power/classify/product/high/00", product(publicB, x));
emit("power/classify/delta/00", sum(
  subtractExpression(w, powerOverflowThresholdHigh),
  subtractExpression(z, powerOverflowThresholdLow),
));
emit("power/classify/evaluation_exponent/00", minimum(
  sum(w, z),
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
emitStagedPredicate("bezier/duration_positive", publicMax, smallestPositiveFloat, undefined);
emitStagedPredicate("bezier/time_at_or_below_start", publicT, undefined, 0);
emitStagedPredicate("bezier/time_at_or_after_end", subtractExpression(publicT, publicMax), 0, undefined);
emitStagedPredicate("bezier/x1_in_range", publicCurveX1, 0, 1);
emitStagedPredicate("bezier/x2_in_range", publicCurveX2, 0, 1);
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
emitStagedPredicate("square_root/result_finite", publicAnswer, -finiteLimit, finiteLimit);
emitStagedPredicate("exp/input_finite", x, -finiteLimit, finiteLimit);
emitStagedPredicate("exp/input_in_range", x, undefined, maximumFiniteExpInput);
emitStagedPredicate("exp/underflows_to_zero", x, undefined, maximumZeroExpInput);
emitStagedPredicate("exp/result_finite", publicAnswer, -finiteLimit, finiteLimit);
emitStagedPredicate("power/exponent_negative", y, undefined, smallestNegativeFloat);
emitStagedPredicate("power/exponent_integer", sum(publicB, product(-1, z)), 0, 0);
emitStagedPredicate("power/exponent_large_even", maximum(publicB, product(-1, publicB)), 2 ** 24, undefined);
emitStagedPredicate("power/needs_overflow_classification", x, 88.7, 88.75);
emitStagedPredicate("power/classifier_overflow", x, smallestPositiveFloat, undefined);
emitStagedPredicate("rounding/safe_command_result", maximum(x, product(-1, x)), undefined, previousPositiveFloat(2 ** 24));
emitStagedPredicate("rounding/integer_input", maximum(x, product(-1, x)), 2 ** 23, undefined);
emitStagedPredicate("rounding/remainder/can_subtract_y", sum(x, product(-1, y)), 0, undefined);
emitStagedPredicate("rounding/remainder/w_greater_than_x", sum(w, product(-1, x)), -smallestNegativeFloat, undefined);
emitStagedPredicate("rounding/remainder/y_too_large_to_double", y, 2 ** 127, undefined);
emitStagedPredicate("rounding/remainder/zero", z, 0, 0);
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

emitFunction(FUNCTION_PATHS.bezierValidateCurve, [
  "$execute if data storage math: {curve:[$(x1)f,$(y1)f,$(x2)f,$(y2)f]} run data modify storage math:internal w_validation_curve_type set value 1b",
]);

{
  const lines = [];
  for (let iteration = 0; iteration < 20; iteration += 1) {
    lines.push("data modify storage math:internal w_bezier_midpoint set compute default math:bezier/midpoint");
    lines.push("data modify storage math:internal w_comparison.bezier_x set compute default math:bezier/compare_x");
    lines.push("data modify storage math:internal w_bezier_low set compute default math:bezier/next_low");
    lines.push("data modify storage math:internal w_bezier_high set compute default math:bezier/next_high");
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
  for (const field of ["x1", "y1", "x2", "y2"]) {
    lines.push(`data remove storage math:internal w_bezier_${field}`);
    lines.push(`data modify storage math:internal w_bezier_${field} set compute default math:bezier/input/${field}`);
    lines.push(`execute unless data storage math:internal w_bezier_${field} run return run function ${functionId(FUNCTION_PATHS.invalidCurve)}`);
    lines.push(`data modify storage math:internal w_bezier_curve_macro.${field} set from storage math:internal w_bezier_${field}`);
  }
  lines.push("data modify storage math:internal w_validation_curve_type set value 0b");
  lines.push(`function ${functionId(FUNCTION_PATHS.bezierValidateCurve)} with storage math:internal w_bezier_curve_macro`);
  lines.push(`execute unless data storage math:internal {w_validation_curve_type:1b} run return run function ${functionId(FUNCTION_PATHS.invalidCurve)}`);
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
  if (["add", "subtract", "multiply", "square", "cube", "deg", "lerp"].includes(name)) {
    lines.push("data modify storage math:internal w_validation_ans set compute default math:internal/comparison/finite/ans");
    lines.push(`execute unless data storage math:internal {w_validation_ans:0.0f} run return run function ${functionId(FUNCTION_PATHS.resultOutOfRange)}`);
  }
  lines.push("return 1");
  emitPublicFunction(name, lines);
}

wrapper("add", ["a", "b"], "math:common/arithmetic/add", { x: "a", y: "b" });
wrapper("subtract", ["a", "b"], "math:common/arithmetic/subtract", { x: "a", y: "b" });
wrapper("multiply", ["a", "b"], "math:common/arithmetic/multiply", { x: "a", y: "b" });
wrapper("absolute", ["a"], "math:common/comparison/absolute", { x: "a" });
wrapper("minimum", ["a", "b"], "math:common/comparison/minimum", { x: "a", y: "b" });
wrapper("maximum", ["a", "b"], "math:common/comparison/maximum", { x: "a", y: "b" });
wrapper("square", ["a"], "math:common/arithmetic/square", { x: "a" });
wrapper("cube", ["a"], "math:common/arithmetic/cube", { x: "a" });
wrapper("rad", ["a"], "math:common/conversion/rad", { x: "a" });
wrapper("deg", ["a"], "math:common/conversion/deg", { x: "a" });
wrapper("lerp", ["a", "b", "t"], "math:common/arithmetic/lerp", { x: "a", y: "b", z: "t" });
for (const name of ["pi", "tau", "e"]) wrapper(name, [], `math:common/constant/${name}`, {});

emitFunction(FUNCTION_PATHS.floor, [
  "data modify storage math:internal z set compute default math:common/input/x",
  ...stagePredicate("rounding/safe_command_result"),
  "execute unless predicate math:internal/rounding/safe_command_result run return 1",
  "execute store result storage math:internal z float 1 run compute default math:common/input/x",
  "return 1",
]);

emitFunction(FUNCTION_PATHS.truncate, [
  "data modify storage math:internal w_comparison.x_sign set compute default math:internal/comparison/x_zero",
  `execute unless predicate math:internal/range/negative run return run function ${functionId(FUNCTION_PATHS.floor)}`,
  "data modify storage math:internal x set compute default math:common/rounding/negate",
  `function ${functionId(FUNCTION_PATHS.floor)}`,
  "data modify storage math:internal x set from storage math:internal z",
  "data modify storage math:internal z set compute default math:common/rounding/negate",
  "return 1",
]);

{
  const lines = validationLines(["a"]);
  lines.push("data modify storage math:internal x set from storage math: a");
  lines.push(`function ${functionId(FUNCTION_PATHS.floor)}`);
  lines.push("data modify storage math: ans set compute default math:common/input/z");
  lines.push("return 1");
  emitPublicFunction("floor", lines);
}

{
  const lines = validationLines(["a"]);
  lines.push("data modify storage math:internal x set from storage math: a");
  lines.push("data modify storage math:internal x set compute default math:common/rounding/negate");
  lines.push(`function ${functionId(FUNCTION_PATHS.floor)}`);
  lines.push("data modify storage math:internal x set from storage math:internal z");
  lines.push("data modify storage math: ans set compute default math:common/rounding/negate");
  lines.push("return 1");
  emitPublicFunction("ceil", lines);
}

{
  const lines = validationLines(["a"]);
  lines.push("data modify storage math:internal x set from storage math: a");
  lines.push(...stagePredicate("rounding/integer_input"));
  lines.push("execute if predicate math:internal/rounding/integer_input run data modify storage math: ans set compute default math:common/input/x");
  lines.push("execute if predicate math:internal/rounding/integer_input run return 1");
  lines.push("data modify storage math:internal x set compute default math:common/rounding/add_half");
  lines.push(`function ${functionId(FUNCTION_PATHS.floor)}`);
  lines.push("data modify storage math: ans set compute default math:common/input/z");
  lines.push("return 1");
  emitPublicFunction("round", lines);
}

{
  const lines = validationLines(["a"]);
  lines.push("data modify storage math:internal x set from storage math: a");
  lines.push(`function ${functionId(FUNCTION_PATHS.truncate)}`);
  lines.push("data modify storage math: ans set compute default math:common/input/z");
  lines.push("return 1");
  emitPublicFunction("truncate", lines);
}

function divisionByZeroLines() {
  return [
    "execute if data storage math:internal {x:0.0f} run data remove storage math: ans",
    "execute if data storage math:internal {x:0.0f} run data modify storage math: error set value \"division_by_zero\"",
    "execute if data storage math:internal {x:0.0f} run return fail",
  ];
}

emitFunction(FUNCTION_PATHS.normalizeBinary32, [
  "data modify storage math:internal w_normalize_exponent set compute default math:common/normalize/binary32/exponent",
  "data modify storage math:internal w_normalize_scale set compute default math:common/normalize/binary32/scale",
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

emitFunction(FUNCTION_PATHS.squareRootNormalizeScaleUp, [
  "data modify storage math:internal z set compute default math:square_root/normalize/quadruple_mantissa/00",
  "data modify storage math:internal w set compute default math:square_root/normalize/half_scale/00",
  `return run function ${functionId(FUNCTION_PATHS.squareRootNormalize)}`,
]);

emitFunction(FUNCTION_PATHS.squareRootNormalizeScaleDown, [
  "data modify storage math:internal z set compute default math:square_root/normalize/quarter_mantissa/00",
  "data modify storage math:internal w set compute default math:square_root/normalize/double_scale/00",
  `return run function ${functionId(FUNCTION_PATHS.squareRootNormalize)}`,
]);

emitFunction(FUNCTION_PATHS.squareRootNormalize, [
  "data modify storage math:internal x set compute default math:square_root/normalize/compare_below_one/00",
  `execute if predicate math:internal/comparison/x_negative_integer run return run function ${functionId(FUNCTION_PATHS.squareRootNormalizeScaleUp)}`,
  "data modify storage math:internal x set compute default math:square_root/normalize/compare_at_least_four/00",
  `execute unless predicate math:internal/comparison/x_negative_integer run return run function ${functionId(FUNCTION_PATHS.squareRootNormalizeScaleDown)}`,
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
  lines.push(...resultOutOfRangeLines("math:internal/reciprocal/input_in_range"));
  lines.push("data modify storage math:internal y set value 1.0f");
  lines.push(`function ${functionId(FUNCTION_PATHS.reciprocal)}`);
  lines.push("data modify storage math: ans set compute default math:common/input/x");
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
  lines.push("data modify storage math:internal z set from storage math:internal x");
  lines.push("data modify storage math:internal w set value 1.0f");
  lines.push(`function ${functionId(FUNCTION_PATHS.squareRootNormalize)}`);
  lines.push("data modify storage math:internal w_comparison.sqrt_scale set from storage math:internal w");
  lines.push("data modify storage math:internal w_comparison.sqrt_mantissa set from storage math:internal z");
  lines.push("data modify storage math:internal y set from storage math:internal z");
  lines.push("data modify storage math:internal z set compute default math:square_root/approximate/00");
  for (let stage = 0; stage < 3; stage += 1) {
    const stageName = stage.toString().padStart(2, "0");
    lines.push("data modify storage math:internal x set from storage math:internal z");
    lines.push("data modify storage math:internal y set value 1.0f");
    lines.push(`function ${functionId(FUNCTION_PATHS.reciprocal)}`);
    lines.push("data modify storage math:internal w set from storage math:internal x");
    lines.push("data modify storage math:internal y set from storage math:internal w_comparison.sqrt_mantissa");
    lines.push(`data modify storage math:internal x set compute default math:square_root/newton/${stageName}/00`);
    lines.push("data modify storage math:internal z set from storage math:internal x");
  }
  lines.push("data modify storage math:internal w set from storage math:internal w_comparison.sqrt_scale");
  lines.push("data remove storage math:internal w_comparison.sqrt_scale");
  lines.push("data remove storage math:internal w_comparison.sqrt_mantissa");
  lines.push("data modify storage math: ans set compute default math:square_root/00");
  lines.push(...stagePredicate("square_root/result_finite"));
  lines.push("execute unless predicate math:internal/square_root/result_finite run data remove storage math: ans");
  lines.push("execute unless predicate math:internal/square_root/result_finite run data modify storage math: error set value \"result_out_of_range\"");
  lines.push("execute unless predicate math:internal/square_root/result_finite run return fail");
  lines.push("return 1");
  emitPublicFunction("square_root", lines);
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
  for (let degree = 31; degree >= 1; degree -= 1) {
    const stage = degree.toString().padStart(2, "0");
    lines.push(`data modify storage math:internal y set compute default math:power/classify/polynomial/${stage}/low/00`);
    lines.push(`data modify storage math:internal x set compute default math:power/classify/polynomial/${stage}/high/00`);
  }
  lines.push("data modify storage math:internal y set compute default math:power/classify/polynomial/result/low/00");
  lines.push("data modify storage math:internal x set compute default math:power/classify/polynomial/result/high/00");
  lines.push("data modify storage math:internal y set compute default math:power/classify/log/low/00");
  lines.push("data modify storage math:internal x set compute default math:power/classify/log/high/00");
  lines.push("data modify storage math:internal w set compute default math:power/classify/log/renormalize/low/00");
  lines.push("data modify storage math:internal x set compute default math:power/classify/log/renormalize/high/00");
  lines.push("data modify storage math:internal y set from storage math:internal w");
  lines.push("data modify storage math:internal z set compute default math:power/classify/product/low/00");
  lines.push("data modify storage math:internal w set compute default math:power/classify/product/high/00");
  lines.push("data modify storage math:internal x set compute default math:power/classify/delta/00");
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
    ...stagePredicate("exp/input_finite"),
    `execute unless predicate math:internal/exp/input_finite run return run function ${functionId(negativeResult ? FUNCTION_PATHS.powerNonfiniteNegative : FUNCTION_PATHS.powerNonfinitePositive)}`,
    ...stagePredicate("exp/underflows_to_zero"),
    `execute if predicate math:internal/exp/underflows_to_zero run data modify storage math: ans set value ${negativeResult ? "-0.0f" : "0.0f"}`,
    "execute if predicate math:internal/exp/underflows_to_zero run return 1",
  ];
  lines.push(`execute if data storage math:internal {x:-103.97207641601562f} run data modify storage math: ans set compute default math:exp/minimum/${negativeResult ? "negative/" : ""}00`);
  lines.push("execute if data storage math:internal {x:-103.97207641601562f} run return 1");
  lines.push(...stagePredicate("power/needs_overflow_classification"));
  lines.push(`execute if predicate math:internal/power/needs_overflow_classification run return run function ${functionId(negativeResult ? FUNCTION_PATHS.powerBoundaryNegative : FUNCTION_PATHS.powerBoundaryPositive)}`);
  lines.push(...resultOutOfRangeLines());
  lines.push(...finalPowerResultLines(negativeResult));
  return lines;
}

emitFunction(FUNCTION_PATHS.powerNonfinitePositive, powerNonfiniteLines(false));
emitFunction(FUNCTION_PATHS.powerNonfiniteNegative, powerNonfiniteLines(true));
emitFunction(FUNCTION_PATHS.powerBoundaryPositive, powerBoundaryLines(false));
emitFunction(FUNCTION_PATHS.powerBoundaryNegative, powerBoundaryLines(true));
emitFunction(FUNCTION_PATHS.powerPositive, powerEvaluationLines(false));
emitFunction(FUNCTION_PATHS.powerNegativeOdd, powerEvaluationLines(true));

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
  "data modify storage math:internal x set from storage math: a",
  "data modify storage math:internal x set compute default math:common/comparison/absolute",
  "data modify storage math:internal y set from storage math: b",
  ...stagePredicate("power/exponent_large_even"),
  `execute if predicate math:internal/power/exponent_large_even run return run function ${functionId(FUNCTION_PATHS.powerPositive)}`,
  "data modify storage math:internal x set from storage math:internal y",
  "data modify storage math:internal y set value 0.5f",
  "data modify storage math:internal w set compute default math:common/arithmetic/multiply",
  "data modify storage math:internal x set from storage math:internal w",
  `function ${functionId(FUNCTION_PATHS.truncate)}`,
  "data modify storage math:internal x set from storage math:internal w",
  "data modify storage math:internal y set from storage math:internal z",
  "data modify storage math:internal z set compute default math:common/arithmetic/subtract",
  "data modify storage math:internal x set from storage math: a",
  "data modify storage math:internal x set compute default math:common/comparison/absolute",
  "data modify storage math:internal y set from storage math: b",
  `execute if data storage math:internal {z:0.5f} run return run function ${functionId(FUNCTION_PATHS.powerNegativeOdd)}`,
  `execute if data storage math:internal {z:-0.5f} run return run function ${functionId(FUNCTION_PATHS.powerNegativeOdd)}`,
  `return run function ${functionId(FUNCTION_PATHS.powerPositive)}`,
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
  emitPublicFunction("power", lines);
}

{
  const lines = validationLines(["a", "b"]);
  lines.push("data modify storage math:internal x set from storage math: b");
  lines.push(...divisionByZeroLines());
  lines.push(...stagePredicate("divide/exact_equal"));
  lines.push("execute if predicate math:internal/divide/exact_equal run data modify storage math: ans set value 1.0f");
  lines.push("execute if predicate math:internal/divide/exact_equal run return 1");
  lines.push("data modify storage math:internal x set from storage math: a");
  lines.push("execute if data storage math:internal {x:0.0f} run data modify storage math:internal y set from storage math: b");
  lines.push("execute if data storage math:internal {x:0.0f} run data modify storage math: ans set compute default math:common/arithmetic/multiply");
  lines.push("execute if data storage math:internal {x:0.0f} run return 1");
  lines.push("data modify storage math:internal w_divide_sign set value 1.0f");
  lines.push(...stagePredicate("divide/a_negative"));
  lines.push("execute if predicate math:internal/divide/a_negative run data modify storage math:internal w_divide_sign set value -1.0f");
  lines.push(...stagePredicate("divide/b_negative"));
  lines.push("execute if predicate math:internal/divide/b_negative run data modify storage math:internal w_divide_sign set compute default math:internal/divide/flip_sign");
  lines.push("data modify storage math:internal x set compute default math:common/comparison/absolute");
  lines.push(`function ${functionId(FUNCTION_PATHS.normalizeBinary32)}`);
  lines.push("data modify storage math:internal w_divide_a_mantissa set from storage math:internal w_normalize_mantissa");
  lines.push("data modify storage math:internal w_divide_a_exponent set from storage math:internal w_normalize_exponent");
  lines.push("data modify storage math:internal x set from storage math: b");
  lines.push("data modify storage math:internal x set compute default math:common/comparison/absolute");
  lines.push(`function ${functionId(FUNCTION_PATHS.normalizeBinary32)}`);
  lines.push("data modify storage math:internal w_divide_b_mantissa set from storage math:internal w_normalize_mantissa");
  lines.push("data modify storage math:internal w_divide_b_exponent set from storage math:internal w_normalize_exponent");
  lines.push("data modify storage math:internal w_divide_exponent set compute default math:internal/divide/exponent_difference");
  lines.push(...stagePredicate("divide/exponent_definitely_overflows"));
  lines.push(`execute if predicate math:internal/divide/exponent_definitely_overflows run return run function ${functionId(FUNCTION_PATHS.resultOutOfRange)}`);
  lines.push(...stagePredicate("divide/exponent_at_overflow_boundary"));
  lines.push(...stagePredicate("divide/significand_at_or_above_overflow_boundary"));
  lines.push(`execute if predicate math:internal/divide/overflow_boundary run return run function ${functionId(FUNCTION_PATHS.resultOutOfRange)}`);
  lines.push("data modify storage math:internal x set from storage math:internal w_divide_b_mantissa");
  lines.push("data modify storage math:internal w_reciprocal_mantissa set compute default math:internal/reciprocal/mantissa");
  lines.push("data modify storage math:internal w_reciprocal_estimate set compute default math:internal/reciprocal/initial_estimate");
  for (let iteration = 0; iteration < 4; iteration += 1) {
    lines.push("data modify storage math:internal w_reciprocal_estimate set compute default math:internal/reciprocal/newton");
  }
  lines.push("data modify storage math:internal w_divide_reciprocal set compute default math:internal/divide/normalized_reciprocal");
  lines.push("data modify storage math:internal x set from storage math:internal w_divide_reciprocal");
  lines.push("data modify storage math:internal y set from storage math:internal w_divide_a_mantissa");
  lines.push("data modify storage math:internal x set compute default math:common/arithmetic/multiply");
  lines.push("data modify storage math:internal w_divide_quotient set from storage math:internal x");
  lines.push("data modify storage math:internal w_divide_product_high set compute default math:internal/divide/product/high");
  lines.push("data modify storage math:internal w_divide_product_low set compute default math:internal/divide/product/low");
  lines.push("data modify storage math:internal w_divide_residual_high set compute default math:internal/divide/residual/high");
  lines.push("data modify storage math:internal w_divide_residual_low set compute default math:internal/divide/residual/low");
  lines.push("data modify storage math:internal w_divide_correction set compute default math:internal/divide/correction");
  lines.push("data modify storage math:internal x set compute default math:internal/divide/refined_quotient");
  lines.push(...stagePredicate("divide/exponent_underflows"));
  lines.push(`execute if predicate math:internal/divide/exponent_underflows run return run function ${functionId(FUNCTION_PATHS.divideUnderflow)}`);
  lines.push("data modify storage math:internal w_divide_scale set compute default math:internal/divide/scale");
  lines.push("data modify storage math:internal w_divide_factor set compute default math:internal/divide/factor");
  lines.push("data modify storage math: ans set compute default math:internal/divide/result");
  lines.push("return 1");
  emitPublicFunction("divide", lines);
}

emitFunction(FUNCTION_PATHS.reduceRemainder, [
  ...stagePredicate("rounding/remainder/can_subtract_y"),
  "execute unless predicate math:internal/rounding/remainder/can_subtract_y run return 1",
  ...stagePredicate("rounding/remainder/y_too_large_to_double"),
  "execute if predicate math:internal/rounding/remainder/y_too_large_to_double run data modify storage math:internal x set compute default math:common/arithmetic/subtract",
  "execute if predicate math:internal/rounding/remainder/y_too_large_to_double run return 1",
  "data modify storage math:internal w set compute default math:common/rounding/double_y",
  ...stagePredicate("rounding/remainder/w_greater_than_x"),
  "execute if predicate math:internal/rounding/remainder/w_greater_than_x run data modify storage math:internal x set compute default math:common/arithmetic/subtract",
  "execute if predicate math:internal/rounding/remainder/w_greater_than_x run return 1",
  "data modify storage math:internal y set from storage math:internal w",
  `function ${functionId(FUNCTION_PATHS.reduceRemainder)}`,
  "data modify storage math:internal y set compute default math:common/rounding/half_y",
  ...stagePredicate("rounding/remainder/can_subtract_y"),
  "execute if predicate math:internal/rounding/remainder/can_subtract_y run data modify storage math:internal x set compute default math:common/arithmetic/subtract",
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
  lines.push("execute unless predicate math:internal/rounding/public/a_negative run data modify storage math: ans set compute default math:common/input/z");
  lines.push("execute unless predicate math:internal/rounding/public/a_negative run return 1");
  lines.push("data modify storage math:internal x set from storage math:internal z");
  lines.push("data modify storage math: ans set compute default math:common/rounding/negate");
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
  emitPublicFunction("modulo", lines);
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
  "data modify storage math:internal y set compute default math:common/constant/tau",
  `function ${functionId(FUNCTION_PATHS.normalizePeriod)}`,
  `function ${functionId(FUNCTION_PATHS.sinEvaluate)}`,
  "return 1",
]);

emitFunction(FUNCTION_PATHS.cos, [
  "data modify storage math:internal y set compute default math:common/constant/tau",
  `function ${functionId(FUNCTION_PATHS.normalizePeriod)}`,
  "data modify storage math:internal x set from storage math:internal z",
  "data modify storage math:internal x set compute default math:cos/00",
  "data modify storage math:internal z set from storage math:internal x",
  `function ${functionId(FUNCTION_PATHS.sinEvaluate)}`,
  "return 1",
]);

emitFunction(FUNCTION_PATHS.tan, [
  "data modify storage math:internal y set compute default math:common/constant/tau",
  `function ${functionId(FUNCTION_PATHS.normalizePeriod)}`,
  "data modify storage math:internal w_tan_phase set from storage math:internal z",
  "data modify storage math:internal x set from storage math:internal z",
  `function ${functionId(FUNCTION_PATHS.sinEvaluate)}`,
  "data modify storage math:internal w_tan_sin set from storage math:internal x",
  "data modify storage math:internal x set from storage math:internal w_tan_phase",
  "data modify storage math:internal x set compute default math:cos/00",
  "data modify storage math:internal z set from storage math:internal x",
  `function ${functionId(FUNCTION_PATHS.sinEvaluate)}`,
  "data modify storage math:internal w_tan_cos set from storage math:internal x",
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
    "data modify storage math:internal y set value 1.0f",
    `function ${functionId(FUNCTION_PATHS.reciprocal)}`,
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
  fs.rmSync(path.join(targetRoot, "Math", "data", "math", "number_provider", "reciprocal"), { recursive: true, force: true });
  fs.rmSync(path.join(targetRoot, "Math", "data", "math", "number_provider", "divide.json"), { force: true });
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
