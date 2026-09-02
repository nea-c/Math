export const PUBLIC_FUNCTION_NAMES = Object.freeze([
  "abs", "acos", "acos_deg", "add", "asin", "asin_deg", "atan", "atan2", "atan2_deg", "atan_deg", "bezier", "bounce", "bounce_decay", "ceil", "clamp", "cos", "cos_deg", "cube",
  "deg", "div", "e", "elastic", "elastic_decay", "exp", "floor", "lerp", "log", "max",
  "min", "mod", "mul", "pi", "pow", "rad", "reciprocal",
  "quaternion_to_axis_angle", "remainder", "round", "sign", "sin", "sin_deg", "square",
  "sqrt", "sub", "tan", "tan_deg", "tau", "truncate",
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
  sin: ".common/sin/0.start",
  cos: ".common/cos/0.start",
  tan: ".common/tan/0.start",
  log: ".common/log/0.start",
  exp: ".common/exp/0.start",
  asinPositive: ".common/asin_positive/0.start",
  asinPositiveStep: ".common/asin_positive/2.step",
  asin: ".common/asin/0.start",
  asinNegativeOne: ".common/asin/1.negative_one",
  asinComplement: ".common/asin/2.complement",
  acos: ".common/acos/0.start",
  atan: ".common/atan/0.start",
  atanReciprocal: ".common/atan/1.reciprocal",
  atanPiFour: ".common/atan/2.pi_four",
  inverseTrigonometrySquareRoot: ".common/inverse_trigonometry/0.start",
  inverseTrigonometrySquareRootStep: ".common/inverse_trigonometry/1.step",
  atan2Compute: "atan2/1.compute",
  atan2DegCompute: "atan2_deg/1.compute",
  atan2ScaleSubnormal: "atan2/2.scale_subnormal",
  bezierCompute: "bezier/1.compute",
  bezierSolve: "bezier/2.solve",
  bounceCompute: "bounce/1.compute",
  bounceScaleSubnormal: "bounce/2.scale_subnormal",
  bounceDecayCompute: "bounce_decay/1.compute",
  elasticCompute: "elastic/1.compute",
  elasticPhase: "elastic/2.phase",
  elasticUnitAmplitude: "elastic/3.unit_amplitude",
  elasticDecayCompute: "elastic_decay/1.compute",
  expCompute: "exp/1.compute",
  moduloCompute: "mod/1.compute",
  moduloNegativeB: "mod/2.negative_b",
  moduloNegativeA: "mod/3.negative_a",
  quaternionNormalize: "quaternion_to_axis_angle/1.normalize",
  quaternionVector: "quaternion_to_axis_angle/2.vector",
  quaternionFinish: "quaternion_to_axis_angle/3.finish",
  quaternionScalar: "quaternion_to_axis_angle/4.scalar",
  tangentCompute: "tan/1.compute",
  tangentDegCompute: "tan_deg/1.compute",
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
