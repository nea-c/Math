export const PUBLIC_FUNCTION_NAMES = Object.freeze([
  "absolute", "add", "ceil", "clamp", "cos", "cos_degrees", "cube",
  "deg", "divide", "e", "exp", "floor", "lerp", "log", "maximum",
  "minimum", "modulo", "multiply", "pi", "power", "rad", "reciprocal",
  "remainder", "round", "sign", "sin", "sin_degrees", "square",
  "square_root", "subtract", "tan", "tan_degrees", "tau", "truncate",
]);

export const PUBLIC_FUNCTION_PATHS = Object.freeze(Object.fromEntries(
  PUBLIC_FUNCTION_NAMES.map((name) => [name, `${name}/0.start`]),
));

export const FUNCTION_PATHS = Object.freeze({
  invalidNumber: ".common/invalid_number/0.start",
  resultOutOfRange: ".common/result_out_of_range/0.start",
  floor: ".common/floor/0.start",
  truncate: ".common/truncate/0.start",
  reciprocal: ".common/reciprocal/0.start",
  reciprocalScaleUp: ".common/reciprocal/1.scale_up",
  reciprocalFinishAtScaleLimit: ".common/reciprocal/2.finish_at_scale_limit",
  reciprocalScaleDown: ".common/reciprocal/3.scale_down",
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
  logNormalize: ".common/log/2.normalize",
  logNormalizeScaleUp: ".common/log/3.normalize_scale_up",
  logNormalizeScaleDown: ".common/log/4.normalize_scale_down",
  exp: ".common/exp/0.start",
  divideNormalize: "divide/1.normalize",
  divideNormalizeScaleUp: "divide/2.normalize_scale_up",
  divideNormalizeScaleDown: "divide/3.normalize_scale_down",
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
  const implementationPath = PUBLIC_FUNCTION_PATHS[name];
  if (!implementationPath) throw new Error(`Unknown public function: ${name}`);
  return { values: [functionId(implementationPath)] };
}
