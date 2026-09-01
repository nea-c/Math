import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { evaluateProvider } from "../tools/math-provider-lib.mjs";

const providerRoot = path.resolve("Math/data/math/context_float_provider");

function loadProviders() {
  const registry = new Map();
  for (const entry of fs.readdirSync(providerRoot, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const file = path.join(entry.parentPath, entry.name);
    const relative = path.relative(providerRoot, file).replaceAll("\\", "/").replace(/\.json$/, "");
    registry.set(`math:${relative}`, JSON.parse(fs.readFileSync(file, "utf8")));
  }
  return registry;
}

const providers = loadProviders();

function dispatcherChecks(provider, exponent) {
  if (typeof provider === "number") return 0;
  if (typeof provider === "string") return dispatcherChecks(providers.get(provider), exponent);
  assert.ok(provider && typeof provider === "object");

  if (provider.type === "minecraft:number_dispatcher") {
    let checks = 0;
    for (const entry of provider.cases) {
      checks += 1;
      const { min, max } = entry.condition.test ?? {};
      if ((min === undefined || exponent >= min) && (max === undefined || exponent <= max)) {
        return checks + dispatcherChecks(entry.value, exponent);
      }
    }
    return checks + dispatcherChecks(provider.default ?? 0, exponent);
  }

  return (provider.inputs ?? []).reduce(
    (total, operand) => total + dispatcherChecks(operand, exponent),
    0,
  );
}

function storageForExponent(exponent) {
  return new Map([["math:", { internal: { z: exponent } }]]);
}

test("exp scale and factor lookups cover every supported exponent exactly", () => {
  for (let exponent = -150; exponent <= 128; exponent += 1) {
    const storage = storageForExponent(exponent);
    const expectedScale = exponent === -150
      ? Math.fround(2 ** -149)
      : exponent === 128
        ? Math.fround(2 ** 127)
        : Math.fround(2 ** exponent);
    const expectedFactor = exponent === -150 ? 0.5 : exponent === 128 ? 2 : 1;

    assert.equal(evaluateProvider("math:exp/scale/00", providers, storage), expectedScale, `scale ${exponent}`);
    assert.equal(evaluateProvider("math:exp/factor/00", providers, storage), expectedFactor, `factor ${exponent}`);
  }

  for (const exponent of [-151, 129]) {
    const storage = storageForExponent(exponent);
    assert.equal(evaluateProvider("math:exp/scale/00", providers, storage), 0, `scale ${exponent}`);
    assert.equal(evaluateProvider("math:exp/factor/00", providers, storage), 0, `factor ${exponent}`);
  }
});

test("exp scale and factor use at most thirteen dispatcher checks", () => {
  for (let exponent = -150; exponent <= 128; exponent += 1) {
    const checks = dispatcherChecks("math:exp/scale/00", exponent)
      + dispatcherChecks("math:exp/factor/00", exponent);
    assert.ok(checks <= 13, `exponent ${exponent} used ${checks} dispatcher checks`);
  }
});
