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
  assert.equal(PUBLIC_FUNCTION_NAMES.length, 35);
  assert.equal(PUBLIC_FUNCTION_PATHS.bezier, "bezier/0.start");
  assert.equal(PUBLIC_FUNCTION_PATHS.add, "add/0.start");
  assert.equal(PUBLIC_FUNCTION_PATHS.divide, "divide/0.start");
  assert.equal(PUBLIC_FUNCTION_PATHS.tan_degrees, "tan_degrees/0.start");
  assert.deepEqual(publicTag("divide"), { values: ["math:divide/0.start"] });
});

test("function layout assigns representative owned and common helpers", () => {
  assert.equal(Object.keys(FUNCTION_PATHS).length, 38);
  assert.equal(FUNCTION_PATHS.invalidNumber, ".common/_error/invalid_number");
  assert.equal(FUNCTION_PATHS.resultOutOfRange, ".common/_error/result_out_of_range");
  assert.equal(FUNCTION_PATHS.invalidCurve, ".common/_error/invalid_curve");
  assert.equal(FUNCTION_PATHS.invalidDuration, ".common/_error/invalid_duration");
  assert.equal(FUNCTION_PATHS.bezierSolve, "bezier/1.solve");
  assert.equal(FUNCTION_PATHS.bezierFinish, "bezier/2.finish");
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
