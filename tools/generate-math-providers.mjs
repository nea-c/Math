import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  maximum,
  minimum,
  product,
  storage,
  sum,
  writeGeneratedJson,
} from "./math-provider-lib.mjs";

const command = "node tools/generate-math-providers.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const finiteLimit = 3.4028234663852886e38;
const smallestNegativeFloat = -1.401298464324817e-45;
const smallestPositiveFloat = Math.fround(2 ** -149);
const largestSubnormalFloat = Math.fround(2 ** -126 - 2 ** -149);
const smallestFiniteReciprocalInput = Math.fround(2 ** -128 + 2 ** -149);
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

function emitFunction(name, lines) {
  generatedFiles.push({ kind: "function", relativePath: `Math/data/math/function/${name}.mcfunction`, text: `${lines.join("\n")}\n` });
}

function finitePredicate(pathName) {
  return {
    type: "minecraft:value_check",
    value: storage("math:", pathName),
    range: { min: -finiteLimit, max: finiteLimit },
  };
}

const x = storage("math:internal", "x");
const y = storage("math:internal", "y");
const z = storage("math:internal", "z");
const w = storage("math:internal", "w");
const publicA = storage("math:", "a");
const publicB = storage("math:", "b");
const publicAnswer = storage("math:", "ans");

function inlineValueCheck(value, min, max) {
  return {
    type: "minecraft:value_check",
    value,
    range: { min, max },
  };
}

function numberDispatcher(cases, defaultValue = 0) {
  return {
    type: "minecraft:number_dispatcher",
    cases,
    default: defaultValue,
  };
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

function chunk(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

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
emit("common/rounding/negate", product(-1, x));
emit("common/rounding/add_half", sum(x, 0.5));
emit("common/rounding/quotient", product(x, w));
emit("common/rounding/reduce", sum(w, product(-1, z, y)));
emit("common/rounding/double_y", product(2, y));
emit("common/rounding/half_y", product(0.5, y));

const sineC3 = Math.fround(-1 / 6);
const sineC5 = Math.fround(1 / 120);
const sineC7 = Math.fround(-1 / 5040);
const sineC9 = Math.fround(1 / 362880);
const halfPiPrevious = previousPositiveFloat(halfPi);
const halfPiNext = nextPositiveFloat(halfPi);
emit("sin/fold/00", numberDispatcher([
  {
    condition: inlineValueCheck(z, -finiteLimit, -halfPi),
    number_provider: sum(-pi, product(-1, z)),
  },
  {
    condition: inlineValueCheck(z, halfPi, finiteLimit),
    number_provider: sum(pi, product(-1, z)),
  },
], z));
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
  { condition: inlineValueCheck(x, halfPiPrevious, halfPiNext), number_provider: 1 },
  { condition: inlineValueCheck(x, -halfPiNext, -halfPiPrevious), number_provider: -1 },
], "math:sin/polynomial/00"));
emit("cos/00", sum(x, halfPi));
emit("tan/00", product(publicAnswer, z));

const reciprocalAbsolute = "math:common/reciprocal/normalize/absolute/00";
const reciprocalMantissa = "math:common/reciprocal/normalize/mantissa/00";
const reciprocalFactor = "math:common/reciprocal/normalize/factor/00";
const reciprocalBands = [];
for (let exponent = -128; exponent <= 127; exponent += 1) {
  const minimum = exponent === -128 ? smallestFiniteReciprocalInput : Math.fround(2 ** exponent);
  const maximum = exponent === 127 ? Math.fround(finiteLimit) : previousPositiveFloat(2 ** (exponent + 1));
  reciprocalBands.push({
    exponent,
    minimum,
    maximum,
    scale: exponent === -128 ? Math.fround(2 ** 127) : Math.fround(2 ** -exponent),
  });
}

for (const [responsibility, selectValue] of [
  ["scale", (band) => band.scale],
  ["exponent", (band) => Math.fround(band.exponent)],
]) {
  const chunkReferences = [];
  for (const [index, bands] of chunk(reciprocalBands, 32).entries()) {
    const chunkName = index.toString().padStart(2, "0");
    const providerPath = `common/normalize/power_of_two/${responsibility}/${chunkName}`;
    chunkReferences.push(`math:${providerPath}`);
    emit(providerPath, numberDispatcher(bands.map((band) => ({
      condition: inlineValueCheck(reciprocalAbsolute, band.minimum, band.maximum),
      number_provider: selectValue(band),
    }))));
  }
  emit(`common/normalize/power_of_two/${responsibility}`, sum(...chunkReferences));
}

emit("common/reciprocal/normalize/absolute/00", maximum(x, product(-1, x)));
// The reciprocal seed is accurate on [0.5, 1). Shared normalization yields
// [1, 2), except where the e=-128 scale cap already yields [0.5, 1).
emit("common/reciprocal/normalize/factor/00", numberDispatcher([
  {
    condition: inlineValueCheck(
      reciprocalAbsolute,
      smallestFiniteReciprocalInput,
      previousPositiveFloat(2 ** -127),
    ),
    number_provider: 1,
  },
], 0.5));
emit("common/reciprocal/normalize/mantissa/00", product(
  reciprocalAbsolute,
  "math:common/normalize/power_of_two/scale",
  reciprocalFactor,
));
emit("common/reciprocal/normalize/sign/00", numberDispatcher([
  {
    condition: inlineValueCheck(x, -Math.fround(finiteLimit), smallestNegativeFloat),
    number_provider: -1,
  },
  {
    condition: inlineValueCheck(x, -smallestNegativeFloat, Math.fround(finiteLimit)),
    number_provider: 1,
  },
]));
emit("common/reciprocal/approximate/00", sum(
  Math.fround(48 / 17),
  product(Math.fround(-32 / 17), reciprocalMantissa),
));

let reciprocalEstimate = "math:common/reciprocal/approximate/00";
for (let stage = 0; stage < 3; stage += 1) {
  const stagePath = `common/reciprocal/newton/${stage.toString().padStart(2, "0")}/00`;
  emit(stagePath, product(
    reciprocalEstimate,
    sum(2, product(-1, reciprocalMantissa, reciprocalEstimate)),
  ));
  reciprocalEstimate = `math:${stagePath}`;
}
emit("common/reciprocal/00", product(
  "math:common/reciprocal/normalize/sign/00",
  "math:common/normalize/power_of_two/scale",
  reciprocalFactor,
  reciprocalEstimate,
));

// Positive subnormals are first scaled by 2^24, bringing every value into
// the exponent range supported by the shared power-of-two normalizer. The
// square-root output scale still dispatches on the original input exponent.
emit("square_root/normalize/prescale/00", product(x, numberDispatcher([
  {
    condition: inlineValueCheck(x, smallestPositiveFloat, largestSubnormalFloat),
    number_provider: Math.fround(2 ** 24),
  },
], 1)));
emit("square_root/normalize/mantissa/00", product(
  x,
  "math:common/normalize/power_of_two/scale",
));

const squareRootBands = [];
for (let exponent = -149; exponent <= 127; exponent += 1) {
  const minimum = Math.fround(2 ** exponent);
  const maximum = exponent === 127 ? Math.fround(finiteLimit) : previousPositiveFloat(2 ** (exponent + 1));
  const halfExponentScale = Math.fround(2 ** Math.floor(exponent / 2));
  squareRootBands.push({
    minimum,
    maximum,
    scale: exponent % 2 === 0
      ? halfExponentScale
      : product(halfExponentScale, Math.fround(Math.SQRT2)),
  });
}

{
  const chunkReferences = [];
  for (const [index, bands] of chunk(squareRootBands, 32).entries()) {
    const chunkName = index.toString().padStart(2, "0");
    const providerPath = `square_root/normalize/scale/dispatch/${chunkName}`;
    chunkReferences.push(`math:${providerPath}`);
    emit(providerPath, numberDispatcher(bands.map((band) => ({
      condition: inlineValueCheck(x, band.minimum, band.maximum),
      number_provider: band.scale,
    }))));
  }
  emit("square_root/normalize/scale/00", sum(...chunkReferences));
}

emit("square_root/approximate/00", product(0.5, sum(y, 1)));
for (let stage = 0; stage < 3; stage += 1) {
  emit(`square_root/newton/${stage.toString().padStart(2, "0")}/00`, product(
    0.5,
    sum(z, product(y, w)),
  ));
}
emit("square_root/00", product(
  "math:square_root/normalize/scale/00",
  z,
));

// Center the logarithm mantissa around one. Keeping the shared normalizer's
// raw [1, 2) interval causes cancellation in log(m) + e*ln(2) for inputs near
// one; [1/sqrt(2), sqrt(2)] keeps the relative error within the public bound.
const logRawMantissa = "math:log/normalize/raw_mantissa/00";
const logCenterCondition = inlineValueCheck(logRawMantissa, Math.fround(Math.SQRT2), 2);
emit("log/normalize/subnormal_exponent/00", numberDispatcher([
  {
    condition: inlineValueCheck(x, smallestPositiveFloat, largestSubnormalFloat),
    number_provider: -24,
  },
]));
emit("log/normalize/prescale/00", product(x, numberDispatcher([
  {
    condition: inlineValueCheck(x, smallestPositiveFloat, largestSubnormalFloat),
    number_provider: Math.fround(2 ** 24),
  },
], 1)));
emit("log/normalize/raw_mantissa/00", product(
  x,
  "math:common/normalize/power_of_two/scale",
));
emit("log/normalize/center_factor/00", numberDispatcher([
  { condition: logCenterCondition, number_provider: 0.5 },
], 1));
emit("log/normalize/center_exponent/00", numberDispatcher([
  { condition: logCenterCondition, number_provider: 1 },
]));
emit("log/normalize/exponent/00", sum(
  z,
  w,
  "math:log/normalize/center_exponent/00",
));
emit("log/normalize/mantissa/00", product(
  logRawMantissa,
  "math:log/normalize/center_factor/00",
));
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
    factor: exponent === -150 ? 0.5 : exponent === 128 ? 2 : 1,
  });
}
for (const [responsibility, selectValue] of [
  ["scale", (band) => band.scale],
  ["factor", (band) => band.factor],
]) {
  const chunkReferences = [];
  for (const [index, bands] of chunk(expScaleBands, 32).entries()) {
    const chunkName = index.toString().padStart(2, "0");
    const providerPath = `exp/${responsibility}/dispatch/${chunkName}`;
    chunkReferences.push(`math:${providerPath}`);
    emit(providerPath, numberDispatcher(bands.map((band) => ({
      condition: inlineValueCheck(z, band.exponent, band.exponent),
      number_provider: selectValue(band),
    }))));
  }
  emit(`exp/${responsibility}/00`, sum(...chunkReferences));
}
emit("exp/00", product(
  "math:exp/polynomial/00",
  "math:exp/factor/00",
  "math:exp/scale/00",
));
emit("power/positive/00", product(x, y));

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

for (const name of ["a", "b", "min", "max", "t"]) emitPredicate(`finite/${name}`, finitePredicate(name));
emitPredicate("range/min_greater_than_max", {
  type: "minecraft:value_check",
  value: sum(w, product(-1, z)),
  range: { max: smallestNegativeFloat },
});
emitPredicate("range/negative", {
  type: "minecraft:value_check",
  value: x,
  range: { max: smallestNegativeFloat },
});
emitPredicate("range/positive", {
  type: "minecraft:value_check",
  value: x,
  range: { min: -smallestNegativeFloat },
});
emitPredicate("reciprocal/zero", {
  type: "minecraft:value_check",
  value: x,
  range: { min: 0, max: 0 },
});
emitPredicate("tan/undefined", {
  type: "minecraft:value_check",
  value: maximum(x, product(-1, x)),
  // The public cosine contract permits 1e-5 absolute approximation error.
  // A 2e-5 computed guard therefore guarantees rejection whenever the true
  // reduced cosine is at most 1e-5; it can conservatively reject true cosine
  // magnitudes only through 3e-5.
  range: { max: 0.00002 },
});
emitPredicate("square_root/zero", {
  type: "minecraft:value_check",
  value: x,
  range: { min: 0, max: 0 },
});
emitPredicate("square_root/result_finite", {
  type: "minecraft:value_check",
  value: publicAnswer,
  range: { min: -finiteLimit, max: finiteLimit },
});
emitPredicate("log/zero", {
  type: "minecraft:value_check",
  value: x,
  range: { min: 0, max: 0 },
});
emitPredicate("exp/input_finite", {
  type: "minecraft:value_check",
  value: x,
  range: { min: -finiteLimit, max: finiteLimit },
});
emitPredicate("exp/input_in_range", {
  type: "minecraft:value_check",
  value: x,
  range: { max: maximumFiniteExpInput },
});
emitPredicate("exp/underflows_to_zero", {
  type: "minecraft:value_check",
  value: x,
  range: { max: maximumZeroExpInput },
});
emitPredicate("exp/minimum_nonzero", {
  type: "minecraft:value_check",
  value: x,
  range: { min: Math.fround(-103.97207641601562), max: Math.fround(-103.97207641601562) },
});
emitPredicate("exp/result_finite", {
  type: "minecraft:value_check",
  value: publicAnswer,
  range: { min: -finiteLimit, max: finiteLimit },
});
emitPredicate("power/base_zero", {
  type: "minecraft:value_check",
  value: x,
  range: { min: 0, max: 0 },
});
emitPredicate("power/exponent_zero", {
  type: "minecraft:value_check",
  value: y,
  range: { min: 0, max: 0 },
});
emitPredicate("power/exponent_one", {
  type: "minecraft:value_check",
  value: y,
  range: { min: 1, max: 1 },
});
emitPredicate("power/exponent_negative", {
  type: "minecraft:value_check",
  value: y,
  range: { max: smallestNegativeFloat },
});
emitPredicate("power/exponent_integer", {
  type: "minecraft:value_check",
  value: sum(publicB, product(-1, z)),
  range: { min: 0, max: 0 },
});
emitPredicate("power/exponent_large_even", {
  type: "minecraft:value_check",
  value: maximum(publicB, product(-1, publicB)),
  range: { min: 2 ** 24 },
});
emitPredicate("power/exponent_odd", {
  type: "minecraft:value_check",
  value: maximum(z, product(-1, z)),
  range: { min: 0.5, max: 0.5 },
});
emitPredicate("power/needs_overflow_classification", {
  type: "minecraft:value_check",
  value: x,
  range: { min: 88.7, max: 88.75 },
});
emitPredicate("power/classifier_overflow", {
  type: "minecraft:value_check",
  value: x,
  range: { min: smallestPositiveFloat },
});
emitPredicate("rounding/safe_command_result", {
  type: "minecraft:value_check",
  value: maximum(x, product(-1, x)),
  range: { max: previousPositiveFloat(2 ** 24) },
});
emitPredicate("rounding/integer_input", {
  type: "minecraft:value_check",
  value: maximum(x, product(-1, x)),
  range: { min: 2 ** 23 },
});
emitPredicate("rounding/remainder/can_subtract_y", {
  type: "minecraft:value_check",
  value: sum(x, product(-1, y)),
  range: { min: 0 },
});
emitPredicate("rounding/remainder/w_greater_than_x", {
  type: "minecraft:value_check",
  value: sum(w, product(-1, x)),
  range: { min: -smallestNegativeFloat },
});
emitPredicate("rounding/remainder/y_too_large_to_double", {
  type: "minecraft:value_check",
  value: y,
  range: { min: 2 ** 127 },
});
emitPredicate("rounding/remainder/zero", {
  type: "minecraft:value_check",
  value: z,
  range: { min: 0, max: 0 },
});
emitPredicate("rounding/public/a_negative", {
  type: "minecraft:value_check",
  value: publicA,
  range: { max: smallestNegativeFloat },
});
emitPredicate("rounding/public/b_negative", {
  type: "minecraft:value_check",
  value: publicB,
  range: { max: smallestNegativeFloat },
});

function validationLines(inputs) {
  const lines = ["data remove storage math: error"];
  for (const input of inputs) {
    lines.push(`execute unless predicate math:internal/finite/${input} run data remove storage math: ans`);
    lines.push(`execute unless predicate math:internal/finite/${input} run data modify storage math: error set value \"invalid_number\"`);
    lines.push(`execute unless predicate math:internal/finite/${input} run return fail`);
  }
  return lines;
}

function wrapper(name, inputs, provider, inputMap) {
  const lines = validationLines(inputs);
  for (const [internalName, publicName] of Object.entries(inputMap)) {
    lines.push(`data modify storage math:internal ${internalName} set from storage math: ${publicName}`);
  }
  lines.push(`data modify storage math: ans set compute default ${provider}`);
  lines.push("return 1");
  emitFunction(name, lines);
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

emitFunction("internal/floor_x", [
  "data modify storage math:internal z set compute default math:common/input/x",
  "execute unless predicate math:internal/rounding/safe_command_result run return 1",
  "execute store result storage math:internal z float 1 run compute default math:common/input/x",
  "return 1",
]);

emitFunction("internal/truncate_x", [
  "execute unless predicate math:internal/range/negative run return run function math:internal/floor_x",
  "data modify storage math:internal x set compute default math:common/rounding/negate",
  "function math:internal/floor_x",
  "data modify storage math:internal x set from storage math:internal z",
  "data modify storage math:internal z set compute default math:common/rounding/negate",
  "return 1",
]);

{
  const lines = validationLines(["a"]);
  lines.push("data modify storage math:internal x set from storage math: a");
  lines.push("function math:internal/floor_x");
  lines.push("data modify storage math: ans set compute default math:common/input/z");
  lines.push("return 1");
  emitFunction("floor", lines);
}

{
  const lines = validationLines(["a"]);
  lines.push("data modify storage math:internal x set from storage math: a");
  lines.push("data modify storage math:internal x set compute default math:common/rounding/negate");
  lines.push("function math:internal/floor_x");
  lines.push("data modify storage math:internal x set from storage math:internal z");
  lines.push("data modify storage math: ans set compute default math:common/rounding/negate");
  lines.push("return 1");
  emitFunction("ceil", lines);
}

{
  const lines = validationLines(["a"]);
  lines.push("data modify storage math:internal x set from storage math: a");
  lines.push("execute if predicate math:internal/rounding/integer_input run data modify storage math: ans set compute default math:common/input/x");
  lines.push("execute if predicate math:internal/rounding/integer_input run return 1");
  lines.push("data modify storage math:internal x set compute default math:common/rounding/add_half");
  lines.push("function math:internal/floor_x");
  lines.push("data modify storage math: ans set compute default math:common/input/z");
  lines.push("return 1");
  emitFunction("round", lines);
}

{
  const lines = validationLines(["a"]);
  lines.push("data modify storage math:internal x set from storage math: a");
  lines.push("function math:internal/truncate_x");
  lines.push("data modify storage math: ans set compute default math:common/input/z");
  lines.push("return 1");
  emitFunction("truncate", lines);
}

function divisionByZeroLines() {
  return [
    "execute if predicate math:internal/reciprocal/zero run data remove storage math: ans",
    "execute if predicate math:internal/reciprocal/zero run data modify storage math: error set value \"division_by_zero\"",
    "execute if predicate math:internal/reciprocal/zero run return fail",
  ];
}

function exactRemainderLines() {
  return [
    "data modify storage math:internal x set from storage math: a",
    "data modify storage math:internal x set compute default math:common/comparison/absolute",
    "data modify storage math:internal z set from storage math:internal x",
    "data modify storage math:internal x set from storage math: b",
    "data modify storage math:internal x set compute default math:common/comparison/absolute",
    "data modify storage math:internal y set from storage math:internal x",
    "data modify storage math:internal x set from storage math:internal z",
    "function math:internal/reduce_remainder",
    "data modify storage math:internal z set compute default math:common/input/x",
  ];
}

{
  const lines = validationLines(["a"]);
  lines.push("data modify storage math:internal x set from storage math: a");
  lines.push(...divisionByZeroLines());
  lines.push("data modify storage math: ans set compute default math:common/reciprocal/00");
  lines.push("return 1");
  emitFunction("reciprocal", lines);
}

{
  const lines = validationLines(["a"]);
  lines.push("data modify storage math:internal x set from storage math: a");
  lines.push("execute if predicate math:internal/range/negative run data remove storage math: ans");
  lines.push("execute if predicate math:internal/range/negative run data modify storage math: error set value \"negative_square_root\"");
  lines.push("execute if predicate math:internal/range/negative run return fail");
  lines.push("execute if predicate math:internal/square_root/zero run data modify storage math: ans set value 0.0f");
  lines.push("execute if predicate math:internal/square_root/zero run return 1");
  lines.push("data modify storage math:internal x set compute default math:square_root/normalize/prescale/00");
  lines.push("data modify storage math:internal y set compute default math:square_root/normalize/mantissa/00");
  lines.push("data modify storage math:internal z set compute default math:square_root/approximate/00");
  for (let stage = 0; stage < 3; stage += 1) {
    const stageName = stage.toString().padStart(2, "0");
    lines.push("data modify storage math:internal x set from storage math:internal z");
    lines.push("data modify storage math:internal w set compute default math:common/reciprocal/00");
    lines.push(`data modify storage math:internal x set compute default math:square_root/newton/${stageName}/00`);
    lines.push("data modify storage math:internal z set from storage math:internal x");
  }
  lines.push("data modify storage math:internal x set from storage math: a");
  lines.push("data modify storage math: ans set compute default math:square_root/00");
  lines.push("execute unless predicate math:internal/square_root/result_finite run data remove storage math: ans");
  lines.push("execute unless predicate math:internal/square_root/result_finite run data modify storage math: error set value \"result_out_of_range\"");
  lines.push("execute unless predicate math:internal/square_root/result_finite run return fail");
  lines.push("return 1");
  emitFunction("square_root", lines);
}

emitFunction("internal/log_x", [
  "data modify storage math:internal w set compute default math:log/normalize/subnormal_exponent/00",
  "data modify storage math:internal x set compute default math:log/normalize/prescale/00",
  "data modify storage math:internal z set compute default math:common/normalize/power_of_two/exponent",
  "data modify storage math:internal w set compute default math:log/normalize/exponent/00",
  "data modify storage math:internal z set compute default math:log/normalize/mantissa/00",
  "data modify storage math:internal z set compute default math:log/normalize/numerator/00",
  "data modify storage math:internal x set compute default math:log/normalize/denominator/00",
  "data modify storage math:internal x set compute default math:common/reciprocal/00",
  "data modify storage math:internal z set compute default math:log/normalize/u/00",
  "data modify storage math:internal x set compute default math:log/00",
  "return 1",
]);

emitFunction("internal/exp_x", [
  "data modify storage math:internal w set from storage math:internal x",
  "data modify storage math:internal x set compute default math:exp/reduce/quotient/00",
  "data modify storage math:internal x set compute default math:common/rounding/add_half",
  "function math:internal/floor_x",
  "data modify storage math:internal x set compute default math:exp/reduce/remainder/00",
  "data modify storage math:internal x set compute default math:exp/00",
  "return 1",
]);

function resultOutOfRangeLines(predicate = "math:internal/exp/input_in_range") {
  return [
    `execute unless predicate ${predicate} run data remove storage math: ans`,
    `execute unless predicate ${predicate} run data modify storage math: error set value "result_out_of_range"`,
    `execute unless predicate ${predicate} run return fail`,
  ];
}

{
  const lines = [
    "data modify storage math:internal x set from storage math: a",
    "data modify storage math:internal x set compute default math:common/comparison/absolute",
    "data modify storage math:internal w set compute default math:log/normalize/subnormal_exponent/00",
    "data modify storage math:internal x set compute default math:log/normalize/prescale/00",
    "data modify storage math:internal z set compute default math:common/normalize/power_of_two/exponent",
    "data modify storage math:internal w set compute default math:log/normalize/exponent/00",
    "data modify storage math:internal z set compute default math:log/normalize/mantissa/00",
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
  emitFunction("internal/power_classify_overflow", lines);
}

function finalPowerResultLines(negativeResult) {
  const lines = ["function math:internal/exp_x"];
  lines.push(negativeResult
    ? "data modify storage math: ans set compute default math:common/rounding/negate"
    : "data modify storage math: ans set compute default math:common/input/x");
  lines.push(...resultOutOfRangeLines("math:internal/exp/result_finite"));
  lines.push("return 1");
  return lines;
}

function powerNonfiniteLines(negativeResult) {
  return [
    `execute if predicate math:internal/range/negative run data modify storage math: ans set value ${negativeResult ? "-0.0f" : "0.0f"}`,
    "execute if predicate math:internal/range/negative run return 1",
    "data remove storage math: ans",
    "data modify storage math: error set value \"result_out_of_range\"",
    "return fail",
  ];
}

function powerBoundaryLines(negativeResult) {
  return [
    "function math:internal/power_classify_overflow",
    "execute if predicate math:internal/power/classifier_overflow run data remove storage math: ans",
    "execute if predicate math:internal/power/classifier_overflow run data modify storage math: error set value \"result_out_of_range\"",
    "execute if predicate math:internal/power/classifier_overflow run return fail",
    "data modify storage math:internal x set compute default math:power/classify/evaluation_exponent/00",
    ...finalPowerResultLines(negativeResult),
  ];
}

function powerEvaluationLines(negativeResult) {
  const lines = [
    "function math:internal/log_x",
    "data modify storage math:internal x set compute default math:power/positive/00",
    `execute unless predicate math:internal/exp/input_finite run return run function math:internal/power_nonfinite_${negativeResult ? "negative" : "positive"}`,
    `execute if predicate math:internal/exp/underflows_to_zero run data modify storage math: ans set value ${negativeResult ? "-0.0f" : "0.0f"}`,
    "execute if predicate math:internal/exp/underflows_to_zero run return 1",
  ];
  if (negativeResult) {
    lines.push("execute if predicate math:internal/exp/minimum_nonzero run data modify storage math: ans set compute default math:exp/minimum/negative/00");
  } else {
    lines.push("execute if predicate math:internal/exp/minimum_nonzero run data modify storage math: ans set compute default math:exp/minimum/00");
  }
  lines.push("execute if predicate math:internal/exp/minimum_nonzero run return 1");
  lines.push(`execute if predicate math:internal/power/needs_overflow_classification run return run function math:internal/power_boundary_${negativeResult ? "negative" : "positive"}`);
  lines.push(...resultOutOfRangeLines());
  lines.push(...finalPowerResultLines(negativeResult));
  return lines;
}

emitFunction("internal/power_nonfinite_positive", powerNonfiniteLines(false));
emitFunction("internal/power_nonfinite_negative", powerNonfiniteLines(true));
emitFunction("internal/power_boundary_positive", powerBoundaryLines(false));
emitFunction("internal/power_boundary_negative", powerBoundaryLines(true));
emitFunction("internal/power_positive", powerEvaluationLines(false));
emitFunction("internal/power_negative_odd", powerEvaluationLines(true));

emitFunction("internal/power_zero", [
  "execute if predicate math:internal/power/exponent_negative run data remove storage math: ans",
  "execute if predicate math:internal/power/exponent_negative run data modify storage math: error set value \"zero_to_negative_power\"",
  "execute if predicate math:internal/power/exponent_negative run return fail",
  "execute if predicate math:internal/power/exponent_zero run data modify storage math: ans set value 1.0f",
  "execute if predicate math:internal/power/exponent_zero run return 1",
  "data modify storage math: ans set value 0.0f",
  "return 1",
]);

emitFunction("internal/power_negative", [
  "data modify storage math:internal x set from storage math:internal y",
  "function math:internal/truncate_x",
  "execute unless predicate math:internal/power/exponent_integer run data remove storage math: ans",
  "execute unless predicate math:internal/power/exponent_integer run data modify storage math: error set value \"non_real_result\"",
  "execute unless predicate math:internal/power/exponent_integer run return fail",
  "data modify storage math:internal x set from storage math: a",
  "data modify storage math:internal x set compute default math:common/comparison/absolute",
  "data modify storage math:internal y set from storage math: b",
  "execute if predicate math:internal/power/exponent_large_even run return run function math:internal/power_positive",
  "data modify storage math:internal x set from storage math:internal y",
  "data modify storage math:internal y set value 0.5f",
  "data modify storage math:internal w set compute default math:common/arithmetic/multiply",
  "data modify storage math:internal x set from storage math:internal w",
  "function math:internal/truncate_x",
  "data modify storage math:internal x set from storage math:internal w",
  "data modify storage math:internal y set from storage math:internal z",
  "data modify storage math:internal z set compute default math:common/arithmetic/subtract",
  "data modify storage math:internal x set from storage math: a",
  "data modify storage math:internal x set compute default math:common/comparison/absolute",
  "data modify storage math:internal y set from storage math: b",
  "execute if predicate math:internal/power/exponent_odd run return run function math:internal/power_negative_odd",
  "return run function math:internal/power_positive",
]);

{
  const lines = validationLines(["a"]);
  lines.push("data modify storage math:internal x set from storage math: a");
  lines.push("execute if predicate math:internal/range/negative run data remove storage math: ans");
  lines.push("execute if predicate math:internal/range/negative run data modify storage math: error set value \"non_real_result\"");
  lines.push("execute if predicate math:internal/range/negative run return fail");
  lines.push("execute if predicate math:internal/log/zero run data remove storage math: ans");
  lines.push("execute if predicate math:internal/log/zero run data modify storage math: error set value \"non_real_result\"");
  lines.push("execute if predicate math:internal/log/zero run return fail");
  lines.push("function math:internal/log_x");
  lines.push("data modify storage math: ans set compute default math:common/input/x");
  lines.push("return 1");
  emitFunction("log", lines);
}

{
  const lines = validationLines(["a"]);
  lines.push("data modify storage math:internal x set from storage math: a");
  lines.push(...resultOutOfRangeLines());
  lines.push("execute if predicate math:internal/exp/underflows_to_zero run data modify storage math: ans set value 0.0f");
  lines.push("execute if predicate math:internal/exp/underflows_to_zero run return 1");
  lines.push("execute if predicate math:internal/exp/minimum_nonzero run data modify storage math: ans set compute default math:exp/minimum/00");
  lines.push("execute if predicate math:internal/exp/minimum_nonzero run return 1");
  lines.push("function math:internal/exp_x");
  lines.push("data modify storage math: ans set compute default math:common/input/x");
  lines.push(...resultOutOfRangeLines("math:internal/exp/result_finite"));
  lines.push("return 1");
  emitFunction("exp", lines);
}

{
  const lines = validationLines(["a", "b"]);
  lines.push("data modify storage math:internal x set from storage math: a");
  lines.push("data modify storage math:internal y set from storage math: b");
  lines.push("execute if predicate math:internal/power/base_zero run return run function math:internal/power_zero");
  lines.push("execute if predicate math:internal/power/exponent_one run data modify storage math: ans set compute default math:common/input/x");
  lines.push("execute if predicate math:internal/power/exponent_one run return 1");
  lines.push("execute if predicate math:internal/range/negative run return run function math:internal/power_negative");
  lines.push("return run function math:internal/power_positive");
  emitFunction("power", lines);
}

{
  const lines = validationLines(["a", "b"]);
  lines.push("data modify storage math:internal x set from storage math: b");
  lines.push(...divisionByZeroLines());
  lines.push("data modify storage math:internal z set compute default math:common/reciprocal/00");
  lines.push("data modify storage math:internal x set from storage math: a");
  lines.push("data modify storage math:internal y set from storage math:internal z");
  lines.push("data modify storage math: ans set compute default math:common/arithmetic/multiply");
  lines.push("return 1");
  emitFunction("divide", lines);
}

emitFunction("internal/reduce_remainder", [
  "execute unless predicate math:internal/rounding/remainder/can_subtract_y run return 1",
  "execute if predicate math:internal/rounding/remainder/y_too_large_to_double run data modify storage math:internal x set compute default math:common/arithmetic/subtract",
  "execute if predicate math:internal/rounding/remainder/y_too_large_to_double run return 1",
  "data modify storage math:internal w set compute default math:common/rounding/double_y",
  "execute if predicate math:internal/rounding/remainder/w_greater_than_x run data modify storage math:internal x set compute default math:common/arithmetic/subtract",
  "execute if predicate math:internal/rounding/remainder/w_greater_than_x run return 1",
  "data modify storage math:internal y set from storage math:internal w",
  "function math:internal/reduce_remainder",
  "data modify storage math:internal y set compute default math:common/rounding/half_y",
  "execute if predicate math:internal/rounding/remainder/can_subtract_y run data modify storage math:internal x set compute default math:common/arithmetic/subtract",
  "return 1",
]);

{
  const lines = validationLines(["a", "b"]);
  lines.push("data modify storage math:internal x set from storage math: b");
  lines.push(...divisionByZeroLines());
  lines.push(...exactRemainderLines());
  lines.push("execute if predicate math:internal/rounding/remainder/zero run data modify storage math: ans set value 0.0f");
  lines.push("execute if predicate math:internal/rounding/remainder/zero run return 1");
  lines.push("execute unless predicate math:internal/rounding/public/a_negative run data modify storage math: ans set compute default math:common/input/z");
  lines.push("execute unless predicate math:internal/rounding/public/a_negative run return 1");
  lines.push("data modify storage math:internal x set from storage math:internal z");
  lines.push("data modify storage math: ans set compute default math:common/rounding/negate");
  lines.push("return 1");
  emitFunction("remainder", lines);
}

emitFunction("internal/modulo_negative_b", [
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
  lines.push("execute if predicate math:internal/rounding/remainder/zero run data modify storage math: ans set value 0.0f");
  lines.push("execute if predicate math:internal/rounding/remainder/zero run return 1");
  lines.push("execute if predicate math:internal/rounding/public/b_negative run return run function math:internal/modulo_negative_b");
  lines.push("execute unless predicate math:internal/rounding/public/a_negative run data modify storage math: ans set compute default math:common/input/z");
  lines.push("execute unless predicate math:internal/rounding/public/a_negative run return 1");
  lines.push("data modify storage math:internal x set from storage math:internal y");
  lines.push("data modify storage math:internal y set from storage math:internal z");
  lines.push("data modify storage math: ans set compute default math:common/arithmetic/subtract");
  lines.push("return 1");
  emitFunction("modulo", lines);
}

emitFunction("internal/normalize_period", [
  "data modify storage math:internal z set from storage math:internal x",
  "data modify storage math:internal x set from storage math:internal y",
  "data modify storage math:internal w set compute default math:common/reciprocal/00",
  "data modify storage math:internal x set from storage math:internal z",
  "data modify storage math:internal z set compute default math:common/rounding/quotient",
  "data modify storage math:internal w set from storage math:internal x",
  "data modify storage math:internal x set from storage math:internal z",
  "data modify storage math:internal x set compute default math:common/rounding/add_half",
  "function math:internal/floor_x",
  "data modify storage math:internal z set compute default math:common/rounding/reduce",
  "return 1",
]);

emitFunction("internal/sin_x", [
  "data modify storage math:internal y set compute default math:common/constant/tau",
  "function math:internal/normalize_period",
  "data modify storage math:internal x set compute default math:sin/fold/00",
  "data modify storage math:internal x set compute default math:sin/00",
  "return 1",
]);

emitFunction("internal/cos_x", [
  "data modify storage math:internal y set compute default math:common/constant/tau",
  "function math:internal/normalize_period",
  "data modify storage math:internal x set from storage math:internal z",
  "data modify storage math:internal x set compute default math:cos/00",
  "data modify storage math:internal z set from storage math:internal x",
  "data modify storage math:internal x set compute default math:sin/fold/00",
  "data modify storage math:internal x set compute default math:sin/00",
  "return 1",
]);

emitFunction("internal/tan_x", [
  "function math:internal/sin_x",
  "data modify storage math: ans set compute default math:common/input/x",
  "data modify storage math:internal x set from storage math:internal w",
  "function math:internal/cos_x",
  "execute if predicate math:internal/tan/undefined run data remove storage math: ans",
  "execute if predicate math:internal/tan/undefined run data modify storage math: error set value \"undefined_tangent\"",
  "execute if predicate math:internal/tan/undefined run return fail",
  "data modify storage math:internal z set compute default math:common/reciprocal/00",
  "data modify storage math: ans set compute default math:tan/00",
  "return 1",
]);

function trigWrapper(name, kernel, degrees, zeroResult) {
  const lines = validationLines(["a"]);
  lines.push("data modify storage math:internal x set from storage math: a");
  if (degrees) lines.push("data modify storage math:internal x set compute default math:common/conversion/rad");
  lines.push(`execute if predicate math:internal/reciprocal/zero run data modify storage math: ans set ${zeroResult}`);
  lines.push("execute if predicate math:internal/reciprocal/zero run return 1");
  if (kernel === "tan_x") {
    lines.push("return run function math:internal/tan_x");
  } else {
    lines.push(`function math:internal/${kernel}`);
    lines.push("data modify storage math: ans set compute default math:common/input/x");
    lines.push("return 1");
  }
  emitFunction(name, lines);
}

for (const degrees of [false, true]) {
  const suffix = degrees ? "_degrees" : "";
  trigWrapper(`sin${suffix}`, "sin_x", degrees, "compute default math:common/input/x");
  trigWrapper(`cos${suffix}`, "cos_x", degrees, "value 1.0f");
  trigWrapper(`tan${suffix}`, "tan_x", degrees, "compute default math:common/input/x");
}

{
  const lines = validationLines(["a"]);
  lines.push("data modify storage math:internal x set from storage math: a");
  lines.push("data modify storage math: ans set value 0.0f");
  lines.push("execute if predicate math:internal/range/negative run data modify storage math: ans set value -1.0f");
  lines.push("execute if predicate math:internal/range/positive run data modify storage math: ans set value 1.0f");
  lines.push("return 1");
  emitFunction("sign", lines);
}

{
  const lines = validationLines(["a", "min", "max"]);
  lines.push("data modify storage math:internal x set from storage math: a");
  lines.push("data modify storage math:internal z set from storage math: min");
  lines.push("data modify storage math:internal w set from storage math: max");
  lines.push("execute if predicate math:internal/range/min_greater_than_max run data remove storage math: ans");
  lines.push("execute if predicate math:internal/range/min_greater_than_max run data modify storage math: error set value \"invalid_clamp_range\"");
  lines.push("execute if predicate math:internal/range/min_greater_than_max run return fail");
  lines.push("data modify storage math: ans set compute default math:common/comparison/clamp");
  lines.push("return 1");
  emitFunction("clamp", lines);
}

function generate(targetRoot) {
  fs.rmSync(path.join(targetRoot, "Math", "data", "math", "number_provider", "reciprocal"), { recursive: true, force: true });
  fs.rmSync(path.join(targetRoot, "Math", "data", "math", "number_provider", "divide.json"), { force: true });
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
      const expected = fs.readFileSync(path.join(tempRoot, ...relativePath.split("/")));
      const actual = fs.readFileSync(path.join(root, ...relativePath.split("/")));
      if (!actual.equals(expected)) {
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
