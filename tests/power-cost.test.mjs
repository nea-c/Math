import test from "node:test";
import assert from "node:assert/strict";
import { expandedProviderNodes, loadGeneratedGraph } from "./runtime-cost.mjs";
import { runFunction, runImplementation } from "./mcfunction-test-harness.mjs";

const graph = loadGeneratedGraph();
const classifierFunction = "power/9.classify_overflow";
const finiteLimit = Math.fround(3.4028234663852886e38);
const smallestFloat = Math.fround(2 ** -149);
const smallestNormalFloat = Math.fround(2 ** -126);
const maximumFiniteExpInput = Math.fround(88.72283172607422);
const overflowLogThreshold = Math.log((2 - 2 ** -24) * 2 ** 127);
const overflowThresholdHigh = Math.fround(overflowLogThreshold);
const overflowThresholdLow = Math.fround(overflowLogThreshold - overflowThresholdHigh);
const ln2High = Math.fround(Math.LN2);
const ln2Low = Math.fround(Math.LN2 - ln2High);
const finiteBoundaryBase = Math.fround(6_981_463_572_480);
const overflowBoundaryBase = Math.fround(6_981_464_096_768);
const boundaryFields = [
  "w_power_log_high",
  "w_power_log_low",
  "w_power_product_high",
  "w_power_product_low",
  "w_power_delta",
];

function floatFromBits(bits) {
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setUint32(0, bits >>> 0);
  return view.getFloat32(0);
}

function bitsFromFloat(value) {
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setFloat32(0, Math.fround(value));
  return view.getUint32(0);
}

function previousPositiveFloat(value) {
  return floatFromBits(bitsFromFloat(value) - 1);
}

function nextPositiveFloat(value) {
  return floatFromBits(bitsFromFloat(value) + 1);
}

function floatSum(...operands) {
  let result = Math.fround(0);
  for (const operand of operands) result = Math.fround(result + Math.fround(operand));
  return result;
}

function floatProduct(...operands) {
  let result = Math.fround(1);
  for (const operand of operands) result = Math.fround(result * Math.fround(operand));
  return result;
}

function floatSubtract(left, right) {
  return floatSum(left, floatProduct(-1, right));
}

function splitHigh(value) {
  const scaled = floatProduct(4097, value);
  return floatSubtract(scaled, floatSubtract(scaled, value));
}

function twoSumLow(left, right) {
  const high = floatSum(left, right);
  const recoveredRight = floatSubtract(high, left);
  return floatSum(
    floatSubtract(left, floatSubtract(high, recoveredRight)),
    floatSubtract(right, recoveredRight),
  );
}

function twoProductLow(left, right) {
  const high = floatProduct(left, right);
  const leftHigh = splitHigh(left);
  const leftLow = floatSubtract(left, leftHigh);
  const rightHigh = splitHigh(right);
  const rightLow = floatSubtract(right, rightHigh);
  return floatSum(
    floatSubtract(floatProduct(leftHigh, rightHigh), high),
    floatProduct(leftHigh, rightLow),
    floatProduct(leftLow, rightHigh),
    floatProduct(leftLow, rightLow),
  );
}

const prepareCache = new Map();
const expCache = new Map();

function prepareLogMagnitude(base) {
  const key = bitsFromFloat(Math.abs(base));
  let prepared = prepareCache.get(key);
  if (!prepared) {
    prepared = runImplementation(".common/log/1.prepare", {}, { x: Math.abs(base) }).storage["math:internal"];
    prepareCache.set(key, prepared);
  }
  return prepared;
}

function evaluateExp(input) {
  const key = bitsFromFloat(input);
  let result = expCache.get(key);
  if (result === undefined) {
    result = runImplementation(".common/exp/0.start", {}, { x: input }).storage["math:internal"].x;
    expCache.set(key, result);
  }
  return result;
}

function classifyPower(base, exponent, degree) {
  const prepared = prepareLogMagnitude(base);
  const difference = floatSum(prepared.z, -1);
  let high = Math.fround((degree % 2 === 0 ? -1 : 1) / degree);
  let low = Math.fround(0);

  for (let coefficientDegree = degree - 1; coefficientDegree >= 1; coefficientDegree -= 1) {
    const exactCoefficient = (coefficientDegree % 2 === 0 ? -1 : 1) / coefficientDegree;
    const coefficient = Math.fround(exactCoefficient);
    const coefficientLow = Math.fround(exactCoefficient - coefficient);
    const productHigh = floatProduct(high, difference);
    low = floatSum(
      twoSumLow(productHigh, coefficient),
      twoProductLow(high, difference),
      floatProduct(low, difference),
      coefficientLow,
    );
    high = floatSum(productHigh, coefficient);
  }

  low = floatSum(twoProductLow(high, difference), floatProduct(low, difference));
  high = floatProduct(high, difference);

  const exponentLn2High = floatProduct(prepared.w, ln2High);
  low = floatSum(
    twoSumLow(exponentLn2High, high),
    twoProductLow(prepared.w, ln2High),
    floatProduct(prepared.w, ln2Low),
    low,
  );
  high = floatSum(exponentLn2High, high);

  const logLow = twoSumLow(high, low);
  const logHigh = floatSum(high, low);
  const productLow = floatSum(twoProductLow(exponent, logHigh), floatProduct(exponent, logLow));
  const productHigh = floatProduct(exponent, logHigh);
  const delta = floatSum(
    floatSubtract(productHigh, overflowThresholdHigh),
    floatSubtract(productLow, overflowThresholdLow),
  );

  return {
    overflow: delta >= smallestFloat,
    evaluationExponent: Math.min(floatSum(productHigh, productLow), maximumFiniteExpInput),
  };
}

function boundaryCenters() {
  const centers = [];
  let state = 0x452821e6;
  for (let index = 0; index < 250; index += 1) {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    const fraction = (state >>> 8) / 0x0100_0000;
    const base = index < 125
      ? Math.fround(1 + fraction * 1023)
      : floatFromBits(0x3f800001 + (state % (0x7f7fffff - 0x3f800001)));
    centers.push([base, Math.fround(overflowLogThreshold / Math.log(base))]);
  }
  for (let exponent = 1; exponent <= 250; exponent += 1) {
    const magnitude = Math.fround(Math.exp(overflowLogThreshold / exponent));
    centers.push([exponent % 2 === 0 ? -magnitude : magnitude, exponent]);
  }
  centers.push([-finiteBoundaryBase, 3], [-overflowBoundaryBase, 3]);
  return centers;
}

function boundaryNeighborCorpus() {
  const cases = [];
  for (const [base, exponent] of boundaryCenters()) {
    for (const magnitude of [
      previousPositiveFloat(Math.abs(base)),
      Math.abs(base),
      nextPositiveFloat(Math.abs(base)),
    ]) {
      for (const adjacentExponent of [
        previousPositiveFloat(exponent),
        exponent,
        nextPositiveFloat(exponent),
      ]) {
        cases.push([base < 0 ? -magnitude : magnitude, adjacentExponent]);
      }
    }
  }
  return cases;
}

const POWER_PATHS = {
  ordinary: { input: { a: 3, b: 2.5 }, before: 75, budget: 62 },
  negativeInteger: { input: { a: -2, b: 3 }, before: 111, budget: 98 },
  finiteBoundary: { input: { a: finiteBoundaryBase, b: 3 }, before: 169, budget: 136 },
  overflowBoundary: { input: { a: overflowBoundaryBase, b: 3 }, before: 148, budget: 115 },
  underflow: { input: { a: -2, b: -151 }, before: 93, budget: 92 },
  nonfiniteResult: { input: { a: Math.fround(3.4028234663852886e38), b: 2 }, before: 55, budget: 47 },
};

function storagePaths(value, paths = []) {
  if (!value || typeof value !== "object") return paths;
  if (value.type === "minecraft:storage") paths.push(`${value.storage}|${value.path}`);
  for (const child of Array.isArray(value) ? value : Object.values(value)) storagePaths(child, paths);
  return paths;
}

test("power executes the overflow classifier only for the narrow boundary path", () => {
  const ordinary = runFunction("power", POWER_PATHS.ordinary.input);
  assert.equal(ordinary.functionCalls.get(classifierFunction) ?? 0, 0);

  for (const name of ["finiteBoundary", "overflowBoundary"]) {
    const result = runFunction("power", POWER_PATHS[name].input);
    assert.equal(result.functionCalls.get(classifierFunction), 1, name);
  }
});

test("power negative odd boundary corpus covers signed finite and overflow classifier paths", () => {
  const corpus = boundaryNeighborCorpus();
  for (const fixture of [
    { name: "finite", a: -finiteBoundaryBase, b: 3, success: true },
    { name: "overflow", a: -overflowBoundaryBase, b: 3, success: false },
  ]) {
    assert.ok(
      corpus.some(([a, b]) => Object.is(a, fixture.a) && Object.is(b, fixture.b)),
      `${fixture.name} negative odd boundary must be present in the exhaustive corpus`,
    );

    const result = runFunction("power", { a: fixture.a, b: fixture.b, ans: 91, error: "stale_error" });
    const expected = Math.fround(Math.pow(fixture.a, fixture.b));
    assert.equal(result.functionCalls.get(classifierFunction), 1, `${fixture.name} classifier calls`);
    assert.equal(result.returned === 1, fixture.success, `${fixture.name} classification`);
    assert.equal(Number.isFinite(expected), fixture.success, `${fixture.name} reference classification`);

    if (fixture.success) {
      const actual = result.storage["math:"].ans;
      const modeled = classifyPower(fixture.a, fixture.b, 18);
      const modeledAnswer = Math.fround(-evaluateExp(modeled.evaluationExponent));
      assert.ok(actual < 0, "finite negative odd boundary must preserve its sign");
      assert.ok(Math.abs((actual - expected) / expected) <= 0.00005, "finite signed answer must meet the power error contract");
      assert.equal(modeled.overflow, false);
      assert.equal(modeledAnswer, actual, "degree-18 model must match the deployed signed answer");
      assert.equal(result.storage["math:"].error, undefined);
    }
    else {
      assert.equal(result.storage["math:"].ans, undefined);
      assert.equal(result.storage["math:"].error, "result_out_of_range");
    }
  }
});

test("power command paths improve from their post-Task-3 baselines", () => {
  for (const [name, { input, before, budget }] of Object.entries(POWER_PATHS)) {
    const commands = runFunction("power", input).commandsExecuted;
    assert.ok(commands <= budget, `${name} used ${commands} commands; budget ${budget}`);
    assert.ok(commands < before, `${name} used ${commands} commands; expected fewer than ${before}`);
  }
});

test("power overflow-classifier provider work falls below its staged baseline", () => {
  const active = [...graph.providers.keys()].filter((id) => id.startsWith("math:power/classify/"));
  const total = active.reduce((sum, id) => sum + expandedProviderNodes(id, graph), 0);
  const maximum = Math.max(...active.map((id) => expandedProviderNodes(id, graph)));
  assert.ok(active.length <= 46, `expected at most 46 active classifier providers; found ${active.length}`);
  assert.ok(total <= 3_596, `power classifier expands to ${total} nodes; budget 3596`);
  assert.ok(maximum <= 177, `power classifier provider maximum is ${maximum}; budget 177`);
});

test("power boundary fields have one classifier writer and own only preceding dependencies", () => {
  const ordinary = runFunction("power", POWER_PATHS.ordinary.input).storage["math:internal"];
  assert.deepEqual(boundaryFields.filter((field) => field in ordinary), []);

  const boundary = runFunction("power", POWER_PATHS.finiteBoundary.input).storage["math:internal"];
  for (const field of boundaryFields) assert.equal(typeof boundary[field], "number", `${field} must be materialized`);

  const commands = graph.functions.get(classifierFunction);
  const writeIndexes = boundaryFields.map((field) => {
    const writers = [];
    for (const [functionName, functionCommands] of graph.functions) {
      functionCommands.forEach((command, index) => {
        if (command.startsWith(`data modify storage math:internal ${field} set `)) {
          writers.push({ functionName, index });
        }
      });
    }
    assert.deepEqual(writers, [{ functionName: classifierFunction, index: commands.findIndex((command) => (
      command.startsWith(`data modify storage math:internal ${field} set `)
    )) }], `${field} must have exactly one writer in ${classifierFunction}`);
    return writers[0].index;
  });
  assert.deepEqual(writeIndexes, [...writeIndexes].sort((left, right) => left - right));

  const dependencyOwners = [
    ["w_power_log_high", "math:power/classify/log/renormalize/high/00", ["math:internal|x", "math:internal|z"]],
    ["w_power_log_low", "math:power/classify/log/renormalize/low/00", [
      "math:internal|w_power_log_high", "math:internal|x", "math:internal|z",
    ]],
    ["w_power_product_high", "math:power/classify/product/high/00", [
      "math:internal|w_power_log_high", "math:|b",
    ]],
    ["w_power_product_low", "math:power/classify/product/low/00", [
      "math:internal|w_power_log_high", "math:internal|w_power_log_low",
      "math:internal|w_power_product_high", "math:|b",
    ]],
    ["w_power_delta", "math:power/classify/delta/00", [
      "math:internal|w_power_product_high", "math:internal|w_power_product_low",
    ]],
  ];
  for (const [field, providerId, allowed] of dependencyOwners) {
    const actual = [...new Set(storagePaths(graph.providers.get(providerId)))].sort();
    assert.deepEqual(actual, [...allowed].sort(), `${field} dependency ownership`);
  }

  const stagedComparison = graph.providers.get("math:internal/comparison/predicate/power/classifier_overflow/minimum");
  assert.ok(storagePaths(stagedComparison).includes("math:internal|w_power_delta"));
});

test("power classifier degree is selected by the exhaustive boundary-neighbor gate", (t) => {
  const cases = boundaryNeighborCorpus();
  assert.equal(cases.length, 4_518);

  const deployed = cases.map(([a, b]) => {
    const result = runFunction("power", { a, b, ans: 91, error: "stale_error" });
    const expected = Math.fround(Math.pow(a, b));
    const expectedSuccess = Number.isFinite(expected);
    assert.equal(result.returned === 1, expectedSuccess, `deployed power(${a}, ${b}) classification`);
    const classifierCalls = result.functionCalls.get(classifierFunction) ?? 0;
    assert.ok(classifierCalls <= 1, `power(${a}, ${b}) called the classifier ${classifierCalls} times`);
    return { a, b, result, expected, expectedSuccess, classifierCalls };
  });

  const candidateResults = [];
  for (let degree = 32; degree >= 1; degree -= 1) {
    let classificationChanges = 0;
    let falseAccepts = 0;
    let falseRejects = 0;
    let accuracyFailures = 0;
    let maximumError = 0;

    for (const entry of deployed) {
      if (entry.classifierCalls === 0) continue;
      const classified = classifyPower(entry.a, entry.b, degree);
      let candidateSuccess = !classified.overflow;
      let candidateAnswer;
      if (candidateSuccess) {
        candidateAnswer = evaluateExp(classified.evaluationExponent);
        if (entry.a < 0 && Number.isInteger(entry.b) && Math.abs(entry.b % 2) === 1) {
          candidateAnswer = Math.fround(-candidateAnswer);
        }
        candidateSuccess = Number.isFinite(candidateAnswer) && Math.abs(candidateAnswer) <= finiteLimit;
      }

      if (candidateSuccess !== (entry.result.returned === 1)) classificationChanges += 1;
      if (candidateSuccess && !entry.expectedSuccess) falseAccepts += 1;
      if (!candidateSuccess && entry.expectedSuccess) falseRejects += 1;
      if (candidateSuccess) {
        const error = Math.abs(entry.expected) >= smallestNormalFloat
          ? Math.abs((candidateAnswer - entry.expected) / entry.expected)
          : Math.abs(candidateAnswer - entry.expected) / smallestNormalFloat;
        if (error > 0.00005) accuracyFailures += 1;
        maximumError = Math.max(maximumError, error);
      }

      if (degree === 18) {
        assert.equal(candidateSuccess, entry.result.returned === 1, `degree-18 power(${entry.a}, ${entry.b}) classification`);
        if (candidateSuccess) {
          assert.equal(candidateAnswer, entry.result.storage["math:"].ans, `degree-18 power(${entry.a}, ${entry.b}) answer`);
        }
      }
    }

    candidateResults.push({
      degree,
      classificationChanges,
      falseAccepts,
      falseRejects,
      accuracyFailures,
      maximumError,
    });
  }

  const eligible = candidateResults.filter((candidate) => candidate.classificationChanges === 0
    && candidate.falseAccepts === 0
    && candidate.falseRejects === 0
    && candidate.accuracyFailures === 0);
  const selectedDegree = Math.min(...eligible.map((candidate) => candidate.degree));
  assert.equal(selectedDegree, 18, `eligible degrees: ${eligible.map(({ degree }) => degree).join(", ")}`);

  const polynomialStages = [...graph.providers.keys()]
    .map((id) => id.match(/^math:power\/classify\/polynomial\/(\d+)\/(?:high|low)\/00$/)?.[1])
    .filter(Boolean)
    .map(Number);
  const deployedDegree = Math.max(...polynomialStages) + 1;
  assert.equal(deployedDegree, selectedDegree);
  t.diagnostic(`4518 adjacent boundary cases; selected degree ${selectedDegree}; ${JSON.stringify(candidateResults)}`);
});
