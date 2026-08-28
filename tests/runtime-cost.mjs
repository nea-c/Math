import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const dataRoot = path.resolve("Math/data/math");
let generatedGraph;

function normalizeFunctionPath(id) {
  return id.replace(/^math:/, "");
}

function loadJsonRegistry(root, prefix) {
  const registry = new Map();
  for (const entry of fs.readdirSync(root, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const file = path.join(entry.parentPath, entry.name);
    const relative = path.relative(root, file).replaceAll("\\", "/").replace(/\.json$/, "");
    registry.set(`${prefix}${relative}`, JSON.parse(fs.readFileSync(file, "utf8")));
  }
  return registry;
}

function loadFunctionRegistry(root) {
  const functions = new Map();
  for (const entry of fs.readdirSync(root, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".mcfunction")) continue;
    const file = path.join(entry.parentPath, entry.name);
    const relative = path.relative(root, file).replaceAll("\\", "/").replace(/\.mcfunction$/, "");
    const commands = fs.readFileSync(file, "utf8")
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith("#"));
    functions.set(relative, commands);
  }
  return functions;
}

export function loadGeneratedGraph() {
  if (!generatedGraph) {
    generatedGraph = {
      functions: loadFunctionRegistry(path.join(dataRoot, "function")),
      providers: loadJsonRegistry(path.join(dataRoot, "number_provider"), "math:"),
      predicates: loadJsonRegistry(path.join(dataRoot, "predicate"), "math:"),
    };
  }
  return generatedGraph;
}

export function expandedProviderNodes(id, graph, stack = []) {
  if (typeof id === "number") return 1;
  if (typeof id === "string") {
    assert.ok(!stack.includes(id), `provider cycle: ${[...stack, id].join(" -> ")}`);
    const provider = graph.providers.get(id);
    assert.ok(provider !== undefined, `unknown provider: ${id}`);
    return expandedProviderNodes(provider, graph, [...stack, id]);
  }
  assert.ok(id && typeof id === "object");
  const children = [
    ...(id.operands ?? []),
    ...(id.cases ?? []).map(entry => entry.number_provider),
    ...("default" in id ? [id.default] : []),
    ...("on_true" in id ? [id.on_true, id.on_false] : []),
  ];
  return 1 + children.reduce((total, child) => total + expandedProviderNodes(child, graph, stack), 0);
}

function predicateProviderNodes(id, graph, stack = []) {
  if (typeof id === "string") {
    assert.ok(!stack.includes(id), `predicate cycle: ${[...stack, id].join(" -> ")}`);
    const predicate = graph.predicates.get(id);
    assert.ok(predicate !== undefined, `unknown predicate: ${id}`);
    return predicateProviderNodes(predicate, graph, [...stack, id]);
  }
  assert.ok(id && typeof id === "object", "invalid predicate");
  switch (id.type) {
    case "minecraft:value_check":
      return expandedProviderNodes(id.value, graph)
        + (id.range?.min === undefined ? 0 : expandedProviderNodes(id.range.min, graph))
        + (id.range?.max === undefined ? 0 : expandedProviderNodes(id.range.max, graph));
    case "minecraft:all_of":
    case "minecraft:any_of":
      return (id.terms ?? []).reduce((total, term) => total + predicateProviderNodes(term, graph, stack), 0);
    case "minecraft:inverted":
      return predicateProviderNodes(id.term ?? id.condition, graph, stack);
    default:
      return 0;
  }
}

function commandProviderNodes(command, graph) {
  let nodes = 0;
  for (const match of command.matchAll(/\bcompute default (\S+)/g)) {
    nodes += expandedProviderNodes(match[1], graph);
  }
  for (const match of command.matchAll(/\b(?:if|unless) predicate (\S+)/g)) {
    nodes += predicateProviderNodes(match[1], graph);
  }
  return nodes;
}

function functionCall(command) {
  const normalized = command.startsWith("$") ? command.slice(1) : command;
  let match = normalized.match(/^return run function (\S+)$/);
  if (match) return { path: normalizeFunctionPath(match[1]) };
  match = normalized.match(/^function (\S+)(?:\s+with storage \S+ \S+)?$/);
  if (match) return { path: normalizeFunctionPath(match[1]) };
  match = normalized.match(/^execute\b.*\brun (return run )?function (\S+)$/);
  if (match) return { path: normalizeFunctionPath(match[2]) };
  return undefined;
}

function emptyCost() {
  return { commands: 0, providerNodes: 0, calls: [] };
}

function addCosts(...costs) {
  return costs.reduce((total, cost) => ({
    commands: total.commands + cost.commands,
    providerNodes: total.providerNodes + cost.providerNodes,
    calls: [...total.calls, ...cost.calls],
  }), emptyCost());
}

function greaterCost(left, right) {
  if (left.commands !== right.commands) return left.commands > right.commands ? left : right;
  if (left.providerNodes !== right.providerNodes) return left.providerNodes > right.providerNodes ? left : right;
  return left.calls.length >= right.calls.length ? left : right;
}

export function staticFunctionCost(pathText, graph, { recursionLimit = 320 } = {}) {
  assert.ok(Number.isInteger(recursionLimit) && recursionLimit >= 0, "recursionLimit must be a non-negative integer");
  const cache = new Map();

  const visit = (functionPath, depth) => {
    const cacheKey = `${functionPath}|${depth}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    const commands = graph.functions.get(functionPath);
    assert.ok(commands, `unknown function: ${functionPath}`);
    const own = {
      commands: commands.length,
      providerNodes: commands.reduce((total, command) => total + commandProviderNodes(command, graph), 0),
      calls: [],
    };
    if (depth >= recursionLimit) {
      cache.set(cacheKey, own);
      return own;
    }

    const children = commands
      .map(functionCall)
      .filter(Boolean)
      .map(call => addCosts({ commands: 0, providerNodes: 0, calls: [call.path] }, visit(call.path, depth + 1)));
    const cost = children.length === 0 ? own : addCosts(own, children.reduce(greaterCost));
    cache.set(cacheKey, cost);
    return cost;
  };

  return visit(normalizeFunctionPath(pathText), 0);
}
