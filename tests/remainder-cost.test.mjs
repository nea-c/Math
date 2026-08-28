import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { runFunction } from "./mcfunction-test-harness.mjs";

const finiteLimit = Math.fround(3.4028234663852886e38);
const smallestFloat = Math.fround(2 ** -149);
const task1WideGapBaseline = 4_166;
const minimumRemovedAscentWork = 276 * 8;
const providerDirectory = path.resolve("Math/data/math/number_provider/common/reduce_remainder");

function dispatcherDepth(provider) {
  if (!provider || typeof provider !== "object" || provider.type !== "minecraft:number_dispatcher") return 0;
  return 1 + Math.max(
    ...provider.cases.map(entry => dispatcherDepth(entry.number_provider)),
    dispatcherDepth(provider.default),
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
    runFunction("modulo", { a: -finiteLimit, b: threeSmallestFloats }).commandsExecuted,
  ];
  const maximum = Math.max(...counts);

  assert.ok(
    maximum <= task1WideGapBaseline - minimumRemovedAscentWork,
    `wide-gap maximum ${maximum} must remove at least ${minimumRemovedAscentWork} commands from ${task1WideGapBaseline}`,
  );
});

test("direct selector stores the corrected exponent shift and scaled divisor", () => {
  for (const [a, b, expectedShift, expectedScaledDivisor] of [
    [finiteLimit, smallestFloat, 276, Math.fround(2 ** 127)],
    [finiteLimit, Math.fround(3 * smallestFloat), 275, Math.fround(1.5 * (2 ** 127))],
    [Math.fround(2 ** 127), Math.fround(3 * smallestFloat), 274, Math.fround(0.75 * (2 ** 127))],
  ]) {
    const internal = runFunction("remainder", { a, b }).storage["math:internal"];
    assert.equal(internal.w_remainder_shift, expectedShift, `${a} / ${b} corrected shift`);
    assert.equal(internal.w_remainder_scaled_divisor, expectedScaledDivisor, `${a} / ${b} scaled divisor`);
  }
});

test("remainder shift lookups are balanced, finite, and stay within their pack budget", () => {
  const factorFiles = [0, 1, 2].map(stage => path.join(providerDirectory, `factor_${stage}.json`));
  for (const file of factorFiles) {
    const provider = JSON.parse(fs.readFileSync(file, "utf8"));
    assertFiniteConstants(provider, file);
    assert.ok(dispatcherDepth(provider) <= 9, `${file} exceeds nine balanced decisions`);
  }

  const serializedBytes = fs.readdirSync(providerDirectory, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith(".json"))
    .reduce((total, entry) => total + fs.statSync(path.join(entry.parentPath, entry.name)).size, 0);
  assert.ok(serializedBytes <= 704_000, `remainder lookup files use ${serializedBytes} bytes; budget is 704000`);
});
