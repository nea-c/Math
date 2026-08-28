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
  remainder: { a: 12345.5, b: 7 },
  modulo: { a: -12345.5, b: 7 },
  power: { a: 3, b: 2.5 },
};

const BOUNDARY_INPUTS = {
  tan: { a: Math.PI / 2 },
  tan_degrees: { a: 90 },
  log: { a: 0 },
  divide: { a: 7, b: 0 },
  square_root: { a: 0 },
  bezier: { t: 0, max: 10, a: 0, b: 1, curve: [0.25, 0.1, 0.25, 1] },
  remainder: { a: 12345.5, b: 0 },
  modulo: { a: -12345.5, b: -7 },
  power: { a: -2, b: 0.5 },
};

const COMMAND_BUDGETS = {
  tan: { baseline: 93, boundary: 68 },
  tan_degrees: { baseline: 94, boundary: 69 },
  log: { baseline: 40, boundary: 11 },
  divide: { baseline: 91, boundary: 9 },
  square_root: { baseline: 99, boundary: 10 },
  bezier: { baseline: 190, boundary: 58 },
  remainder: { baseline: 183, boundary: 9 },
  modulo: { baseline: 189, boundary: 186 },
  power: { baseline: 76, boundary: 25 },
};

test("runtime cost expands referenced providers", () => {
  assert.ok(expandedProviderNodes("math:internal/reciprocal/newton", graph) > 1);
});

test("runtime cost reports public command work", () => {
  const cost = staticFunctionCost("tan/0.start", graph, { recursionLimit: 320 });
  assert.ok(cost.commands > 0);
  assert.ok(cost.providerNodes > 0);
  assert.ok(cost.calls.includes(".common/tan/0.start"));
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
  assert.deepEqual(cost.calls, ["loop", "loop"]);
});

test("runtime cost follows the maximum function-call path", () => {
  const branchingGraph = {
    functions: new Map([
      ["start", ["function math:left", "function math:right"]],
      ["left", ["function math:loop"]],
      ["right", ["function math:loop"]],
      ["loop", ["function math:loop"]],
    ]),
    providers: new Map(),
    predicates: new Map(),
  };
  const cost = staticFunctionCost("start", branchingGraph, { recursionLimit: 2 });
  assert.equal(cost.commands, 4);
  assert.deepEqual(cost.calls, ["left", "loop"]);
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
