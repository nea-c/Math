import test from "node:test";
import assert from "node:assert/strict";
import { expandedProviderNodes, loadGeneratedGraph, staticFunctionCost } from "./runtime-cost.mjs";
import { runFunction } from "./mcfunction-test-harness.mjs";

const graph = loadGeneratedGraph();

const BASELINE_INPUTS = {
  tan: { a: 1 },
  tan_degrees: { a: 45 },
  log: { a: 3 },
  divide: { a: 7, b: 3 },
  square_root: { a: 3 },
  bezier: { t: 5, max: 10, a: 0, b: 1, curve: [0.25, 0.1, 0.25, 1] },
  bounce: { t: 5, max: 10, a: 0, b: 1 },
  bounce_decay: { t: 5, max: 10, a: 0, b: 1, bounces: 3.5, decay: 2 },
  remainder: { a: 12345.5, b: 7 },
  modulo: { a: -12345.5, b: 7 },
  power: { a: 3, b: 2.5 },
  asin: { a: 0.5 },
  asin_degrees: { a: 0.5 },
  acos: { a: 0.5 },
  acos_degrees: { a: 0.5 },
};

const BOUNDARY_INPUTS = {
  tan: { a: Math.PI / 2 },
  tan_degrees: { a: 90 },
  log: { a: 0 },
  divide: { a: 7, b: 0 },
  square_root: { a: 0 },
  bezier: { t: 0, max: 10, a: 0, b: 1, curve: [0.25, 0.1, 0.25, 1] },
  bounce: { t: 0, max: 10, a: 0, b: 1 },
  bounce_decay: { t: 0, max: 10, a: 0, b: 1, bounces: 3.5, decay: 2 },
  remainder: { a: 12345.5, b: 0 },
  modulo: { a: -12345.5, b: -7 },
  power: { a: -2, b: 0.5 },
  asin: { a: 1 },
  asin_degrees: { a: 1 },
  acos: { a: -1 },
  acos_degrees: { a: -1 },
};

const COMMAND_BUDGETS = {
  tan: { baseline: 93, boundary: 68 },
  tan_degrees: { baseline: 94, boundary: 69 },
  log: { baseline: 40, boundary: 11 },
  divide: { baseline: 91, boundary: 9 },
  square_root: { baseline: 76, boundary: 10 },
  bezier: { baseline: 189, boundary: 58 },
  bounce: { baseline: 63, boundary: 14 },
  bounce_decay: { baseline: 91, boundary: 22 },
  remainder: { baseline: 134, boundary: 9 },
  modulo: { baseline: 140, boundary: 137 },
  power: { baseline: 62, boundary: 25 },
  asin: { baseline: 705, boundary: 22 },
  asin_degrees: { baseline: 706, boundary: 23 },
  acos: { baseline: 716, boundary: 17 },
  acos_degrees: { baseline: 717, boundary: 18 },
};

const POWER_PATH_BUDGETS = {
  ordinary: [{ a: 3, b: 2.5 }, 62],
  negativeInteger: [{ a: -2, b: 3 }, 98],
  finiteBoundary: [{ a: Math.fround(6_981_463_572_480), b: 3 }, 136],
  overflowBoundary: [{ a: Math.fround(6_981_464_096_768), b: 3 }, 115],
  underflow: [{ a: -2, b: -151 }, 92],
  nonfiniteResult: [{ a: Math.fround(3.4028234663852886e38), b: 2 }, 47],
};

const QUATERNION_PATH_BUDGETS = {
  identity: [{ rotation: [0, 0, 0, 1] }, 190],
  ordinary90: [{ rotation: [0, Math.fround(Math.SQRT1_2), 0, Math.fround(Math.SQRT1_2)] }, 1_000],
  nonunit: [{ rotation: [1, -2, 3, -4] }, 1_000],
  invalidZero: [{ rotation: [0, 0, 0, 0] }, 35],
};

test("runtime cost expands referenced providers", () => {
  assert.ok(expandedProviderNodes("math:internal/reciprocal/newton", graph) > 1);
});

test("runtime cost reports public command work", () => {
  const cost = staticFunctionCost("tan/0.start", graph, { recursionLimit: 320 });
  assert.ok(cost.commands > 0);
  assert.ok(cost.providerNodes > 0);
  assert.ok(cost.calls.commands.includes(".common/tan/0.start"));
  assert.ok(cost.calls.providerNodes.includes(".common/tan/0.start"));
});

test("harness exposes dynamically executed command count", () => {
  const result = runFunction("add", { a: 1, b: 2 });
  assert.equal(typeof result.commandsExecuted, "number");
  assert.ok(result.commandsExecuted > 0);
});

test("harness counts only the conditional branch that executes", () => {
  const normal = runFunction("add", { a: 1, b: 2 });
  const invalid = runFunction("add", { a: Infinity, b: 2 });
  assert.ok(normal.commandsExecuted > invalid.commandsExecuted);
});

test("runtime cost caps recursive function calls", () => {
  const recursiveGraph = {
    functions: new Map([["loop", ["function math:loop"]]]),
    providers: new Map(),
    predicates: new Map(),
  };
  const cost = staticFunctionCost("loop", recursiveGraph, { recursionLimit: 2 });
  assert.equal(cost.commands, 3);
  assert.deepEqual(cost.calls.commands, ["loop", "loop"]);
  assert.deepEqual(cost.calls.providerNodes, ["loop", "loop"]);
});

test("runtime cost adds sequential function calls", () => {
  const sequentialGraph = {
    functions: new Map([
      ["start", ["function math:left", "function math:right"]],
      ["left", ["say left"]],
      ["right", ["say right"]],
    ]),
    providers: new Map(),
    predicates: new Map(),
  };
  const cost = staticFunctionCost("start", sequentialGraph);
  assert.equal(cost.commands, 4);
  assert.deepEqual(cost.calls.commands, ["left", "right"]);
  assert.deepEqual(cost.calls.providerNodes, ["left", "right"]);
});

test("runtime cost follows the larger terminating conditional branch", () => {
  const branchingGraph = {
    functions: new Map([
      ["start", ["execute if data storage math: {a:1} run return run function math:left", "function math:right"]],
      ["left", ["say left", "say left again"]],
      ["right", ["say right"]],
    ]),
    providers: new Map(),
    predicates: new Map(),
  };
  const cost = staticFunctionCost("start", branchingGraph);
  assert.equal(cost.commands, 3);
  assert.deepEqual(cost.calls.commands, ["left"]);
  assert.deepEqual(cost.calls.providerNodes, ["left"]);
});

test("runtime cost retains an independent provider maximum from a shorter branch", () => {
  const branchingGraph = {
    functions: new Map([
      ["start", ["execute if data storage math: {a:1} run return run function math:left", "function math:right"]],
      ["left", ["data modify storage math:internal x set compute default math:heavy"]],
      ["right", ["say right", "say right again"]],
    ]),
    providers: new Map([["math:heavy", {
      type: "minecraft:sum",
      operands: Array.from({ length: 20 }, () => 1),
    }]]),
    predicates: new Map(),
  };
  const cost = staticFunctionCost("start", branchingGraph);
  assert.equal(cost.commands, 4);
  assert.equal(cost.providerNodes, 21);
  assert.deepEqual(cost.calls.commands, ["right"]);
  assert.deepEqual(cost.calls.providerNodes, ["left"]);
});

test("runtime cost includes number-dispatcher case conditions", () => {
  const dispatcher = {
    type: "minecraft:number_dispatcher",
    cases: [{
      condition: {
        type: "minecraft:value_check",
        value: { type: "minecraft:storage", storage: "math:internal", path: "x" },
        range: { max: 0 },
      },
      number_provider: 1,
    }],
    default: 2,
  };
  assert.equal(expandedProviderNodes(dispatcher, { providers: new Map(), predicates: new Map() }), 5);
});

test("runtime cost rejects provider reference cycles", () => {
  const cyclicGraph = {
    providers: new Map([["math:a", "math:b"], ["math:b", "math:a"]]),
  };
  assert.throws(() => expandedProviderNodes("math:a", cyclicGraph), /provider cycle/);
});

test("runtime command budgets are deterministic for normal and boundary inputs", () => {
  for (const [name, baselineInput] of Object.entries(BASELINE_INPUTS)) {
    for (const [kind, input] of [["baseline", baselineInput], ["boundary", BOUNDARY_INPUTS[name]]]) {
      const first = runFunction(name, input).commandsExecuted;
      const second = runFunction(name, input).commandsExecuted;
      assert.equal(second, first, `${name} ${kind} count changed between runs`);
      assert.ok(first <= COMMAND_BUDGETS[name][kind], `${name} ${kind} exceeded its command budget`);
    }
  }
});

test("tangent shared phase executes fewer commands than the Task 1 baselines", () => {
  assert.ok(runFunction("tan", { a: 1 }).commandsExecuted < 93);
  assert.ok(runFunction("tan_degrees", { a: 45 }).commandsExecuted < 94);
});

test("inverse trigonometric public wrappers call their shared implementations", () => {
  for (const [name, common] of [
    ["asin", ".common/asin/0.start"],
    ["asin_degrees", ".common/asin/0.start"],
    ["acos", ".common/acos/0.start"],
    ["acos_degrees", ".common/acos/0.start"],
  ]) {
    assert.ok(runFunction(name, BASELINE_INPUTS[name]).functionCalls.has(common), `${name} must call ${common}`);
  }
});

test("bounce_decay command work is independent of bounce density", () => {
  const ordinary = runFunction("bounce_decay", BASELINE_INPUTS.bounce_decay);
  const dense = runFunction("bounce_decay", {
    ...BASELINE_INPUTS.bounce_decay,
    bounces: 1000.25,
  });
  assert.equal(dense.commandsExecuted, ordinary.commandsExecuted);
});

test("quaternion conversion keeps deterministic path budgets and shares inverse cosine", () => {
  for (const [name, [input, budget]] of Object.entries(QUATERNION_PATH_BUDGETS)) {
    const first = runFunction("quaternion_to_axis_angle", input);
    const second = runFunction("quaternion_to_axis_angle", input);
    assert.equal(second.commandsExecuted, first.commandsExecuted, `${name} count changed between runs`);
    assert.ok(first.commandsExecuted <= budget,
      `${name} used ${first.commandsExecuted} commands; budget ${budget}`);
    if (["ordinary90", "nonunit"].includes(name)) {
      assert.ok(first.functionCalls.has(".common/acos/0.start"), `${name} must call shared inverse cosine`);
    }
  }
});

test("direct remainder start removes ascent work from public reduction", () => {
  assert.equal(runFunction("remainder", BASELINE_INPUTS.remainder).commandsExecuted, 134);
  assert.equal(runFunction("modulo", BASELINE_INPUTS.modulo).commandsExecuted, 140);
});

test("large-angle trigonometry stays below its recursive-remainder phase baselines", () => {
  const finiteLimit = Math.fround(3.4028234663852886e38);
  for (const [name, phaseBaseline] of [
    ["sin", 1_911],
    ["cos", 1_914],
    ["tan", 1_932],
    ["sin_degrees", 1_826],
    ["cos_degrees", 1_829],
    ["tan_degrees", 1_847],
  ]) {
    assert.ok(
      runFunction(name, { a: finiteLimit }).commandsExecuted < phaseBaseline,
      `${name} must stay below its recursive-remainder phase baseline`,
    );
  }
});

test("shared normalization reduces representative log and divide command counts", () => {
  assert.ok(runFunction("log", { a: 3 }).commandsExecuted < 40);
  assert.ok(runFunction("divide", { a: 7, b: 3 }).commandsExecuted < 91);
});

test("power keeps explicit ordinary, negative, boundary, underflow, and nonfinite budgets", () => {
  for (const [name, [input, budget]] of Object.entries(POWER_PATH_BUDGETS)) {
    const commands = runFunction("power", input).commandsExecuted;
    assert.ok(commands <= budget, `power ${name} used ${commands} commands; budget ${budget}`);
  }
});

test("static divide cost includes both sequential normalizer calls", () => {
  const cost = staticFunctionCost("divide/0.start", graph, { recursionLimit: 320 });
  assert.equal(cost.commands, 77);
  assert.equal(
    cost.calls.commands.filter(call => call === ".common/normalize_binary32/0.start").length,
    2,
  );
});

test("honest static log and divide costs stay within measured head budgets", () => {
  const log = staticFunctionCost("log/0.start", graph, { recursionLimit: 320 });
  const divide = staticFunctionCost("divide/0.start", graph, { recursionLimit: 320 });
  assert.ok(log.commands <= 39);
  assert.ok(log.providerNodes <= 5_000);
  assert.ok(divide.commands <= 77);
  assert.ok(divide.providerNodes <= 11_300);
});

test("adaptive square root improves its Task 3 representative cost and preserves the boundary", () => {
  assert.ok(runFunction("square_root", { a: 3 }).commandsExecuted < 96);
  assert.equal(runFunction("square_root", { a: 0 }).commandsExecuted, 10);
});

test("active divide providers do not exceed the honestly recomputed Task 1 node maximum", () => {
  for (const id of graph.providers.keys()) {
    if (!id.startsWith("math:internal/divide/")) continue;
    assert.ok(expandedProviderNodes(id, graph) <= 1_136, `${id} exceeds 1136 expanded nodes`);
  }
});
