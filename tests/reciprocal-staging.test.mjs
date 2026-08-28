import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { runImplementation } from "./mcfunction-test-harness.mjs";

const providerRoot = path.resolve("Math/data/math/number_provider");

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

function expandedProviderCost(provider) {
  if (typeof provider === "number") return 1;
  if (typeof provider === "string") return expandedProviderCost(providers.get(provider));
  assert.ok(provider && typeof provider === "object");
  return 1 + (provider.operands ?? []).reduce(
    (total, operand) => total + expandedProviderCost(operand),
    0,
  );
}

function finishProviderCost(name) {
  const source = fs.readFileSync(`Math/data/math/function/.common/reciprocal/${name}.mcfunction`, "utf8");
  return [...source.matchAll(/compute default (math:\S+)/g)].reduce(
    (total, match) => total + expandedProviderCost(match[1]),
    0,
  );
}

function legacyFinish(x, y, iterations) {
  const f32 = Math.fround;
  const mantissa = f32(0.5 * Math.abs(x));
  let estimate = f32(f32(48 / 17) + f32(f32(-32 / 17) * mantissa));
  for (let stage = 0; stage < iterations; stage += 1) {
    estimate = f32(estimate * f32(2 - f32(mantissa * estimate)));
  }
  const normalized = f32(f32(f32(f32(x * 0.25) * estimate) * estimate));
  return f32(normalized * y);
}

test("reciprocal finish providers stay below sixty expanded expression nodes", () => {
  assert.ok(finishProviderCost("4.finish") <= 60);
});

test("reciprocal staged finishes preserve the legacy float result exactly", () => {
  for (const x of [
    -1.9999998807907104,
    -1.25,
    -1,
    1,
    1.25,
    1.9999998807907104,
  ]) {
    for (const y of [Math.fround(2 ** -50), 1, Math.fround(2 ** 50)]) {
      const result = runImplementation(".common/reciprocal/4.finish", {}, { x, y });
      assert.equal(result.storage["math:internal"].x, legacyFinish(x, y, 3), `${x}, ${y}`);
    }
  }
});
