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
  assert.equal(PUBLIC_FUNCTION_NAMES.length, 41);
  assert.equal(PUBLIC_FUNCTION_PATHS.bezier, "bezier/0.start");
  assert.equal(PUBLIC_FUNCTION_PATHS.elastic, "elastic/0.start");
  assert.equal(PUBLIC_FUNCTION_PATHS.elastic_decay, "elastic_decay/0.start");
  assert.equal(PUBLIC_FUNCTION_PATHS.add, "add/0.start");
  assert.equal(PUBLIC_FUNCTION_PATHS.divide, "divide/0.start");
  assert.equal(PUBLIC_FUNCTION_PATHS.tan_degrees, "tan_degrees/0.start");
  assert.equal(PUBLIC_FUNCTION_PATHS.asin, "asin/0.start");
  assert.equal(PUBLIC_FUNCTION_PATHS.asin_degrees, "asin_degrees/0.start");
  assert.equal(PUBLIC_FUNCTION_PATHS.acos, "acos/0.start");
  assert.equal(PUBLIC_FUNCTION_PATHS.acos_degrees, "acos_degrees/0.start");
  assert.deepEqual(publicTag("divide"), { values: ["math:divide/0.start"] });
});

test("function layout assigns representative owned and common helpers", () => {
  assert.equal(Object.keys(FUNCTION_PATHS).length, 49);
  assert.equal(FUNCTION_PATHS.invalidNumber, ".common/_error/invalid_number");
  assert.equal(FUNCTION_PATHS.resultOutOfRange, ".common/_error/result_out_of_range");
  assert.equal(FUNCTION_PATHS.invalidCurve, ".common/_error/invalid_curve");
  assert.equal(FUNCTION_PATHS.invalidDuration, ".common/_error/invalid_duration");
  assert.equal(FUNCTION_PATHS.invalidElastic, ".common/_error/invalid_elastic");
  assert.equal(FUNCTION_PATHS.bezierSolve, "bezier/1.solve");
  assert.equal(FUNCTION_PATHS.bezierFinish, "bezier/2.finish");
  assert.equal(FUNCTION_PATHS.asinPositive, ".common/asin_positive/0.start");
  assert.equal(FUNCTION_PATHS.asin, ".common/asin/0.start");
  assert.equal(FUNCTION_PATHS.acos, ".common/acos/0.start");
  assert.equal(FUNCTION_PATHS.inverseTrigonometrySquareRoot, ".common/inverse_trigonometry/0.start");
  assert.equal(FUNCTION_PATHS.elasticPhase, "elastic/1.phase");
  assert.equal(FUNCTION_PATHS.elasticFinish, "elastic/2.finish");
  assert.equal(FUNCTION_PATHS.elasticDecayFinish, "elastic_decay/1.finish");
  assert.equal(FUNCTION_PATHS.divideUnderflow, "divide/4.underflow");
  assert.equal(FUNCTION_PATHS.powerClassifyOverflow, "power/9.classify_overflow");
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
  ]) {
    assert.equal(Object.hasOwn(FUNCTION_PATHS, retired), false, `${retired} must stay retired`);
  }
  assert.equal(functionId(FUNCTION_PATHS.sinEvaluate), "math:.common/sin/1.evaluate");
});

test("public tags reject inherited names", () => {
  assert.throws(() => publicTag("toString"), /Unknown public function: toString/);
});
