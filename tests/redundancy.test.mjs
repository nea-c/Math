import test from "node:test";
import assert from "node:assert/strict";
import { loadGeneratedGraph } from "./runtime-cost.mjs";
import { runFunction } from "./mcfunction-test-harness.mjs";

const graph = loadGeneratedGraph();

function conditionPrefix(command) {
  return command.match(/^(execute (?:if|unless) predicate \S+) run /)?.[1]
    ?? command.match(/^(execute (?:if|unless) data storage \S+ \{.+\}) run /)?.[1];
}

function storagePaths(value, result = []) {
  if (!value || typeof value !== "object") return result;
  if (value.type === "minecraft:storage") result.push([value.storage, value.path]);
  for (const child of Array.isArray(value) ? value : Object.values(value)) storagePaths(child, result);
  return result;
}

test("generated functions evaluate consecutive identical conditions only once", () => {
  const duplicates = [];
  for (const [functionPath, commands] of graph.functions) {
    for (let index = 1; index < commands.length; index += 1) {
      const condition = conditionPrefix(commands[index]);
      if (condition && condition === conditionPrefix(commands[index - 1])) {
        duplicates.push(`${functionPath}:${index + 1}: ${condition}`);
      }
    }
  }
  assert.deepEqual(duplicates, []);
});

test("public calculations do not execute single-use forwarding helpers", () => {
  const cases = [
    ["log", { a: 3 }, [".common/log/1.prepare"]],
    ["asin", { a: 0.5 }, [".common/asin_positive/1.solve"]],
    ["atan", { a: 3 }, [".common/atan/1.evaluate"]],
    ["div", { a: 7, b: 3 }, ["div/1.compute"]],
    ["sqrt", { a: 3 }, ["sqrt/1.compute"]],
    ["pow", { a: 3, b: 2.5 }, ["pow/1.compute", "pow/4.positive"]],
    ["bezier", { t: 5, max: 10, a: 0, b: 1, curve: [0.25, 0.1, 0.25, 1] }, ["bezier/3.finish"]],
    ["bounce", { t: 5, max: 10, a: 0, b: 1 }, ["bounce/2.finish"]],
    ["bounce_decay", { t: 5, max: 10, a: 0, b: 1, bounces: 3.5, decay: 2 }, ["bounce_decay/2.finish"]],
    ["elastic_decay", { t: 5, max: 10, a: 0, b: 1, oscillations: 3, damping: 2 }, ["elastic_decay/2.finish"]],
    ["quaternion_to_axis_angle", { rotation: [0, 0, 0, 1] }, ["quaternion_to_axis_angle/1.compute"]],
  ];
  for (const [name, input, retiredCalls] of cases) {
    const calls = runFunction(name, input).functionCalls;
    for (const retired of retiredCalls) assert.equal(calls.has(retired), false, `${name} called ${retired}`);
  }
});

test("Bezier providers read public curve elements without internal aliases", () => {
  const paths = [
    ...storagePaths(graph.providers.get("math:bezier/midpoint")),
    ...storagePaths(graph.predicates.get("math:.validation/bezier/x_before_input")),
    ...storagePaths(graph.providers.get("math:bezier/y")),
  ];
  assert.deepEqual(
    new Set(paths.filter(([storage]) => storage === "math:").map(([, path]) => path)),
    new Set(["curve[0]", "curve[1]", "curve[2]", "curve[3]", "internal.w_bezier_low", "internal.w_bezier_high", "internal.w_bezier_midpoint", "internal.w_bezier_u"]),
  );
  assert.equal(paths.some(([, path]) => /^internal\.w_bezier_[xy][12]$/.test(path)), false);
});
