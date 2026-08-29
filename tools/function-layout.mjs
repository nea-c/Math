export const PUBLIC_FUNCTION_NAMES = Object.freeze([
  "absolute", "add", "bezier", "ceil", "clamp", "cos", "cos_degrees", "cube",
  "deg", "divide", "e", "elastic", "elastic_decay", "exp", "floor", "lerp", "log", "maximum",
  "minimum", "modulo", "multiply", "pi", "power", "rad", "reciprocal",
  "remainder", "round", "sign", "sin", "sin_degrees", "square",
  "square_root", "subtract", "tan", "tan_degrees", "tau", "truncate",
]);

export const PUBLIC_FUNCTION_PATHS = Object.freeze(Object.fromEntries(
  PUBLIC_FUNCTION_NAMES.map((name) => [name, `${name}/0.start`]),
));

export const FUNCTION_PATHS = Object.freeze({
  invalidNumber: ".common/_error/invalid_number",
  resultOutOfRange: ".common/_error/result_out_of_range",
  invalidCurve: ".common/_error/invalid_curve",
  invalidDuration: ".common/_error/invalid_duration",
  invalidElastic: ".common/_error/invalid_elastic",
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
  bezierSolve: "bezier/1.solve",
  bezierFinish: "bezier/2.finish",
  elasticPhase: "elastic/1.phase",
  elasticFinish: "elastic/2.finish",
  elasticDecayFinish: "elastic_decay/1.finish",
  divideUnderflow: "divide/4.underflow",
  moduloNegativeB: "modulo/1.negative_b",
  squareRootNormalize: "square_root/1.normalize",
  squareRootNormalizeScaleUp: "square_root/2.normalize_scale_up",
  squareRootNormalizeScaleDown: "square_root/3.normalize_scale_down",
  powerZero: "power/1.zero",
  powerNegative: "power/2.negative",
  powerPositive: "power/3.positive",
  powerNegativeOdd: "power/4.negative_odd",
  powerNonfinitePositive: "power/5.nonfinite_positive",
  powerNonfiniteNegative: "power/6.nonfinite_negative",
  powerBoundaryPositive: "power/7.boundary_positive",
  powerBoundaryNegative: "power/8.boundary_negative",
  powerClassifyOverflow: "power/9.classify_overflow",
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
