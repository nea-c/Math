import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { runFunction, runImplementation } from "./mcfunction-test-harness.mjs";
import { expandedProviderNodes, loadGeneratedGraph } from "./runtime-cost.mjs";

const finiteLimit = Math.fround(3.4028234663852886e38);
const smallestFloat = Math.fround(2 ** -149);
const task1WideGapBaseline = 4_166;
const minimumRemovedAscentWork = 276 * 8;
const providerDirectory = path.resolve("Math/data/math/context_float_provider/.common/reduce_remainder");
const graph = loadGeneratedGraph();

function dispatcherDepth(provider) {
  if (!provider || typeof provider !== "object" || provider.type !== "minecraft:number_dispatcher") return 0;
  return 1 + Math.max(
    ...provider.cases.map(entry => dispatcherDepth(entry.value)),
    dispatcherDepth(provider.default),
  );
}

function dispatcherLeaves(provider) {
  if (!provider || typeof provider !== "object" || provider.type !== "minecraft:number_dispatcher") return 1;
  return provider.cases.reduce(
    (total, entry) => total + dispatcherLeaves(entry.value),
    dispatcherLeaves(provider.default),
  );
}

function assertFiniteConstants(value, file) {
  if (typeof value === "number") {
    assert.ok(Number.isFinite(value), `${file} contains a non-finite numeric constant`);
    assert.ok(Math.abs(value) <= 2 ** 127, `${file} contains a numeric constant above 2^127`);
  } else if (value && typeof value === "object") {
    for (const child of Object.values(value)) assertFiniteConstants(child, file);
  }
}

test("wide exponent gaps remove the recursive ascent command work", () => {
  const threeSmallestFloats = Math.fround(3 * smallestFloat);
  const counts = [
    runFunction("remainder", { a: finiteLimit, b: smallestFloat }).commandsExecuted,
    runFunction("remainder", { a: Math.fround(2 ** 127), b: threeSmallestFloats }).commandsExecuted,
    runFunction("mod", { a: -finiteLimit, b: threeSmallestFloats }).commandsExecuted,
  ];
  const maximum = Math.max(...counts);

  assert.ok(
    maximum <= task1WideGapBaseline - minimumRemovedAscentWork,
    `wide-gap maximum ${maximum} must remove at least ${minimumRemovedAscentWork} commands from ${task1WideGapBaseline}`,
  );
  assert.ok(maximum <= 1_727, `wide-gap maximum ${maximum} exceeds the certified 1727-command ceiling`);
});

test("same-bin and adjacent exponent gaps retain their shallow reduction budgets", () => {
  for (const [label, a, b, budget] of [
    ["same-bin", 1.5, 1, 33],
    ["gap 1", Math.fround(2 ** 127), Math.fround(2 ** 126), 41],
    ["gap 2", Math.fround(2 ** 127), Math.fround(2 ** 125), 56],
  ]) {
    const commands = runFunction("remainder", { a, b }).commandsExecuted;
    assert.ok(commands <= budget, `${label} uses ${commands} commands; budget is ${budget}`);
  }
});

test("mod compute stores the corrected exponent shift and scaled divisor", () => {
  for (const [a, b, expectedShift, expectedScaledDivisor] of [
    [finiteLimit, smallestFloat, 276, Math.fround(2 ** 127)],
    [finiteLimit, Math.fround(3 * smallestFloat), 275, Math.fround(1.5 * (2 ** 127))],
    [Math.fround(2 ** 127), Math.fround(3 * smallestFloat), 274, Math.fround(0.75 * (2 ** 127))],
  ]) {
    const internal = runImplementation("mod/1.compute", { a, b }).storage["math:"].internal;
    assert.equal(internal.w_remainder_shift, expectedShift, `${a} / ${b} corrected shift`);
    assert.equal(internal.w_remainder_scaled_divisor, expectedScaledDivisor, `${a} / ${b} scaled divisor`);
  }
});

test("remainder shift lookups are balanced, finite, and stay within their pack budget", () => {
  const factorFiles = [0, 1, 2].map(stage => path.join(providerDirectory, `factor_${stage}.json`));
  for (const [stage, file] of factorFiles.entries()) {
    const provider = JSON.parse(fs.readFileSync(file, "utf8"));
    assertFiniteConstants(provider, file);
    assert.equal(dispatcherLeaves(provider), [128, 128, 23][stage], `${file} retains duplicate output bands`);
    assert.ok(dispatcherDepth(provider) <= [7, 7, 5][stage], `${file} exceeds its compact balanced depth`);
  }

  const serializedBytes = fs.readdirSync(providerDirectory, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith(".json"))
    .reduce((total, entry) => total + fs.statSync(path.join(entry.parentPath, entry.name)).size, 0);
  const expandedNodes = [0, 1, 2].reduce(
    (total, stage) => total + expandedProviderNodes(`math:.common/reduce_remainder/factor_${stage}`, graph),
    0,
  );
  assert.ok(serializedBytes <= 245_000, `remainder lookup files use ${serializedBytes} bytes; budget is 245000`);
  assert.ok(expandedNodes <= 1_200, `remainder factor lookups expand to ${expandedNodes} nodes; budget is 1200`);
});
