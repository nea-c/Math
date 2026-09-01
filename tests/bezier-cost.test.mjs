import test from "node:test";
import assert from "node:assert/strict";
import { runFunction } from "./mcfunction-test-harness.mjs";
import { loadGeneratedGraph, staticFunctionCost } from "./runtime-cost.mjs";

const FINAL_BRACKET_WIDTH = 2 ** -20;
const BRACKET_TOLERANCE = 2 ** -23;

const CURVE_CASES = [
  { name: "identity", t: 3, max: 8, curve: [0, 0, 1, 1] },
  { name: "flat-start", t: 1, max: 8, curve: [0, 0, 0, 1] },
  { name: "flat-end", t: 7, max: 8, curve: [1, 0, 1, 1] },
  { name: "symmetric", t: 4, max: 8, curve: [0.25, 0.1, 0.75, 0.9] },
  { name: "strongly-biased", t: 6, max: 8, curve: [0.02, 0.2, 0.12, 0.8] },
];

const NORMAL_GATE_CASES = [
  { name: "identity", u: 0.375, x1: 0, x2: 1 },
  { name: "symmetric", u: 0.5, x1: 0.25, x2: 0.75 },
  { name: "ease", u: 0.5, x1: 0.25, x2: 0.25 },
  { name: "strongly-biased", u: 0.75, x1: 0.02, x2: 0.12 },
];

const FLAT_GATE_CASES = [
  { name: "flat-start", u: 2 ** -20, x1: 0, x2: 0 },
  { name: "flat-end", u: 1 - 2 ** -20, x1: 1, x2: 1 },
];

function bezierX(t, curve) {
  const [x1, , x2] = curve;
  const inverse = 1 - t;
  return 3 * inverse * inverse * t * x1
    + 3 * inverse * t * t * x2
    + t * t * t;
}

function createFloat32Counter() {
  const counts = { adds: 0, multiplies: 0, divides: 0, bracketEvaluations: 0 };
  return {
    counts,
    add(left, right) {
      counts.adds += 1;
      return Math.fround(Math.fround(left) + Math.fround(right));
    },
    multiply(left, right) {
      counts.multiplies += 1;
      return Math.fround(Math.fround(left) * Math.fround(right));
    },
    divide(left, right) {
      counts.divides += 1;
      return Math.fround(Math.fround(left) / Math.fround(right));
    },
  };
}

function f32Product(counter, ...inputs) {
  let result = Math.fround(inputs[0]);
  for (const operand of inputs.slice(1)) result = counter.multiply(result, operand);
  return result;
}

function f32Sum(counter, ...inputs) {
  let result = Math.fround(inputs[0]);
  for (const operand of inputs.slice(1)) result = counter.add(result, operand);
  return result;
}

function modelBezierX(counter, t, x1, x2) {
  const inverse = f32Sum(counter, 1, f32Product(counter, -1, t));
  return f32Sum(
    counter,
    f32Product(counter, 3, inverse, inverse, t, x1),
    f32Product(counter, 3, inverse, t, t, x2),
    f32Product(counter, t, t, t),
  );
}

function modelBezierDerivative(counter, t, x1, x2) {
  const inverse = f32Sum(counter, 1, f32Product(counter, -1, t));
  const controlDelta = f32Sum(counter, x2, f32Product(counter, -1, x1));
  const endpointDelta = f32Sum(counter, 1, f32Product(counter, -1, x2));
  return f32Sum(
    counter,
    f32Product(counter, 3, inverse, inverse, x1),
    f32Product(counter, 6, inverse, t, controlDelta),
    f32Product(counter, 3, t, t, endpointDelta),
  );
}

function modelMidpoint(counter, low, high) {
  return f32Product(counter, 0.5, f32Sum(counter, low, high));
}

function evaluateBracket(counter, t, { u, x1, x2 }) {
  counter.counts.bracketEvaluations += 1;
  const x = modelBezierX(counter, t, x1, x2);
  const residual = f32Sum(counter, x, f32Product(counter, -1, u));
  return { residual, x };
}

function updatedBracket(low, high, t, residual) {
  return residual < 0 ? { low: t, high } : { low, high: t };
}

function solveBisection(curve) {
  const counter = createFloat32Counter();
  let low = Math.fround(0);
  let high = Math.fround(1);
  for (let iteration = 0; iteration < 20; iteration += 1) {
    const midpoint = modelMidpoint(counter, low, high);
    const { residual } = evaluateBracket(counter, midpoint, curve);
    ({ low, high } = updatedBracket(low, high, midpoint, residual));
  }
  return { low, high, ...counter.counts };
}

function solveSafeguardedNewton(curve) {
  const counter = createFloat32Counter();
  let low = Math.fround(0);
  let high = Math.fround(1);
  let probe = modelMidpoint(counter, low, high);

  while (high - low > FINAL_BRACKET_WIDTH && counter.counts.bracketEvaluations < 64) {
    const evaluated = evaluateBracket(counter, probe, curve);
    ({ low, high } = updatedBracket(low, high, probe, evaluated.residual));
    if (high - low <= FINAL_BRACKET_WIDTH) break;

    const derivative = modelBezierDerivative(counter, probe, curve.x1, curve.x2);
    const quotient = counter.divide(evaluated.residual, derivative);
    const candidate = f32Sum(counter, probe, f32Product(counter, -1, quotient));
    const candidateIsInside = Number.isFinite(candidate) && candidate > low && candidate < high;
    if (candidateIsInside) {
      const beforeCandidateWidth = high - low;
      const candidateEvaluation = evaluateBracket(counter, candidate, curve);
      const candidateBracket = updatedBracket(low, high, candidate, candidateEvaluation.residual);
      if (candidateBracket.high - candidateBracket.low <= beforeCandidateWidth / 2) {
        ({ low, high } = candidateBracket);
        probe = candidate;
        continue;
      }
    }

    probe = modelMidpoint(counter, low, high);
  }
  return { low, high, ...counter.counts };
}

function arithmeticWork(result) {
  return result.adds + result.multiplies + result.divides;
}

function assertCertifiedBracket(curve, result) {
  const lowX = bezierX(result.low, [curve.x1, 0, curve.x2, 1]);
  const highX = bezierX(result.high, [curve.x1, 0, curve.x2, 1]);
  const lowModelX = modelBezierX(createFloat32Counter(), result.low, curve.x1, curve.x2);
  const highModelX = modelBezierX(createFloat32Counter(), result.high, curve.x1, curve.x2);
  assert.ok(result.low <= result.high, curve.name);
  assert.ok(result.high - result.low <= FINAL_BRACKET_WIDTH, curve.name);
  assert.ok(lowModelX <= Math.fround(curve.u), curve.name);
  assert.ok(highModelX >= Math.fround(curve.u), curve.name);
  assert.ok(lowX <= curve.u + BRACKET_TOLERANCE, curve.name);
  assert.ok(highX >= curve.u - BRACKET_TOLERANCE, curve.name);
}

test("bezier keeps its certified final bracket private and observable", () => {
  for (const { name, t, max, curve } of CURVE_CASES) {
    const result = runFunction("bezier", { t, max, a: 0, b: 1, curve });
    const internal = result.storage["math:"].internal;
    const u = internal.w_bezier_u;
    assert.equal(result.storage["math:"].w_bezier_low, undefined, name);
    assert.equal(result.storage["math:"].w_bezier_high, undefined, name);
    assert.ok(internal.w_bezier_low <= internal.w_bezier_high, name);
    assert.ok(internal.w_bezier_high - internal.w_bezier_low <= FINAL_BRACKET_WIDTH, name);
    assert.ok(bezierX(internal.w_bezier_low, curve) <= u + BRACKET_TOLERANCE, name);
    assert.ok(bezierX(internal.w_bezier_high, curve) >= u - BRACKET_TOLERANCE, name);
  }
});

test("bezier avoids provider-dispatch overhead when updating its bracket", () => {
  const cost = staticFunctionCost("bezier/0.start", loadGeneratedGraph(), { recursionLimit: 320 });
  assert.ok(cost.commands <= 191, JSON.stringify(cost));
  assert.ok(cost.providerNodes < 6_240, JSON.stringify(cost));
});

test("safeguarded Newton feasibility gate retains bisection when no safe win exists", (t) => {
  const allCases = [...NORMAL_GATE_CASES, ...FLAT_GATE_CASES];
  const results = new Map();
  for (const curve of allCases) {
    const baseline = solveBisection(curve);
    const candidate = solveSafeguardedNewton(curve);
    assert.equal(baseline.bracketEvaluations, 20, curve.name);
    assert.equal(baseline.adds, 100, curve.name);
    assert.equal(baseline.multiplies, 260, curve.name);
    assertCertifiedBracket(curve, baseline);
    assertCertifiedBracket(curve, candidate);
    results.set(curve.name, { baseline, candidate });
    t.diagnostic(`${curve.name}: ${JSON.stringify({ baseline, candidate })}`);
  }

  const normalWin = NORMAL_GATE_CASES.every((curve) => {
    const { baseline, candidate } = results.get(curve.name);
    return candidate.high - candidate.low <= FINAL_BRACKET_WIDTH
      && candidate.bracketEvaluations < baseline.bracketEvaluations
      && arithmeticWork(candidate) < arithmeticWork(baseline);
  });
  const flatBudgetHeld = FLAT_GATE_CASES.every((curve) => {
    const { baseline, candidate } = results.get(curve.name);
    return candidate.high - candidate.low <= FINAL_BRACKET_WIDTH
      && candidate.bracketEvaluations <= baseline.bracketEvaluations
      && arithmeticWork(candidate) <= arithmeticWork(baseline);
  });
  const feasible = normalWin && flatBudgetHeld;
  if (!feasible) t.diagnostic("bezier: no safe runtime win under 2^-20 bracket guarantee");
  assert.equal(feasible, false, "a passing gate requires an operation-for-operation generated solver");
});
