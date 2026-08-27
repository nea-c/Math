import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { evaluateProvider } from "../tools/math-provider-lib.mjs";

const providerRoot = path.resolve("Math/data/math/number_provider");

function providerRegistry() {
  const registry = new Map();
  for (const entry of fs.readdirSync(providerRoot, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const file = path.join(entry.parentPath, entry.name);
    const relative = path.relative(providerRoot, file).replaceAll("\\", "/").replace(/\.json$/, "");
    registry.set(`math:${relative}`, JSON.parse(fs.readFileSync(file, "utf8")));
  }
  return registry;
}

function run(id, internal) {
  return evaluateProvider(id, providerRegistry(), new Map([["math:internal", internal]]));
}

test("common exact providers evaluate hand-checked arithmetic and conversions", () => {
  const cases = [
    ["math:common/arithmetic/add", { x: 1.25, y: -0.5 }, 0.75],
    ["math:common/arithmetic/subtract", { x: 1.25, y: -0.5 }, 1.75],
    ["math:common/arithmetic/multiply", { x: 1.25, y: -0.5 }, -0.625],
    ["math:common/comparison/absolute", { x: -3.5 }, 3.5],
    ["math:common/conversion/rad", { x: 180 }, Math.fround(Math.PI)],
    ["math:common/conversion/deg", { x: Math.PI }, 180],
  ];
  for (const [id, internal, expected] of cases) {
    assert.equal(run(id, internal), Math.fround(expected));
  }
});
