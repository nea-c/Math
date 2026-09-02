import test from "node:test";
import assert from "node:assert/strict";
import {
  FUNCTION_PATHS,
  PUBLIC_FUNCTION_NAMES,
  PUBLIC_FUNCTION_PATHS,
  functionId,
  publicTag,
} from "../tools/function-layout.mjs";

test("function layout defines the complete public API", () => {
  assert.equal(PUBLIC_FUNCTION_NAMES.length, 48);
  assert.equal(PUBLIC_FUNCTION_PATHS.bezier, "bezier/0.start");
  assert.equal(PUBLIC_FUNCTION_PATHS.bounce, "bounce/0.start");
  assert.equal(PUBLIC_FUNCTION_PATHS.bounce_decay, "bounce_decay/0.start");
  assert.equal(PUBLIC_FUNCTION_PATHS.elastic, "elastic/0.start");
  assert.equal(PUBLIC_FUNCTION_PATHS.elastic_decay, "elastic_decay/0.start");
  assert.equal(PUBLIC_FUNCTION_PATHS.add, "add/0.start");
  assert.equal(PUBLIC_FUNCTION_PATHS.div, "div/0.start");
  assert.equal(PUBLIC_FUNCTION_PATHS.tan_degrees, "tan_degrees/0.start");
  assert.equal(PUBLIC_FUNCTION_PATHS.asin, "asin/0.start");
  assert.equal(PUBLIC_FUNCTION_PATHS.asin_degrees, "asin_degrees/0.start");
  assert.equal(PUBLIC_FUNCTION_PATHS.acos, "acos/0.start");
  assert.equal(PUBLIC_FUNCTION_PATHS.acos_degrees, "acos_degrees/0.start");
  assert.equal(PUBLIC_FUNCTION_PATHS.atan, "atan/0.start");
  assert.equal(PUBLIC_FUNCTION_PATHS.atan_degrees, "atan_degrees/0.start");
  assert.equal(PUBLIC_FUNCTION_PATHS.atan2, "atan2/0.start");
  assert.equal(PUBLIC_FUNCTION_PATHS.atan2_degrees, "atan2_degrees/0.start");
  assert.equal(PUBLIC_FUNCTION_PATHS.quaternion_to_axis_angle, "quaternion_to_axis_angle/0.start");
  assert.deepEqual(publicTag("div"), { values: ["math:div/0.start"] });
});

test("function layout assigns representative owned and common helpers", () => {
  assert.equal(Object.keys(FUNCTION_PATHS).length, 52);
  assert.equal(FUNCTION_PATHS.bezierCompute, "bezier/1.compute");
  assert.equal(FUNCTION_PATHS.bezierSolve, "bezier/2.solve");
  assert.equal(FUNCTION_PATHS.bezierStep, "bezier/3.step");
  assert.equal(FUNCTION_PATHS.asinPositive, ".common/asin_positive/0.start");
  assert.equal(FUNCTION_PATHS.asin, ".common/asin/0.start");
  assert.equal(FUNCTION_PATHS.asinComplement, ".common/asin/2.complement");
  assert.equal(FUNCTION_PATHS.acos, ".common/acos/0.start");
  assert.equal(FUNCTION_PATHS.atan, ".common/atan/0.start");
  assert.equal(FUNCTION_PATHS.atanPiFour, ".common/atan/2.pi_four");
  assert.equal(FUNCTION_PATHS.inverseTrigonometrySquareRoot, ".common/inverse_trigonometry/0.start");
  assert.equal(FUNCTION_PATHS.quaternionNormalize, "quaternion_to_axis_angle/1.normalize");
  assert.equal(FUNCTION_PATHS.quaternionVector, "quaternion_to_axis_angle/2.vector");
  assert.equal(FUNCTION_PATHS.quaternionFinish, "quaternion_to_axis_angle/3.finish");
  assert.equal(FUNCTION_PATHS.quaternionScalar, "quaternion_to_axis_angle/4.scalar");
  assert.equal(FUNCTION_PATHS.elasticCompute, "elastic/1.compute");
  assert.equal(FUNCTION_PATHS.elasticPhase, "elastic/2.phase");
  assert.equal(FUNCTION_PATHS.elasticUnitAmplitude, "elastic/3.unit_amplitude");
  assert.equal(FUNCTION_PATHS.bounceScaleSubnormal, "bounce/2.scale_subnormal");
  assert.equal(FUNCTION_PATHS.reciprocal, ".common/reciprocal/0.start");
  assert.equal(FUNCTION_PATHS.normalizeBinary32, ".common/normalize_binary32/0.start");
  for (const retired of [
    "reciprocalScaleUp",
    "reciprocalFinishAtScaleLimit",
    "reciprocalScaleDown",
    "logNormalizeScaleUp",
    "logNormalizeScaleDown",
    "logNormalize",
    "divideNormalizeScaleUp",
    "divideNormalizeScaleDown",
    "divideNormalize",
    "divideUnderflow",
    "normalizePeriod",
    "normalizePeriodNegative",
    "sinEvaluate",
    "powerNonfinitePositive",
    "powerNonfiniteNegative",
    "powerBoundaryPositive",
    "powerBoundaryNegative",
    "powerClassifyOverflow",
    "divideCompute",
    "squareRootCompute",
    "powerCompute",
    "powerZero",
    "powerNegative",
    "powerPositive",
    "powerNegativeOdd",
    "quaternionCompute",
    "bezierFinish",
    "bounceFinish",
    "bounceDecayFinish",
    "elasticFinish",
    "elasticDecayFinish",
    "asinPositiveSolve",
    "atanEvaluate",
    "logPrepare",
  ]) {
    assert.equal(Object.hasOwn(FUNCTION_PATHS, retired), false, `${retired} must stay retired`);
  }
});

test("public tags reject inherited names", () => {
  assert.throws(() => publicTag("toString"), /Unknown public function: toString/);
});
