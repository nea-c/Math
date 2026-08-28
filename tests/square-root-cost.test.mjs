import test from "node:test";
import assert from "node:assert/strict";
import { runFunction, runImplementation } from "./mcfunction-test-harness.mjs";
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

function previousPositiveFloat(value) {
  return floatFromBits(bitsFromFloat(value) - 1);
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

function f32Add(left, right) {
  return Math.fround(Math.fround(left) + Math.fround(right));
}

function f32Multiply(left, right) {
  return Math.fround(Math.fround(left) * Math.fround(right));
}

// This is an independent binary32 model of the already-public reciprocal
// contract. It lets the test select the square-root guard before inspecting
// the generated branch.
function reciprocalEstimate(input) {
  let reciprocalInput = Math.fround(input);
  let numerator = Math.fround(1);
  if (reciprocalInput >= 2) {
    reciprocalInput = f32Multiply(0.5, reciprocalInput);
    numerator = Math.fround(0.5);
  }
  const mantissa = f32Multiply(0.5, Math.max(reciprocalInput, Math.fround(-reciprocalInput)));
  let estimate = f32Add(
    Math.fround(48 / 17),
    f32Multiply(Math.fround(-32 / 17), mantissa),
  );
  for (let iteration = 0; iteration < 3; iteration += 1) {
    estimate = f32Multiply(
      estimate,
      f32Add(2, f32Multiply(f32Multiply(-1, mantissa), estimate)),
    );
  }
  let normalizedReciprocal = f32Multiply(reciprocalInput, 0.25);
  normalizedReciprocal = f32Multiply(normalizedReciprocal, estimate);
  normalizedReciprocal = f32Multiply(normalizedReciprocal, estimate);
  return f32Multiply(normalizedReciprocal, numerator);
}

function modelNewtonUpdate(mantissa, estimate) {
  return f32Multiply(
    0.5,
    f32Add(estimate, f32Multiply(mantissa, reciprocalEstimate(estimate))),
  );
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
    estimate = modelNewtonUpdate(mantissa, estimate);
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

function modelAdaptiveSquareRoot(bits) {
  const afterTwo = modelSquareRoot(bits, 2);
  if (afterTwo.residual < RESIDUAL_THRESHOLD) {
    return { ...afterTwo, refined: false, residualAfterTwo: afterTwo.residual };
  }
  return {
    ...modelSquareRoot(bits, 3),
    refined: true,
    residualAfterTwo: afterTwo.residual,
  };
}

function exhaustiveNormalizedMantissaSummary() {
  let maximumRelativeError = 0;
  let worstMantissa = 0;
  let minimumFailingResidual = Infinity;
  let failures = 0;
  let failuresAtNextThreshold = 0;
  let ordinaryCount = 0;
  let refineCount = 0;
  const nextThreshold = nextPositiveFloat(RESIDUAL_THRESHOLD);

  for (let index = 0; index < 0x1000000; index += 1) {
    const mantissa = index < 0x800000
      ? Math.fround(1 + index / 0x800000)
      : Math.fround(2 + (index - 0x800000) / 0x400000);
    let estimate = f32Multiply(0.5, f32Add(mantissa, 1));
    estimate = modelNewtonUpdate(mantissa, estimate);
    estimate = modelNewtonUpdate(mantissa, estimate);
    const residual = Math.abs(f32Add(
      f32Multiply(estimate, estimate),
      f32Multiply(-1, mantissa),
    ));
    const expected = Math.fround(Math.sqrt(mantissa));
    const errorAfterTwo = Math.abs((estimate - expected) / expected);
    if (errorAfterTwo > RELATIVE_ERROR_LIMIT) {
      minimumFailingResidual = Math.min(minimumFailingResidual, residual);
    }

    let adaptiveEstimate = estimate;
    if (residual >= RESIDUAL_THRESHOLD) {
      adaptiveEstimate = modelNewtonUpdate(mantissa, estimate);
      refineCount += 1;
    } else {
      ordinaryCount += 1;
    }
    const relativeError = Math.abs((adaptiveEstimate - expected) / expected);
    if (relativeError > maximumRelativeError) {
      maximumRelativeError = relativeError;
      worstMantissa = mantissa;
    }
    if (relativeError > RELATIVE_ERROR_LIMIT) failures += 1;

    const nextEstimate = residual >= nextThreshold
      ? modelNewtonUpdate(mantissa, estimate)
      : estimate;
    if (Math.abs((nextEstimate - expected) / expected) > RELATIVE_ERROR_LIMIT) {
      failuresAtNextThreshold += 1;
    }
  }

  return {
    cases: 0x1000000,
    failures,
    failuresAtNextThreshold,
    maximumRelativeError,
    minimumFailingResidual,
    ordinaryCount,
    refineCount,
    worstMantissa,
  };
}

test("square-root reciprocal model matches the deployed local-normalization branch", () => {
  const mantissa = 3.75;
  for (const estimate of [
    1.5,
    previousPositiveFloat(2),
    2,
    nextPositiveFloat(2),
    Math.fround(2.4999914),
  ]) {
    const deployed = runImplementation("square_root/2.refine", {}, {
      w_sqrt_estimate: estimate,
      w_sqrt_mantissa: mantissa,
    });
    assert.equal(deployed.returned, 1);
    assert.equal(
      deployed.storage["math:internal"].w_sqrt_estimate,
      modelNewtonUpdate(mantissa, estimate),
      `estimate ${estimate}`,
    );
  }
});

test("corrected adaptive model exhaustively covers all normalized binary32 mantissas", (t) => {
  const summary = exhaustiveNormalizedMantissaSummary();

  assert.equal(summary.cases, 2 ** 24);
  assert.equal(summary.failures, 0);
  assert.equal(summary.minimumFailingResidual, RESIDUAL_THRESHOLD);
  assert.ok(summary.failuresAtNextThreshold > 0, "the next binary32 threshold must fail exhaustively");
  assert.ok(
    summary.maximumRelativeError <= RELATIVE_ERROR_LIMIT,
    `maximum relative error ${summary.maximumRelativeError} at ${summary.worstMantissa}`,
  );
  assert.equal(summary.ordinaryCount + summary.refineCount, summary.cases);
  assert.ok(summary.ordinaryCount > 0);
  assert.ok(summary.refineCount > 0);
  t.diagnostic(
    `${summary.cases} mantissas; maximum relative error ${summary.maximumRelativeError} at ${summary.worstMantissa}; `
      + `${summary.ordinaryCount} ordinary, ${summary.refineCount} refined; `
      + `${summary.failuresAtNextThreshold} failures at next threshold`,
  );
});

test("adaptive model matches public execution at representative and residual-boundary inputs", () => {
  const cases = [
    { input: 2, commands: 61 },
    { input: 3, commands: 76 },
    {
      input: Math.fround(2.415778398513794),
      commands: 61,
      residual: Math.fround(0.000048160552978515625),
    },
    {
      input: Math.fround(2.41656756401062),
      commands: 76,
      residual: RESIDUAL_THRESHOLD,
    },
    {
      input: Math.fround(2.4177660942077637),
      commands: 76,
      residual: Math.fround(0.00004863739013671875),
    },
    { input: floatFromBits(1), commands: 61 },
    { input: floatFromBits(0x7f7fffff), commands: 76 },
  ];

  for (const { input, commands, residual } of cases) {
    const model = modelAdaptiveSquareRoot(bitsFromFloat(input));
    const deployed = runFunction("square_root", { a: input });
    assert.equal(deployed.returned, 1, `square_root(${input}) return`);
    assert.equal(deployed.storage["math:"].ans, model.actual, `square_root(${input}) result`);
    assert.equal(
      deployed.storage["math:internal"].w_sqrt_residual,
      model.residualAfterTwo,
      `square_root(${input}) residual`,
    );
    assert.equal(deployed.commandsExecuted, commands, `square_root(${input}) commands`);
    assert.equal(model.refined, commands === 76, `square_root(${input}) branch`);
    if (residual !== undefined) assert.equal(model.residualAfterTwo, residual, `square_root(${input}) fixture`);
  }
});

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

test("adaptive square root retains its achieved static command and provider improvements", () => {
  const cost = staticFunctionCost("square_root/0.start", loadGeneratedGraph(), { recursionLimit: 320 });
  assert.ok(cost.commands <= 76, `static path used ${cost.commands} commands`);
  assert.ok(cost.providerNodes <= 6_281, `static path expanded ${cost.providerNodes} provider nodes`);
});
