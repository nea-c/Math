import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  average,
  constant,
  evaluateProvider,
  f32,
  floatComparison,
  maximum,
  minimum,
  product,
  reference,
  storage,
  sum,
  writeGeneratedJson,
} from "../tools/math-provider-lib.mjs";

test("provider evaluator rounds every aggregate operation to float", () => {
  const registry = new Map([["math:test", {
    type: "minecraft:sum",
    operands: [16777216, 1, -16777216],
  }]]);
  assert.equal(evaluateProvider("math:test", registry, new Map()), 0);
});

test("provider builders create canonical providers evaluated with float storage reads", () => {
  const providers = new Map([["math:double", product(reference("math:one"), constant(2))], ["math:one", 1]]);
  const data = new Map([["math:internal", new Map([["x", 3.5]])]]);

  assert.deepEqual(storage("math:internal", "x"), {
    type: "minecraft:storage",
    storage: "math:internal",
    path: "x",
  });
  assert.equal(f32(16_777_217), 16_777_216);
  assert.equal(evaluateProvider(sum(storage("math:internal", "x"), "math:double"), providers, data), 5.5);
  assert.equal(evaluateProvider(minimum(9, 3, 7), providers, data), 3);
  assert.equal(evaluateProvider(maximum(9, 3, 7), providers, data), 9);
  assert.equal(evaluateProvider(average(3, 6), providers, data), 4.5);
});

test("provider evaluator selects the first matching inline value-check dispatcher case", () => {
  const provider = {
    type: "minecraft:number_dispatcher",
    cases: [
      {
        condition: {
          type: "minecraft:value_check",
          value: storage("math:internal", "x"),
          range: { min: -10, max: -1 },
        },
        number_provider: -1,
      },
      {
        condition: {
          type: "minecraft:value_check",
          value: storage("math:internal", "x"),
          range: { min: 0, max: 10 },
        },
        number_provider: 1,
      },
    ],
    default: 0,
  };

  assert.equal(evaluateProvider(provider, new Map(), new Map([["math:internal", { x: -2 }]])), -1);
  assert.equal(evaluateProvider(provider, new Map(), new Map([["math:internal", { x: 2 }]])), 1);
  assert.equal(evaluateProvider(provider, new Map(), new Map([["math:internal", { x: 20 }]])), 0);
});

test("value-check dispatcher conditions use Minecraft integer coercion for values and bounds", () => {
  const zeroRange = {
    type: "minecraft:number_dispatcher",
    cases: [{
      condition: {
        type: "minecraft:value_check",
        value: storage("math:internal", "x"),
        range: { min: 0, max: 0 },
      },
      number_provider: 11,
    }],
    default: 22,
  };
  const fractionalRange = {
    type: "minecraft:number_dispatcher",
    cases: [{
      condition: {
        type: "minecraft:value_check",
        value: storage("math:internal", "x"),
        range: { min: 0.25, max: 0.75 },
      },
      number_provider: 33,
    }],
    default: 44,
  };

  for (const x of [0.5, -0.5]) {
    assert.equal(evaluateProvider(zeroRange, new Map(), new Map([["math:internal", { x }]])), 11);
  }
  assert.equal(evaluateProvider(fractionalRange, new Map(), new Map([["math:internal", { x: 0.5 }]])), 33);
});

test("integer predicate evaluation propagates through nested provider operands", () => {
  const provider = {
    type: "minecraft:number_dispatcher",
    cases: [{
      condition: {
        type: "minecraft:value_check",
        value: product(storage("math:internal", "x"), 4),
        range: { min: 2, max: 2 },
      },
      number_provider: 11,
    }],
    default: 22,
  };

  assert.equal(evaluateProvider(provider, new Map(), new Map([["math:internal", { x: 0.5 }]])), 22);
});

test("dispatcher conditions compose lower and upper comparisons with all-of", () => {
  const provider = {
    type: "minecraft:number_dispatcher",
    cases: [{
      condition: {
        type: "minecraft:all_of",
        terms: [
          {
            type: "minecraft:value_check",
            value: storage("math:internal", "x"),
            range: { min: 1 },
          },
          {
            type: "minecraft:value_check",
            value: storage("math:internal", "x"),
            range: { max: 3 },
          },
        ],
      },
      number_provider: 55,
    }],
    default: 66,
  };

  assert.equal(evaluateProvider(provider, new Map(), new Map([["math:internal", { x: 2 }]])), 55);
  assert.equal(evaluateProvider(provider, new Map(), new Map([["math:internal", { x: 4 }]])), 66);
});

test("materialized comparisons distinguish adjacent floats at signed power-of-two thresholds", () => {
  const x = storage("math:internal", "x");
  const selector = {
    type: "minecraft:number_dispatcher",
    cases: [{
      condition: {
        type: "minecraft:value_check",
        value: storage("math:comparison", "value"),
        range: { min: 0 },
      },
      number_provider: 1,
    }],
    default: 0,
  };
  const cases = [
    [1, 0.9999999403953552, 1.0000001192092896],
    [-1, -1.0000001192092896, -0.9999999403953552],
  ];

  for (const [threshold, nextDown, nextUp] of cases) {
    for (const [input, expected] of [[nextDown, 0], [threshold, 1], [nextUp, 1]]) {
      const values = new Map([["math:internal", { x: input }]]);
      const materialized = evaluateProvider(floatComparison(x, threshold), new Map(), values);
      values.set("math:comparison", { value: materialized });
      assert.equal(evaluateProvider(selector, new Map(), values), expected, `${input} >= ${threshold}`);
    }
  }
});

test("generated JSON writer uses repository-relative paths and a trailing newline", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "math-provider-test-"));
  try {
    const target = writeGeneratedJson(root, "Math/data/math/number_provider/test", { type: "minecraft:sum", operands: [1, 2] });
    assert.equal(target, path.join(root, "Math", "data", "math", "number_provider", "test.json"));
    assert.equal(fs.readFileSync(target, "utf8"), '{\n  "type": "minecraft:sum",\n  "operands": [\n    1,\n    2\n  ]\n}\n');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
