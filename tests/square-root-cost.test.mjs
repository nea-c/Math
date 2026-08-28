import test from "node:test";
import assert from "node:assert/strict";
import { runFunction } from "./mcfunction-test-harness.mjs";
import { loadGeneratedGraph, staticFunctionCost } from "./runtime-cost.mjs";

const RELATIVE_ERROR_LIMIT = 0.00001;
const bytes = new ArrayBuffer(4);
const view = new DataView(bytes);

function floatFromBits(bits) {
  view.setUint32(0, bits >>> 0);
  return view.getFloat32(0);
}

function bitsFromFloat(value) {
  view.setFloat32(0, Math.fround(value));
  return view.getUint32(0);
}

const RESIDUAL_THRESHOLD = floatFromBits(0x384b0000);

function nextPositiveFloat(value) {
  return floatFromBits(bitsFromFloat(value) + 1);
}

function f32Sum(...operands) {
  let result = Math.fround(0);
  for (const operand of operands) result = Math.fround(result + Math.fround(operand));
  return result;
}

function f32Product(...operands) {
  let result = Math.fround(1);
  for (const operand of operands) result = Math.fround(result * Math.fround(operand));
  return result;
}

// This is an independent binary32 model of the already-public reciprocal
// contract. It lets the test select the square-root guard before inspecting
// the generated branch.
function reciprocalEstimate(input) {
  const mantissa = f32Product(0.5, Math.max(Math.fround(input), Math.fround(-input)));
  let estimate = f32Sum(
    Math.fround(48 / 17),
    f32Product(Math.fround(-32 / 17), mantissa),
  );
  for (let iteration = 0; iteration < 3; iteration += 1) {
    estimate = f32Product(
      estimate,
      f32Sum(2, f32Product(-1, mantissa, estimate)),
    );
  }
  return f32Product(input, 0.25, estimate, estimate);
}

function normalizedSquareRootParts(bits) {
  const rawExponent = (bits >>> 23) & 0xff;
  const fraction = bits & 0x7fffff;
  let exponent;
  let mantissa;

  if (rawExponent === 0) {
    const leadingBit = 31 - Math.clz32(fraction);
    exponent = leadingBit - 149;
    mantissa = Math.fround(fraction / (2 ** leadingBit));
  } else {
    exponent = rawExponent - 127;
    mantissa = Math.fround(1 + fraction / (2 ** 23));
  }

  if ((exponent & 1) !== 0) {
    mantissa = f32Product(2, mantissa);
    exponent -= 1;
  }
  return { mantissa, scale: Math.fround(2 ** (exponent / 2)) };
}

function modelSquareRoot(bits, updates) {
  const input = floatFromBits(bits);
  const { mantissa, scale } = normalizedSquareRootParts(bits);
  let estimate = f32Product(0.5, f32Sum(mantissa, 1));
  for (let iteration = 0; iteration < updates; iteration += 1) {
    estimate = f32Product(
      0.5,
      f32Sum(estimate, f32Product(mantissa, reciprocalEstimate(estimate))),
    );
  }
  const actual = f32Product(estimate, scale);
  const expected = Math.fround(Math.sqrt(input));
  return {
    actual,
    expected,
    relativeError: Math.abs((actual - expected) / expected),
    residual: Math.abs(f32Sum(f32Product(estimate, estimate), f32Product(-1, mantissa))),
  };
}

function addPositiveFinite(cases, bits) {
  const input = floatFromBits(bits);
  if (input > 0 && Number.isFinite(input)) cases.add(bits >>> 0);
}

function adversarialBits() {
  const cases = new Set();

  for (let exponent = -149; exponent <= 127; exponent += 1) {
    const boundaryBits = bitsFromFloat(Math.fround(2 ** exponent));
    addPositiveFinite(cases, boundaryBits - 1);
    addPositiveFinite(cases, boundaryBits);
    addPositiveFinite(cases, boundaryBits + 1);
  }
  addPositiveFinite(cases, 0x7f7fffff);

  // Exercise the low, middle, and high significands of every subnormal
  // leading-bit band, including the normal transition at 0x00800000.
  for (let leadingBit = 0; leadingBit <= 22; leadingBit += 1) {
    const lower = 2 ** leadingBit;
    const upper = Math.min(0x7fffff, (2 ** (leadingBit + 1)) - 1);
    addPositiveFinite(cases, lower);
    addPositiveFinite(cases, Math.floor((lower + upper) / 2));
    addPositiveFinite(cases, upper);
  }

  let state = 0x9e3779b9;
  for (let count = 0; count < 50_000;) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const bits = state & 0x7fffffff;
    const input = floatFromBits(bits);
    if (!Number.isFinite(input) || input === 0) continue;
    cases.add(bits);
    count += 1;
  }

  return cases;
}

test("two fixed square-root updates are the minimum that one guarded update can complete", () => {
  const cases = adversarialBits();
  const failureCounts = [0, 0, 0, 0];

  for (const bits of cases) {
    for (let updates = 0; updates <= 3; updates += 1) {
      if (modelSquareRoot(bits, updates).relativeError > RELATIVE_ERROR_LIMIT) {
        failureCounts[updates] += 1;
      }
    }
  }

  assert.ok(failureCounts[2] > 0, "one fixed update plus one guarded update is insufficient");
  assert.equal(failureCounts[3], 0, "two fixed updates plus one guarded update must cover the corpus");
});

test("0x384b0000 is the widest binary32 residual threshold safe for the adversarial corpus", () => {
  const cases = adversarialBits();
  let minimumFailingResidual = Infinity;
  let maximumAdaptiveError = 0;
  let failuresAtNextThreshold = 0;
  const nextThreshold = nextPositiveFloat(RESIDUAL_THRESHOLD);

  for (const bits of cases) {
    const afterTwo = modelSquareRoot(bits, 2);
    const afterThree = modelSquareRoot(bits, 3);
    if (afterTwo.relativeError > RELATIVE_ERROR_LIMIT) {
      minimumFailingResidual = Math.min(minimumFailingResidual, afterTwo.residual);
    }

    const adaptive = afterTwo.residual >= RESIDUAL_THRESHOLD ? afterThree : afterTwo;
    maximumAdaptiveError = Math.max(maximumAdaptiveError, adaptive.relativeError);

    const nextAdaptive = afterTwo.residual >= nextThreshold ? afterThree : afterTwo;
    if (nextAdaptive.relativeError > RELATIVE_ERROR_LIMIT) failuresAtNextThreshold += 1;
  }

  assert.equal(minimumFailingResidual, RESIDUAL_THRESHOLD);
  assert.ok(maximumAdaptiveError <= RELATIVE_ERROR_LIMIT, `maximum adaptive error ${maximumAdaptiveError}`);
  assert.ok(failuresAtNextThreshold > 0, "the next binary32 threshold must expose an accuracy failure");
});

test("square root separates ordinary, residual-refine, and zero-path command budgets", () => {
  const ordinary = runFunction("square_root", { a: 2 });
  const slow = runFunction("square_root", { a: 3 });
  const zero = runFunction("square_root", { a: 0 });

  assert.ok(ordinary.commandsExecuted <= 61, `ordinary path used ${ordinary.commandsExecuted} commands`);
  assert.ok(slow.commandsExecuted > ordinary.commandsExecuted, "residual-refine path must execute one additional update");
  assert.ok(slow.commandsExecuted <= 76, `slow path used ${slow.commandsExecuted} commands`);
  assert.ok(zero.commandsExecuted <= 10, `zero path used ${zero.commandsExecuted} commands`);
});

test("adaptive square root does not increase the Task 3 static provider maximum", () => {
  const cost = staticFunctionCost("square_root/0.start", loadGeneratedGraph(), { recursionLimit: 320 });
  assert.ok(cost.commands < 1_267, `static path used ${cost.commands} commands`);
  assert.ok(cost.providerNodes <= 18_190, `static path expanded ${cost.providerNodes} provider nodes`);
});
