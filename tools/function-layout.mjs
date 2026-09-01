export const PUBLIC_FUNCTION_NAMES = Object.freeze([
  "abs", "acos", "acos_degrees", "add", "asin", "asin_degrees", "atan", "atan2", "atan2_degrees", "atan_degrees", "bezier", "bounce", "bounce_decay", "ceil", "clamp", "cos", "cos_degrees", "cube",
  "deg", "div", "e", "elastic", "elastic_decay", "exp", "floor", "lerp", "log", "max",
  "min", "mod", "mul", "pi", "pow", "rad", "reciprocal",
  "quaternion_to_axis_angle", "remainder", "round", "sign", "sin", "sin_degrees", "square",
  "sqrt", "sub", "tan", "tan_degrees", "tau", "truncate",
]);

export const PUBLIC_FUNCTION_PATHS = Object.freeze(Object.fromEntries(
  PUBLIC_FUNCTION_NAMES.map((name) => [name, `${name}/0.start`]),
));

export const FUNCTION_PATHS = Object.freeze({
  floor: ".common/floor/0.start",
  truncate: ".common/truncate/0.start",
  normalizeBinary32: ".common/normalize_binary32/0.start",
  reciprocal: ".common/reciprocal/0.start",
  reciprocalNormalizeLow: ".common/reciprocal/1.normalize_low",
  reciprocalNormalizeShared: ".common/reciprocal/2.normalize_shared",
  reciprocalNormalizeHigh: ".common/reciprocal/3.normalize_high",
  reciprocalFinish: ".common/reciprocal/4.finish",
  reduceRemainder: ".common/reduce_remainder/0.start",
  normalizePeriod: ".common/normalize_period/0.start",
  normalizePeriodNegative: ".common/normalize_period/1.negative",
  sin: ".common/sin/0.start",
  sinEvaluate: ".common/sin/1.evaluate",
  cos: ".common/cos/0.start",
  tan: ".common/tan/0.start",
  log: ".common/log/0.start",
  logPrepare: ".common/log/1.prepare",
  exp: ".common/exp/0.start",
  asinPositive: ".common/asin_positive/0.start",
  asinPositiveSolve: ".common/asin_positive/1.solve",
  asinPositiveStep: ".common/asin_positive/2.step",
  asin: ".common/asin/0.start",
  acos: ".common/acos/0.start",
  atan: ".common/atan/0.start",
  atanEvaluate: ".common/atan/1.evaluate",
  inverseTrigonometrySquareRoot: ".common/inverse_trigonometry/0.start",
  inverseTrigonometrySquareRootStep: ".common/inverse_trigonometry/1.step",
  atan2Compute: "atan2/1.compute",
  atan2DegreesCompute: "atan2_degrees/1.compute",
  bezierCompute: "bezier/1.compute",
  bezierSolve: "bezier/2.solve",
  bezierFinish: "bezier/3.finish",
  bounceCompute: "bounce/1.compute",
  bounceFinish: "bounce/2.finish",
  bounceDecayCompute: "bounce_decay/1.compute",
  bounceDecayFinish: "bounce_decay/2.finish",
  cosineCompute: "cos/1.compute",
  cosineDegreesCompute: "cos_degrees/1.compute",
  divideCompute: "div/1.compute",
  divideUnderflow: "div/5.underflow",
  elasticCompute: "elastic/1.compute",
  elasticPhase: "elastic/2.phase",
  elasticFinish: "elastic/3.finish",
  elasticDecayCompute: "elastic_decay/1.compute",
  elasticDecayFinish: "elastic_decay/2.finish",
  expCompute: "exp/1.compute",
  moduloCompute: "mod/1.compute",
  moduloNegativeB: "mod/2.negative_b",
  powerCompute: "pow/1.compute",
  powerZero: "pow/2.zero",
  powerNegative: "pow/3.negative",
  powerPositive: "pow/4.positive",
  powerNegativeOdd: "pow/5.negative_odd",
  powerNonfinitePositive: "pow/6.nonfinite_positive",
  powerNonfiniteNegative: "pow/7.nonfinite_negative",
  powerBoundaryPositive: "pow/8.boundary_positive",
  powerBoundaryNegative: "pow/9.boundary_negative",
  powerClassifyOverflow: "pow/10.classify_overflow",
  quaternionCompute: "quaternion_to_axis_angle/1.compute",
  quaternionNormalize: "quaternion_to_axis_angle/2.normalize",
  quaternionVector: "quaternion_to_axis_angle/3.vector",
  quaternionFinish: "quaternion_to_axis_angle/4.finish",
  quaternionScalar: "quaternion_to_axis_angle/5.scalar",
  sineCompute: "sin/1.compute",
  sineDegreesCompute: "sin_degrees/1.compute",
  squareRootCompute: "sqrt/1.compute",
  squareRootNormalize: "sqrt/2.normalize",
  squareRootNormalizeScaleUp: "sqrt/3.normalize_scale_up",
  squareRootNormalizeScaleDown: "sqrt/4.normalize_scale_down",
  tangentCompute: "tan/1.compute",
  tangentDegreesCompute: "tan_degrees/1.compute",
});

export function functionId(path) {
  return `math:${path}`;
}

export function publicTag(name) {
  if (!Object.hasOwn(PUBLIC_FUNCTION_PATHS, name)) {
    throw new Error(`Unknown public function: ${name}`);
  }
  const implementationPath = PUBLIC_FUNCTION_PATHS[name];
  return { values: [functionId(implementationPath)] };
}
