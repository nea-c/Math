import test from "node:test";
import assert from "node:assert/strict";
import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PUBLIC_FUNCTION_NAMES, PUBLIC_FUNCTION_PATHS } from "../tools/function-layout.mjs";

const directWrappers = [
  "add", "sub", "mul", "abs", "min", "max", "square", "cube",
  "rad", "deg", "lerp", "floor", "ceil", "round", "truncate", "clamp",
  "div", "reciprocal", "remainder", "sqrt", "pow",
];

test("retired degrees API names are absent", () => {
  const roots = ["README.md", "tools", "tests", "Math/data/math/function", "Math/data/math/tags/function"];
  const retired = ["sin", "cos", "tan", "asin", "acos", "atan", "atan2"].map(base => `${base}_degrees`);
  const filesBelow = (entryPath) => {
    if (fs.statSync(entryPath).isFile()) return [entryPath];
    return fs.readdirSync(entryPath, { withFileTypes: true }).flatMap((entry) => {
      const child = path.join(entryPath, entry.name);
      return entry.isDirectory() ? filesBelow(child) : [child];
    });
  };
  const matches = roots.flatMap(filesBelow).filter((file) => {
    const source = fs.readFileSync(file, "utf8");
    return retired.some((name) => source.includes(name));
  });
  assert.deepEqual(matches, []);
});

function providerIdFromManifestPath(relativePath) {
  const prefix = "Math/data/math/context_float_provider/";
  return `math:${relativePath.slice(prefix.length, -".json".length)}`;
}

function providerStoragePaths(value, paths = []) {
  if (!value || typeof value !== "object") return paths;
  if (value.type === "minecraft:storage" && value.storage === "math:") paths.push(value.path);
  for (const child of Object.values(value)) providerStoragePaths(child, paths);
  return paths;
}

function commandProviderReferences(line) {
  const match = line.match(/(?:^|\brun )data modify (?:storage|entity|block)\b.+\bset compute default float (math:[a-z0-9_./-]+)$/);
  return match ? [match[1]] : [];
}

function inlineProviderForAudit(value) {
  return typeof value === "number"
    ? { type: "minecraft:constant", value }
    : value;
}

function redundantSingleCommandProviderIds(files, readFile) {
  const providerFiles = files.filter((relativePath) => (
    relativePath.startsWith("Math/data/math/context_float_provider/") && relativePath.endsWith(".json")
  ));
  const providerIds = new Set(providerFiles.map(providerIdFromManifestPath));
  const commandConsumers = new Map([...providerIds].map(id => [id, []]));
  const otherTextConsumers = new Map([...providerIds].map(id => [id, []]));
  const jsonConsumers = new Map([...providerIds].map(id => [id, []]));

  for (const relativePath of files.filter(file => file.endsWith(".mcfunction"))) {
    for (const line of readFile(relativePath).split(/\r?\n/)) {
      const recognized = new Set(commandProviderReferences(line));
      for (const id of recognized) if (commandConsumers.has(id)) commandConsumers.get(id).push(relativePath);
      for (const id of line.match(/math:[a-z0-9_./-]+/g) ?? []) {
        if (otherTextConsumers.has(id) && !recognized.has(id)) otherTextConsumers.get(id).push(relativePath);
      }
    }
  }
  for (const relativePath of files.filter(file => file.endsWith(".json"))) {
    const source = readFile(relativePath);
    for (const match of source.matchAll(/"(math:[a-z0-9_./-]+)"/g)) {
      if (jsonConsumers.has(match[1])) jsonConsumers.get(match[1]).push(relativePath);
    }
  }

  return providerFiles
    .filter(relativePath => Buffer.byteLength(JSON.stringify(
      inlineProviderForAudit(JSON.parse(readFile(relativePath))),
    )) <= 128)
    .map(relativePath => providerIdFromManifestPath(relativePath))
    .filter(id => commandConsumers.get(id).length === 1
      && otherTextConsumers.get(id).length === 0
      && jsonConsumers.get(id).length === 0);
}

function repositorySnapshot(root) {
  const snapshot = new Map();
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (directory === root && entry.name === ".git") continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(absolute);
      } else if (entry.isFile()) {
        const relative = path.relative(root, absolute).replaceAll("\\", "/");
        const digest = crypto.createHash("sha256").update(fs.readFileSync(absolute)).digest("hex");
        snapshot.set(relative, digest);
      }
    }
  };
  visit(root);
  return [...snapshot].sort(([left], [right]) => left.localeCompare(right));
}

function validatePackGraph(packRoot, { onReference } = {}) {
  const issues = [];
  const dataRoot = path.join(packRoot, "data");
  const resourceLocation = /^(#?)([a-z0-9_.-]+):([a-z0-9_./-]+)$/;
  const relativeSource = (file) => path.relative(packRoot, file).replaceAll("\\", "/");

  const registryPath = (registry, id) => {
    const match = resourceLocation.exec(id);
    if (!match) return undefined;
    const [, tag, namespace, resourcePath] = match;
    if (namespace === "minecraft") return null;
    if (registry === "function" && tag) {
      return path.join(dataRoot, namespace, "tags", "function", `${resourcePath}.json`);
    }
    if (tag) return undefined;
    const extension = registry === "function" ? ".mcfunction" : ".json";
    return path.join(dataRoot, namespace, registry, `${resourcePath}${extension}`);
  };

  const checkReference = (registry, id, source, location) => {
    const target = registryPath(registry, id);
    const sourceLocation = location.startsWith(".")
      ? `${relativeSource(source)}:${location.slice(1)}`
      : `${relativeSource(source)}${location}`;
    const prefix = `${sourceLocation}:`;
    if (target === undefined) {
      issues.push(`${prefix} invalid ${registry} reference ${id}`);
    } else if (target !== null && !fs.existsSync(target)) {
      issues.push(`${prefix} dangling ${registry} ${id}`);
    } else if (target !== null) {
      onReference?.({ source: path.resolve(source), target: path.resolve(target) });
    }
  };

  const walkProvider = (provider, source, location) => {
    if (typeof provider === "number") return;
    if (typeof provider === "string") {
      checkReference("context_float_provider", provider, source, location);
      return;
    }
    assert.ok(provider && typeof provider === "object" && !Array.isArray(provider), `${relativeSource(source)}${location}: invalid number provider`);
    switch (provider.type) {
      case "minecraft:constant":
        assert.equal(typeof provider.value, "number", `${relativeSource(source)}${location}.value: constant value must be a number`);
        return;
      case "minecraft:storage":
        return;
      case "minecraft:add":
      case "minecraft:mul":
      case "minecraft:max":
      case "minecraft:min":
      case "minecraft:avg":
      case "minecraft:length":
        assert.ok(Array.isArray(provider.inputs), `${relativeSource(source)}${location}: inputs must be an array`);
        provider.inputs.forEach((input, index) => walkProvider(input, source, `${location}.inputs[${index}]`));
        return;
      case "minecraft:abs":
      case "minecraft:negate":
      case "minecraft:floor":
      case "minecraft:ceil":
      case "minecraft:round":
      case "minecraft:truncate":
      case "minecraft:sqrt":
      case "minecraft:sin":
      case "minecraft:cos":
        walkProvider(provider.input, source, `${location}.input`);
        return;
      case "minecraft:sub":
      case "minecraft:div":
      case "minecraft:mod":
        walkProvider(provider.left, source, `${location}.left`);
        walkProvider(provider.right, source, `${location}.right`);
        return;
      case "minecraft:pow":
        walkProvider(provider.base, source, `${location}.base`);
        walkProvider(provider.exponent, source, `${location}.exponent`);
        return;
      case "minecraft:number_dispatcher":
        assert.ok(Array.isArray(provider.cases), `${relativeSource(source)}${location}: cases must be an array`);
        provider.cases.forEach((entry, index) => {
          walkPredicate(entry.condition, source, `${location}.cases[${index}].condition`);
          walkProvider(entry.value, source, `${location}.cases[${index}].value`);
        });
        walkProvider(provider.default, source, `${location}.default`);
        return;
      case "minecraft:conditional":
        walkPredicate(provider.conditions, source, `${location}.conditions`);
        walkProvider(provider.on_true, source, `${location}.on_true`);
        walkProvider(provider.on_false, source, `${location}.on_false`);
        return;
      default:
        assert.fail(`${relativeSource(source)}${location}: unsupported number provider type ${provider.type}`);
    }
  };

  const walkPredicate = (predicate, source, location) => {
    if (typeof predicate === "string") {
      checkReference("predicate", predicate, source, location);
      return;
    }
    assert.ok(predicate && typeof predicate === "object" && !Array.isArray(predicate), `${relativeSource(source)}${location}: invalid predicate`);
    switch (predicate.type) {
      case "minecraft:float_value_check":
        walkProvider(predicate.value, source, `${location}.value`);
        if (Object.hasOwn(predicate.test, "min")) walkProvider(predicate.test.min, source, `${location}.test.min`);
        if (Object.hasOwn(predicate.test, "max")) walkProvider(predicate.test.max, source, `${location}.test.max`);
        return;
      case "minecraft:all_of":
      case "minecraft:any_of":
        assert.ok(Array.isArray(predicate.terms), `${relativeSource(source)}${location}: terms must be an array`);
        predicate.terms.forEach((term, index) => walkPredicate(term, source, `${location}.terms[${index}]`));
        return;
      case "minecraft:inverted":
        walkPredicate(predicate.term ?? predicate.condition, source, `${location}.${Object.hasOwn(predicate, "term") ? "term" : "condition"}`);
        return;
      default:
        assert.fail(`${relativeSource(source)}${location}: unsupported predicate type ${predicate.type}`);
    }
  };

  const tokenizeCommand = (rawLine) => {
    if (!rawLine.trim() || rawLine.trimStart().startsWith("#")) return [];
    const tokens = [];
    let token = "";
    let quote;
    let escaped = false;
    const finishToken = () => {
      if (!token) return;
      tokens.push(token);
      token = "";
    };
    for (const character of rawLine.trim()) {
      if (quote) {
        if (escaped) {
          token += character;
          escaped = false;
        } else if (character === "\\") {
          token += character;
          escaped = true;
        } else if (character === quote) {
          token += character;
          quote = undefined;
        } else {
          token += character;
        }
        continue;
      }
      if (character === '"' || character === "'") {
        quote = character;
        token += character;
      } else if (/\s/.test(character)) {
        finishToken();
      } else {
        token += character;
      }
    }
    finishToken();
    return tokens;
  };

  const scanCommand = (tokens, start, source, location) => {
    const checkAt = (registry, index) => {
      if (index < tokens.length) checkReference(registry, tokens[index], source, location);
    };
    const checkProviderAt = (index) => {
      if (index >= tokens.length) return;
      const value = tokens[index];
      try {
        const inline = JSON.parse(value);
        if (inline && typeof inline === "object" && !Array.isArray(inline)) {
          walkProvider(inline, source, `${location}.inline`);
          return;
        }
      } catch {
        // Resource locations are checked below.
      }
      checkReference("context_float_provider", value, source, location);
    };
    const scanDataModify = () => {
      if (tokens[start + 1] !== "modify") return;
      const targetType = tokens[start + 2];
      const operationIndex = targetType === "block" ? start + 7 : start + 5;
      const operation = tokens[operationIndex];
      if (!["append", "insert", "merge", "prepend", "set"].includes(operation)) return;
      const sourceIndex = operationIndex + (operation === "insert" ? 2 : 1);
      if (tokens[sourceIndex] === "compute" && tokens[sourceIndex + 2] === "float") {
        checkProviderAt(sourceIndex + 3);
      }
    };
    const scanExecute = () => {
      let cursor = start + 1;
      while (cursor < tokens.length) {
        if (tokens[cursor] === "run") {
          scanCommand(tokens, cursor + 1, source, location);
          return;
        }
        if (["if", "unless"].includes(tokens[cursor])) {
          const condition = tokens[cursor + 1];
          if (condition === "predicate") {
            checkAt("predicate", cursor + 2);
            cursor += 3;
          } else if (condition === "score") {
            cursor += tokens[cursor + 4] === "matches" ? 6 : 7;
          } else if (condition === "data") {
            cursor += tokens[cursor + 2] === "block" ? 7 : 5;
          } else if (condition === "block") {
            cursor += 8;
          } else if (condition === "blocks") {
            cursor += 12;
          } else if (condition === "entity") {
            cursor += 3;
          } else if (condition === "loaded") {
            cursor += 5;
          } else {
            return;
          }
          continue;
        }
        if (tokens[cursor] === "store") {
          const destination = tokens[cursor + 2];
          cursor += destination === "score" || destination === "bossbar"
            ? 5
            : destination === "block" ? 9 : 7;
          continue;
        }
        if (["as", "at", "on", "align", "anchored", "in", "summon"].includes(tokens[cursor])) {
          cursor += 2;
          continue;
        }
        if (["positioned", "rotated"].includes(tokens[cursor])) {
          cursor += tokens[cursor + 1] === "as" || tokens[cursor + 1] === "over" ? 3 : 4;
          continue;
        }
        if (tokens[cursor] === "facing") {
          cursor += tokens[cursor + 1] === "entity" ? 4 : 4;
          continue;
        }
        return;
      }
    };

    switch (tokens[start]) {
      case "function":
        checkAt("function", start + 1);
        return;
      case "compute":
        if (tokens[start + 2] === "float") checkProviderAt(start + 3);
        return;
      case "data":
        scanDataModify();
        return;
      case "execute":
        scanExecute();
        return;
      case "return":
        if (tokens[start + 1] === "run") {
          scanCommand(tokens, start + 2, source, location);
        } else if (["if", "unless"].includes(tokens[start + 1]) && tokens[start + 2] === "predicate") {
          checkAt("predicate", start + 3);
        }
        return;
      default:
        return;
    }
  };

  const visitFiles = (root, extension, visitor) => {
    if (!fs.existsSync(root)) return;
    for (const entry of fs.readdirSync(root, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(extension)) continue;
      visitor(path.join(entry.parentPath, entry.name));
    }
  };

  if (fs.existsSync(dataRoot)) {
    for (const namespace of fs.readdirSync(dataRoot, { withFileTypes: true })) {
      if (!namespace.isDirectory()) continue;
      const namespaceRoot = path.join(dataRoot, namespace.name);
      visitFiles(path.join(namespaceRoot, "context_float_provider"), ".json", (file) => {
        walkProvider(JSON.parse(fs.readFileSync(file, "utf8")), file, "");
      });
      visitFiles(path.join(namespaceRoot, "predicate"), ".json", (file) => {
        walkPredicate(JSON.parse(fs.readFileSync(file, "utf8")), file, "");
      });
      visitFiles(path.join(namespaceRoot, "function"), ".mcfunction", (file) => {
        const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
        lines.forEach((rawLine, index) => {
          scanCommand(tokenizeCommand(rawLine), 0, file, `:${index + 1}`);
        });
      });
      visitFiles(path.join(namespaceRoot, "tags", "function"), ".json", (file) => {
        const tag = JSON.parse(fs.readFileSync(file, "utf8"));
        assert.ok(Array.isArray(tag.values), `${relativeSource(file)}: values must be an array`);
        tag.values.forEach((value, index) => {
          assert.equal(typeof value, "string", `${relativeSource(file)}:values[${index}] must be a string`);
          checkReference("function", value, file, `:values[${index}]`);
        });
      });
    }
  }
  return issues.sort();
}

function unreachablePublicRegistryAssets(packRoot) {
  const edges = new Map();
  const addEdge = ({ source, target }) => {
    if (!edges.has(source)) edges.set(source, new Set());
    edges.get(source).add(target);
  };
  assert.deepEqual(validatePackGraph(packRoot, { onReference: addEdge }), []);

  const filesUnder = (root, extension) => fs.existsSync(root)
    ? fs.readdirSync(root, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(extension))
      .map((entry) => path.resolve(entry.parentPath, entry.name))
    : [];
  const mathRoot = path.join(packRoot, "data", "math");
  const roots = filesUnder(path.join(mathRoot, "tags", "function"), ".json");
  const assets = [
    ...filesUnder(path.join(mathRoot, "function"), ".mcfunction"),
    ...filesUnder(path.join(mathRoot, "predicate"), ".json"),
    ...filesUnder(path.join(mathRoot, "context_float_provider"), ".json"),
  ];
  const reachable = new Set(roots);
  const pending = [...roots];
  while (pending.length > 0) {
    const source = pending.pop();
    for (const target of edges.get(source) ?? []) {
      if (reachable.has(target)) continue;
      reachable.add(target);
      pending.push(target);
    }
  }
  return assets
    .filter((file) => !reachable.has(file))
    .map((file) => path.relative(packRoot, file).replaceAll("\\", "/"))
    .sort();
}

test("pack graph validator detects controlled dangling registry references", () => {
  const packRoot = fs.mkdtempSync(path.join(os.tmpdir(), "math-pack-graph-"));
  try {
    const write = (relative, value) => {
      const file = path.join(packRoot, relative);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`);
    };
    write("data/math/context_float_provider/fixture/aggregate.json", {
      type: "minecraft:add",
      inputs: ["math:missing/input", 1],
    });
    write("data/math/context_float_provider/fixture/dispatcher.json", {
      type: "minecraft:number_dispatcher",
      cases: [{
        condition: "math:missing/case_condition",
        value: "math:missing/case_provider",
      }],
      default: "math:missing/default_provider",
    });
    write("data/math/predicate/fixture/nesting.json", {
      type: "minecraft:all_of",
      terms: [
        "math:missing/term",
        { type: "minecraft:inverted", term: "math:missing/inverted" },
        { type: "minecraft:any_of", terms: ["math:missing/any_of"] },
      ],
    });
    write("data/math/predicate/fixture/value_check.json", {
      type: "minecraft:float_value_check",
      value: "math:missing/value",
      test: {
        min: "math:missing/range_min",
        max: "math:missing/range_max",
      },
    });
    write("data/math/context_float_provider/fixture/conditional.json", {
      type: "minecraft:conditional",
      conditions: "math:missing/conditional_condition",
      on_true: "math:missing/on_true",
      on_false: "math:missing/on_false",
    });
    write("data/math/function/fixture/root.mcfunction", [
      "function math:missing/direct_function",
      "return run function math:missing/returned_function",
      "execute if score #x fixture matches 1 run function math:missing/executed_function",
      "execute if predicate math:missing/if_predicate run return 1",
      "execute unless predicate math:missing/unless_predicate run return 1",
      "return if predicate math:missing/return_if_predicate",
      "return unless predicate math:missing/return_unless_predicate",
      "compute default float math:missing/direct_compute",
      "execute if score #x fixture matches 1 run compute default float math:missing/executed_compute",
      "data modify storage math:internal x append compute default float math:missing/data_append",
      "data modify storage math:internal x insert 0 compute default float math:missing/data_insert",
      "data modify storage math:internal x merge compute default float math:missing/data_merge",
      "data modify storage math:internal x prepend compute default float math:missing/data_prepend",
      "data modify storage math:internal x set compute default float math:missing/data_set",
      "data modify storage math:internal x set compute default float 1.25",
      'data modify storage math:internal x set compute default float {"type":"minecraft:add","inputs":["math:missing/inline_ref",1]}',
      'tellraw @a {"text":"function math:missing/literal is prose"}',
      "say function math:missing/chat",
      'tellraw @a {"text":"escaped \\\" quote; function math:missing/escaped is prose"}',
      "# function math:missing/comment",
      "",
    ].join("\n"));
    write("data/math/tags/function/fixture.json", { values: ["math:missing/entry"] });

    assert.deepEqual(new Set(validatePackGraph(packRoot)), new Set([
      "data/math/function/fixture/root.mcfunction:1: dangling function math:missing/direct_function",
      "data/math/function/fixture/root.mcfunction:2: dangling function math:missing/returned_function",
      "data/math/function/fixture/root.mcfunction:3: dangling function math:missing/executed_function",
      "data/math/function/fixture/root.mcfunction:4: dangling predicate math:missing/if_predicate",
      "data/math/function/fixture/root.mcfunction:5: dangling predicate math:missing/unless_predicate",
      "data/math/function/fixture/root.mcfunction:6: dangling predicate math:missing/return_if_predicate",
      "data/math/function/fixture/root.mcfunction:7: dangling predicate math:missing/return_unless_predicate",
      "data/math/function/fixture/root.mcfunction:8: dangling context_float_provider math:missing/direct_compute",
      "data/math/function/fixture/root.mcfunction:9: dangling context_float_provider math:missing/executed_compute",
      "data/math/function/fixture/root.mcfunction:10: dangling context_float_provider math:missing/data_append",
      "data/math/function/fixture/root.mcfunction:11: dangling context_float_provider math:missing/data_insert",
      "data/math/function/fixture/root.mcfunction:12: dangling context_float_provider math:missing/data_merge",
      "data/math/function/fixture/root.mcfunction:13: dangling context_float_provider math:missing/data_prepend",
      "data/math/function/fixture/root.mcfunction:14: dangling context_float_provider math:missing/data_set",
      "data/math/function/fixture/root.mcfunction:15: invalid context_float_provider reference 1.25",
      "data/math/function/fixture/root.mcfunction:16.inline.inputs[0]: dangling context_float_provider math:missing/inline_ref",
      "data/math/context_float_provider/fixture/aggregate.json:inputs[0]: dangling context_float_provider math:missing/input",
      "data/math/context_float_provider/fixture/conditional.json:conditions: dangling predicate math:missing/conditional_condition",
      "data/math/context_float_provider/fixture/conditional.json:on_false: dangling context_float_provider math:missing/on_false",
      "data/math/context_float_provider/fixture/conditional.json:on_true: dangling context_float_provider math:missing/on_true",
      "data/math/context_float_provider/fixture/dispatcher.json:cases[0].condition: dangling predicate math:missing/case_condition",
      "data/math/context_float_provider/fixture/dispatcher.json:cases[0].value: dangling context_float_provider math:missing/case_provider",
      "data/math/context_float_provider/fixture/dispatcher.json:default: dangling context_float_provider math:missing/default_provider",
      "data/math/predicate/fixture/nesting.json:terms[0]: dangling predicate math:missing/term",
      "data/math/predicate/fixture/nesting.json:terms[1].term: dangling predicate math:missing/inverted",
      "data/math/predicate/fixture/nesting.json:terms[2].terms[0]: dangling predicate math:missing/any_of",
      "data/math/predicate/fixture/value_check.json:test.max: dangling context_float_provider math:missing/range_max",
      "data/math/predicate/fixture/value_check.json:test.min: dangling context_float_provider math:missing/range_min",
      "data/math/predicate/fixture/value_check.json:value: dangling context_float_provider math:missing/value",
      "data/math/tags/function/fixture.json:values[0]: dangling function math:missing/entry",
    ]));
  } finally {
    fs.rmSync(packRoot, { recursive: true, force: true });
  }
});

test("all pack registry references resolve", () => {
  assert.deepEqual(validatePackGraph("Math"), []);
});

test("public function tags reach every generated function, predicate, and provider", () => {
  assert.deepEqual(unreachablePublicRegistryAssets("Math"), []);
});

test("public registry reachability rejects a self-referential dead graph", () => {
  const packRoot = fs.mkdtempSync(path.join(os.tmpdir(), "math-pack-reachability-"));
  try {
    const write = (relative, value) => {
      const file = path.join(packRoot, relative);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`);
    };
    write("data/math/tags/function/live.json", { values: ["math:live/root"] });
    write("data/math/function/live/root.mcfunction", "data modify storage math: ans set compute default float math:live/root\n");
    write("data/math/context_float_provider/live/root.json", {
      type: "minecraft:conditional",
      conditions: {
        type: "minecraft:float_value_check",
        value: "math:live/value",
        test: { min: 0 },
      },
      on_true: "math:live/value",
      on_false: 0,
    });
    write("data/math/context_float_provider/live/value.json", 1);
    write("data/math/function/dead/cycle.mcfunction", "function math:dead/cycle\ndata modify storage math: ans set compute default float math:dead/cycle\n");
    write("data/math/context_float_provider/dead/cycle.json", {
      type: "minecraft:number_dispatcher",
      cases: [{ condition: "math:dead/cycle", value: "math:dead/cycle" }],
      default: 0,
    });
    write("data/math/predicate/dead/cycle.json", {
      type: "minecraft:inverted",
      term: "math:dead/cycle",
    });

    assert.deepEqual(unreachablePublicRegistryAssets(packRoot), [
      "data/math/context_float_provider/dead/cycle.json",
      "data/math/function/dead/cycle.mcfunction",
      "data/math/predicate/dead/cycle.json",
    ]);
  } finally {
    fs.rmSync(packRoot, { recursive: true, force: true });
  }
});

test("pack targets data pack format 119", () => {
  const meta = JSON.parse(fs.readFileSync("Math/pack.mcmeta", "utf8"));
  assert.equal(meta.pack.min_format, 119);
  assert.equal(meta.pack.max_format, 119);
});

test("public documentation uses function tags", () => {
  const readme = fs.readFileSync("README.md", "utf8");
  const integrationHarness = fs.readFileSync("tools/integration-test.ps1", "utf8");
  const prose = readme.replace(/```[\s\S]*?```/g, "");
  assert.doesNotMatch(prose, /function math:(?!internal)/);
  assert.doesNotMatch(integrationHarness, /run function math:(?!internal)/);
  assert.match(readme, /function #math:div/);
  assert.match(integrationHarness, /function #math:add/);
});

test("README documents a valid-input contract for every public function", () => {
  const readme = fs.readFileSync("README.md", "utf8");
  const documented = new Set(
    [...readme.matchAll(/^\| `#math:([a-z0-9_]+)` \|[^\n]*\|[^\n]*\|[^\n]+\|$/gm)]
      .map((match) => match[1]),
  );
  assert.deepEqual([...documented].sort(), [...PUBLIC_FUNCTION_NAMES].sort());
  assert.match(readme, /無効な入力に対する `ans` の存在・型・値は保証しません/);
  assert.match(readme, /すべての数値入力は有限値で指定し、32-bit floatとして評価されます/);
});

test("release pack excludes prototype debug functions", () => {
  const debugRoot = "Math/data/math/function/debug";
  const debugFunctions = fs.existsSync(debugRoot)
    ? fs.readdirSync(debugRoot, { recursive: true }).filter((name) => name.endsWith(".mcfunction"))
    : [];
  assert.deepEqual(debugFunctions, []);
});

test("function tags expose every public function in the generated function layout", () => {
  const functionRoot = path.join("Math", "data", "math", "function");
  const tagRoot = path.join("Math", "data", "math", "tags", "function");
  assert.equal(fs.existsSync(tagRoot), true, "public function tag directory must exist");
  const tags = fs.readdirSync(tagRoot, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.relative(tagRoot, path.join(entry.parentPath, entry.name)).replaceAll("\\", "/"))
    .sort();

  assert.deepEqual(tags, PUBLIC_FUNCTION_NAMES.map((name) => `${name}.json`).sort());
  for (const name of PUBLIC_FUNCTION_NAMES) {
    const tag = JSON.parse(fs.readFileSync(path.join(tagRoot, `${name}.json`), "utf8"));
    assert.deepEqual(tag, { values: [`math:${name}/0.start`] }, name);
  }

  assert.equal(fs.existsSync(path.join(functionRoot, "internal")), false);
  assert.equal(fs.existsSync(path.join(functionRoot, "common")), false);
  assert.deepEqual(
    fs.readdirSync(functionRoot, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".mcfunction")),
    [],
  );

  assert.equal(fs.existsSync(path.join(functionRoot, ".common", "_error")), false);

  const manifest = JSON.parse(fs.readFileSync("tools/generated-math-files.json", "utf8"));
  assert.equal(manifest.files.some((file) => file.includes("/.common/_error/")), false);
  assert.equal(manifest.files.some((file) => file.includes("/.validation/finite/")), false);
  assert.equal(fs.existsSync(path.join(functionRoot, ".common", "invalid_number")), false);
  assert.equal(fs.existsSync(path.join(functionRoot, ".common", "result_out_of_range")), false);

  const functionDirectories = [
    ...PUBLIC_FUNCTION_NAMES.map((name) => path.join(functionRoot, name)),
    ...fs.readdirSync(path.join(functionRoot, ".common"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== "_error")
      .map((entry) => path.join(functionRoot, ".common", entry.name)),
  ];
  for (const directory of functionDirectories) {
    const relative = path.relative(functionRoot, directory).replaceAll("\\", "/");
    assert.ok(fs.existsSync(directory), `${relative} must exist`);
    assert.ok(relative.split("/").length <= 2, `${relative} exceeds the permitted function directory depth`);
    const files = fs.readdirSync(directory, { withFileTypes: true });
    assert.deepEqual(files.filter((entry) => entry.isDirectory()), [], `${relative} must be a leaf directory`);
    assert.ok(files.some((entry) => entry.name === "0.start.mcfunction"), `${relative} must contain 0.start.mcfunction`);
    const numericPrefixes = new Set();
    for (const entry of files) {
      assert.ok(entry.isFile(), `${relative}/${entry.name} must be a function file`);
      assert.match(entry.name, /^\d+\.[a-z0-9_]+\.mcfunction$/);
      const prefix = entry.name.split(".", 1)[0];
      assert.equal(numericPrefixes.has(prefix), false, `${relative} repeats numeric prefix ${prefix}`);
      numericPrefixes.add(prefix);
    }
  }
});

test("generated providers are current", () => {
  childProcess.execFileSync(process.execPath, ["tools/generate-math-providers.mjs", "--check"], {
    encoding: "utf8",
  });
});

test("public entries naturally end without exposing function results", () => {
  for (const name of PUBLIC_FUNCTION_NAMES) {
    const publicPath = PUBLIC_FUNCTION_PATHS[name];
    const source = fs.readFileSync(`Math/data/math/function/${publicPath}.mcfunction`, "utf8");
    assert.doesNotMatch(source, /(?:^|\n)return(?: |\n)/, name);
    assert.doesNotMatch(source, /storage math: error set/, name);
    assert.equal(source.includes("data remove storage math: error"), false, `${publicPath} must not touch retired error state`);
    assert.match(source, /^data remove storage math: ans$/m, `${publicPath} must clear stale ans`);
    assert.match(source, /^data remove storage math: internal$/m, name);
  }
});

test("generated functions omit obsolete validation control flow", () => {
  const manifest = JSON.parse(fs.readFileSync("tools/generated-math-files.json", "utf8"));
  for (const relativePath of manifest.files) {
    if (!relativePath.endsWith(".mcfunction")) continue;
    const source = fs.readFileSync(relativePath, "utf8");
    assert.doesNotMatch(source, /w_validation_/, relativePath);
    assert.doesNotMatch(source, /return fail/, relativePath);
    assert.doesNotMatch(source, /storage math: error set/, relativePath);
  }
});

test("generated functions compact successful early exits", () => {
  const manifest = JSON.parse(fs.readFileSync("tools/generated-math-files.json", "utf8"));
  for (const relativePath of manifest.files) {
    if (!relativePath.endsWith(".mcfunction")) continue;
    const lines = fs.readFileSync(relativePath, "utf8").trimEnd().split(/\r?\n/);
    if (lines.at(-1) === "return 1") {
      assert.doesNotMatch(
        lines.at(-2) ?? "",
        /^(?:data modify|function) /,
        `${relativePath} returns a fixed success instead of its final command`,
      );
    }

    for (let index = 1; index < lines.length; index += 1) {
      const successReturn = lines[index].match(/^execute (if|unless) (.+) run return 1$/);
      if (!successReturn) continue;
      const previousGuard = lines[index - 1].match(/^execute (if|unless) (.+) run /);
      assert.equal(
        previousGuard?.[1] === successReturn[1] && previousGuard?.[2] === successReturn[2],
        false,
        `${relativePath}:${index + 1} repeats a guard instead of returning its preceding command`,
      );
    }
  }
});

test("generated resources use one math storage with nested internal scratch", () => {
  const manifest = JSON.parse(fs.readFileSync("tools/generated-math-files.json", "utf8"));
  for (const relativePath of manifest.files) {
    if (!/\.(?:json|mcfunction)$/.test(relativePath)) continue;
    const source = fs.readFileSync(relativePath, "utf8");
    assert.doesNotMatch(source, /math:internal/, relativePath);
  }
  assert.match(
    fs.readFileSync("Math/data/math/function/add/0.start.mcfunction", "utf8"),
    /"storage":"math:","path":"a"/,
  );
});

test("redundancy audit uses compact inline provider bytes, not pretty JSON bytes", () => {
  const providerPath = "Math/data/math/context_float_provider/fixture/abs.json";
  const numericProviderPath = "Math/data/math/context_float_provider/fixture/numeric.json";
  const functionPath = "Math/data/math/function/fixture.mcfunction";
  const provider = {
    type: "minecraft:abs",
    input: { type: "minecraft:storage", storage: "math:", path: "internal.x" },
  };
  const sources = new Map([
    [providerPath, `${JSON.stringify(provider, null, 2)}\n`],
    [numericProviderPath, "3.1415927410125732\n"],
    [functionPath, [
      "data modify storage math: ans set compute default float math:fixture/abs",
      "data modify storage math: numeric set compute default float math:fixture/numeric",
      "",
    ].join("\n")],
  ]);

  assert.ok(Buffer.byteLength(sources.get(providerPath)) > 128);
  assert.ok(Buffer.byteLength(JSON.stringify(provider)) <= 128);
  assert.deepEqual(redundantSingleCommandProviderIds([...sources.keys()], file => sources.get(file)), [
    "math:fixture/abs",
    "math:fixture/numeric",
  ]);
});

test("simple public wrappers read public storage inline and leave no eligible provider resource", () => {
  const inputPaths = new Map([
    ["add", ["a", "b"]], ["sub", ["a", "b"]], ["mul", ["a", "b"]], ["abs", ["a"]],
    ["min", ["a", "b"]], ["max", ["a", "b"]], ["square", ["a"]], ["cube", ["a"]],
    ["rad", ["a"]], ["deg", ["a"]], ["lerp", ["a", "a", "b", "t"]], ["floor", ["a"]],
    ["ceil", ["a"]], ["round", ["a"]], ["truncate", ["a"]], ["clamp", ["a", "min", "max"]],
    ["div", ["a", "b"]], ["reciprocal", ["a"]], ["remainder", ["a", "b"]],
    ["sqrt", ["a"]], ["pow", ["a", "b"]],
  ]);
  const functionRoot = "Math/data/math/function";
  for (const name of directWrappers) {
    const source = fs.readFileSync(path.join(functionRoot, `${PUBLIC_FUNCTION_PATHS[name]}.mcfunction`), "utf8");
    const inline = source.match(/set compute default float (\{.*\})/);
    assert.ok(inline, `${name} must compute from an inline provider`);
    const paths = providerStoragePaths(JSON.parse(inline[1]));
    assert.deepEqual(paths.sort(), inputPaths.get(name).slice().sort(), `${name} provider public paths`);
    assert.doesNotMatch(source, /data modify storage math: internal\.[\w.]+ set from storage math: (?:a|b|t|min|max)$/m, name);
  }

  const manifest = JSON.parse(fs.readFileSync("tools/generated-math-files.json", "utf8"));
  const redundant = redundantSingleCommandProviderIds(manifest.files, relativePath => fs.readFileSync(relativePath, "utf8"));
  assert.deepEqual(redundant, [], "eligible one-command provider resources must be inlined");
});

test("stateful wrappers retain scratch that later calls or branches reuse", () => {
  const retained = [
    ["sin/1.compute", "internal.x set from storage math: a"],
    ["elastic/1.compute", "internal.x set from storage math: internal.w_elastic_amplitude"],
    ["bounce/1.compute", "internal.w_bounce_scaled_t set from storage math: t"],
  ];
  for (const [relativePath, requiredScratch] of retained) {
    const source = fs.readFileSync(path.join("Math/data/math/function", `${relativePath}.mcfunction`), "utf8");
    assert.match(source, new RegExp(requiredScratch.replaceAll(".", "\\.")), relativePath);
  }
});

test("generated assets omit context-float-provider documents with no consumers", () => {
  assert.equal(
    fs.existsSync("Math/data/math/context_float_provider/.common/atan/half_pi.json"),
    false,
    "unreferenced provider resources add reload work without serving a command or JSON consumer",
  );
});

test("generated predicates each have a generated consumer", () => {
  const manifest = JSON.parse(fs.readFileSync("tools/generated-math-files.json", "utf8"));
  const predicatePrefix = "Math/data/math/predicate/.validation/";
  for (const relativePath of manifest.files) {
    if (!relativePath.startsWith(predicatePrefix) || !relativePath.endsWith(".json")) continue;
    const predicateId = `math:.validation/${relativePath.slice(predicatePrefix.length, -".json".length)}`;
    const consumers = manifest.files.filter((candidate) => (
      candidate !== relativePath
      && /\.(?:json|mcfunction)$/.test(candidate)
      && fs.readFileSync(candidate, "utf8").includes(predicateId)
    ));
    assert.ok(consumers.length > 0, `${relativePath} has no generated consumer`);
  }
});

test("easing, inverse-sine, and quaternion assets are generator-owned", () => {
  const manifest = JSON.parse(fs.readFileSync("tools/generated-math-files.json", "utf8"));
  for (const file of [
    "Math/data/math/function/.common/asin_positive/0.start.mcfunction",
    "Math/data/math/function/elastic/0.start.mcfunction",
    "Math/data/math/function/elastic_decay/0.start.mcfunction",
    "Math/data/math/context_float_provider/.common/asin_positive/midpoint.json",
    "Math/data/math/tags/function/elastic.json",
    "Math/data/math/function/bounce/0.start.mcfunction",
    "Math/data/math/function/bounce_decay/0.start.mcfunction",
    "Math/data/math/tags/function/bounce.json",
    "Math/data/math/tags/function/bounce_decay.json",
    "Math/data/math/function/quaternion_to_axis_angle/0.start.mcfunction",
    "Math/data/math/tags/function/quaternion_to_axis_angle.json",
  ]) assert.ok(manifest.files.includes(file), `${file} must be generated`);
  assert.equal(manifest.files.includes("Math/data/math/function/quaternion_to_axis_angle/1.compute.mcfunction"), false);
  const quaternionMaximum = fs.readFileSync(
    "Math/data/math/context_float_provider/quaternion_to_axis_angle/normalize/maximum.json",
    "utf8",
  );
  assert.match(quaternionMaximum, /"path": "rotation\[0\]"/,
    "quaternion input must be read directly by its generated provider");
});

test("generated value-check predicates use the format 119 float type discriminator", () => {
  function assertTyped(condition, file) {
    if (condition.type === "minecraft:all_of") {
      for (const term of condition.terms) assertTyped(term, file);
      return;
    }
    assert.equal(condition.type, "minecraft:float_value_check", file);
    assert.equal(condition.condition, undefined, file);
    assert.equal(condition.range, undefined, file);
    assert.ok(Object.hasOwn(condition, "test"), file);
  }

  const predicateRoot = path.join("Math/data/math/predicate/.validation");
  for (const entry of fs.readdirSync(predicateRoot, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const file = path.join(entry.parentPath, entry.name);
    const predicate = JSON.parse(fs.readFileSync(file, "utf8"));
    assertTyped(predicate, file);
  }

  const providerRoot = path.join("Math/data/math/context_float_provider");
  for (const entry of fs.readdirSync(providerRoot, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const provider = JSON.parse(fs.readFileSync(path.join(entry.parentPath, entry.name), "utf8"));
    if (provider.type !== "minecraft:number_dispatcher") continue;
    for (const dispatcherCase of provider.cases) {
      assertTyped(dispatcherCase.condition, path.join(entry.parentPath, entry.name));
    }
  }
});

test("every context-float-provider document has a Snapshot-valid object or numeric root", () => {
  const providerRoot = path.join("Math/data/math/context_float_provider");
  for (const entry of fs.readdirSync(providerRoot, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const file = path.join(entry.parentPath, entry.name);
    const provider = JSON.parse(fs.readFileSync(file, "utf8"));
    const validObject = provider !== null && typeof provider === "object" && !Array.isArray(provider);
    assert.ok(typeof provider === "number" || validObject, `${file} has an invalid bare-string provider root`);
  }
});

test("every dispatcher condition uses a float value check", () => {
  assert.equal(fs.existsSync("Math/data/math/context_float_provider/reciprocal"), false);
  assert.equal(fs.existsSync("Math/data/math/context_float_provider/divide.json"), false);
  const legacyNormalizer = "Math/data/math/context_float_provider/.common/normalize/power_of_two";
  const legacyFiles = fs.existsSync(legacyNormalizer)
    ? fs.readdirSync(legacyNormalizer, { recursive: true }).filter((name) => name.endsWith(".json"))
    : [];
  assert.deepEqual(legacyFiles, []);

  const providerRoot = path.join("Math/data/math/context_float_provider");
  const dispatchers = [];
  const collectDispatchers = (provider, file) => {
    if (!provider || typeof provider !== "object") return;
    if (provider.type === "minecraft:number_dispatcher") {
      dispatchers.push([file, provider]);
      for (const dispatcherCase of provider.cases) {
        collectDispatchers(dispatcherCase.value, file);
      }
      collectDispatchers(provider.default, file);
      return;
    }
    for (const input of provider.inputs ?? []) collectDispatchers(input, file);
    for (const field of ["input", "left", "right", "base", "exponent"]) collectDispatchers(provider[field], file);
  };
  for (const entry of fs.readdirSync(providerRoot, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const file = path.join(entry.parentPath, entry.name);
    const provider = JSON.parse(fs.readFileSync(file, "utf8"));
    collectDispatchers(provider, file);
  }

  function assertFloatChecks(condition, file) {
    if (condition.type === "minecraft:all_of") {
      condition.terms.forEach(term => assertFloatChecks(term, file));
      return;
    }
    assert.equal(condition.type, "minecraft:float_value_check", file);
    assert.ok(Object.hasOwn(condition, "test"), file);
  }
  for (const [file, dispatcher] of dispatchers) {
    for (const dispatcherCase of dispatcher.cases) {
      assertFloatChecks(dispatcherCase.condition, file);
    }
  }
});

test("every named predicate condition uses direct float-provider comparisons", () => {
  const predicateRoot = path.join("Math/data/math/predicate/.validation");

  function conditionValues(condition) {
    if (condition.type === "minecraft:all_of") return condition.terms.flatMap(conditionValues);
    assert.equal(condition.type, "minecraft:float_value_check");
    return [condition.value];
  }

  for (const entry of fs.readdirSync(predicateRoot, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const file = path.join(entry.parentPath, entry.name);
    const predicate = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const value of conditionValues(predicate)) {
      assert.notEqual(value, undefined, `${file} condition must define a value`);
    }
  }
});

test("generated functions and conditions use only declared storage with x/y/z/w-prefixed scratch", () => {
  const allowedStorage = new Set(["math:"]);
  const assertStorage = (storageId, storagePath, file) => {
    assert.ok(allowedStorage.has(storageId), `${file} uses undeclared storage ${storageId}`);
    const normalizedPath = storagePath.startsWith("{") ? storagePath.slice(1) : storagePath;
    for (const compound of normalizedPath.matchAll(/internal:\{([^{}]*)\}/g)) {
      for (const field of compound[1].matchAll(/(?:^|,)([A-Za-z0-9_]+):/g)) {
        assert.match(field[1], /^[xyzw](?:_|$)/, `${file} scratch compound ${storagePath} must use x/y/z/w-prefixed fields`);
      }
    }
    if (normalizedPath.startsWith("internal.")) {
      assert.match(normalizedPath.slice("internal.".length), /^[xyzw](?:_|$|\.|:)/, `${file} scratch path ${storagePath} must be x/y/z/w-prefixed`);
    }
  };
  const visit = (value, file) => {
    if (!value || typeof value !== "object") return;
    if (value.type === "minecraft:storage") assertStorage(value.storage, value.path, file);
    for (const child of Array.isArray(value) ? value : Object.values(value)) visit(child, file);
  };

  for (const root of ["Math/data/math/context_float_provider", "Math/data/math/predicate"]) {
    for (const entry of fs.readdirSync(root, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      const file = path.join(entry.parentPath, entry.name);
      visit(JSON.parse(fs.readFileSync(file, "utf8")), file);
    }
  }
  for (const entry of fs.readdirSync("Math/data/math/function", { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".mcfunction")) continue;
    const file = path.join(entry.parentPath, entry.name);
    const text = fs.readFileSync(file, "utf8");
    for (const match of text.matchAll(/storage (\S+) (\S+)/g)) assertStorage(match[1], match[2], file);
  }
});

test("integration harness cleans its unique temporary child and preserves the repository on controlled failure", () => {
  const repositoryRoot = process.cwd();
  const controlledTemp = fs.mkdtempSync(path.join(os.tmpdir(), "math-harness-contract-"));
  const invalidJar = path.join(controlledTemp, "invalid-server.jar");
  fs.writeFileSync(invalidJar, "not a server jar\n");
  const repositoryBefore = repositorySnapshot(repositoryRoot);
  const harnessChildren = () => fs.readdirSync(controlledTemp).filter((name) => name.startsWith("math-pack-test-")).sort();
  const tempBefore = harnessChildren();

  try {
    const invocation = childProcess.spawnSync("pwsh", [
      "-NoProfile",
      "-File", path.resolve("tools/integration-test.ps1"),
      "-MinecraftServerJar", invalidJar,
      "-JavaExecutable", process.execPath,
    ], {
      encoding: "utf8",
      env: { ...process.env, TEMP: controlledTemp, TMP: controlledTemp },
      timeout: 30_000,
    });

    assert.equal(invocation.error, undefined, invocation.error?.message);
    assert.notEqual(invocation.status, 0, "controlled child-process failure must fail the harness");
    assert.match(
      `${invocation.stdout}\n${invocation.stderr}`,
      /bad option: -jar/i,
      "the harness must reach the controlled Java-executable failure",
    );
    assert.deepEqual(harnessChildren(), tempBefore, "temporary child must be removed");
    assert.deepEqual(repositorySnapshot(repositoryRoot), repositoryBefore, "repository content must not change");
  } finally {
    fs.rmSync(controlledTemp, { recursive: true, force: true });
  }
});

test("integration harness generates storage-only valid-call assertions", (t) => {
  const javacProbe = childProcess.spawnSync("javac", ["-J-XshowSettings:properties", "-version"], { encoding: "utf8" });
  const javaHome = `${javacProbe.stdout ?? ""}\n${javacProbe.stderr ?? ""}`.match(/^\s*java\.home\s*=\s*(.+)$/m)?.[1].trim();
  const executableSuffix = process.platform === "win32" ? ".exe" : "";
  const javac = javaHome && path.join(javaHome, "bin", `javac${executableSuffix}`);
  const jar = javaHome && path.join(javaHome, "bin", `jar${executableSuffix}`);
  const java = javaHome && path.join(javaHome, "bin", `java${executableSuffix}`);
  if (!javac || !fs.existsSync(javac) || !fs.existsSync(jar) || !fs.existsSync(java)) {
    t.skip("a JDK is required to inspect generated integration assertions");
    return;
  }

  const controlledTemp = fs.mkdtempSync(path.join(os.tmpdir(), "math-harness-storage-contract-"));
  const fixtureRoot = path.join(controlledTemp, "fixture");
  fs.mkdirSync(fixtureRoot);
  const source = path.join(fixtureRoot, "FakeServer.java");
  const fakeJar = path.join(fixtureRoot, "fake-server.jar");
  fs.writeFileSync(source, `
import java.io.*;
import java.nio.file.*;
import java.util.*;

public final class FakeServer {
  private static int indexOf(List<String> lines, String command) {
    int index = lines.indexOf(command);
    if (index < 0) throw new AssertionError("missing command: " + command);
    return index;
  }

  public static void main(String[] args) throws Exception {
    Path assertions = Path.of("world", "datapacks", "MathAssertions", "data", "math_test", "function", "run.mcfunction");
    List<String> lines = Files.readAllLines(assertions);
    if (lines.stream().anyMatch(line -> line.contains("#return"))) {
      throw new AssertionError("public return assertion remains");
    }
    if (lines.stream().anyMatch(line -> line.matches(".*(invalid_number|division_by_zero|result_out_of_range|invalid_duration|invalid_curve|invalid_bounce|non_real_result|invalid_quaternion|undefined_tangent).*"))) {
      throw new AssertionError("invalid-input error-ID assertion remains");
    }
    int calls = 0;
    for (int call = 0; call < lines.size(); call++) {
      if (!lines.get(call).startsWith("function #math:")) continue;
      calls++;
      int end = call + 1;
      while (end < lines.size() && !lines.get(end).startsWith("function #math:") && !lines.get(end).startsWith("say MATH_TEST_PASS:")) end++;
      int resultGuard = -1;
      int staleErrorGuard = -1;
      int scratchGuard = -1;
      int staleErrorGuardCount = 0;
      int scratchGuardCount = 0;
      for (int cursor = call + 1; cursor < end; cursor++) {
        String line = lines.get(cursor);
        if (line.contains("unless data storage math: {ans:") || line.contains("unless score #")) resultGuard = cursor;
        if (line.contains("unless data storage math: {error:\\"stale_error\\"} run return run function math_test:fail/")) {
          staleErrorGuard = cursor;
          staleErrorGuardCount++;
        }
        if (line.contains("if data storage math: internal run return run function math_test:fail/")) {
          scratchGuard = cursor;
          scratchGuardCount++;
        }
      }
      if (!(call < resultGuard && resultGuard < staleErrorGuard && staleErrorGuard < scratchGuard && scratchGuard < end)
          || staleErrorGuardCount != 1 || scratchGuardCount != 1) {
        throw new AssertionError("valid call guards are missing, misordered, or attached to the next call: " + lines.get(call));
      }
      String staleErrorLine = lines.get(staleErrorGuard);
      String caseName = staleErrorLine.substring(staleErrorLine.indexOf("math_test:fail/") + 15, staleErrorLine.lastIndexOf("_stale_error"));
      if (!lines.get(scratchGuard).contains("math_test:fail/" + caseName + "_scratch")
          || !lines.get(resultGuard).contains("math_test:fail/" + caseName + "_")) {
        throw new AssertionError("valid call guards refer to different cases: " + lines.get(call));
      }
    }
    if (calls == 0) {
      throw new AssertionError("integration assertions contain no public calls");
    }

    int seed = indexOf(lines, "data modify storage math: internal set value {x:999.0f,w_stale:1}");
    int firstCall = indexOf(lines, "function #math:add");
    int firstAnswer = indexOf(lines, "execute unless data storage math: {ans:5.0f} run return run function math_test:fail/sequential_add_answer");
    int secondCall = indexOf(lines, "function #math:div");
    int secondAnswer = indexOf(lines, "execute unless data storage math: {ans:-3.5f} run return run function math_test:fail/sequential_div_answer");
    if (!(seed < firstCall && firstCall < firstAnswer && firstAnswer < secondCall && secondCall < secondAnswer)) {
      throw new AssertionError("sequential stale-scratch regression is not ordered");
    }
    indexOf(lines, "execute unless score #asin_mid_domain math_test matches 523659..523663 run return run function math_test:fail/asin_mid_domain_answer");
    indexOf(lines, "execute unless score #quaternion_angle math_test matches 4712573..4712585 run return run function math_test:fail/quaternion_to_axis_angle_angle");

    String marker = lines.stream().filter(line -> line.startsWith("say MATH_TEST_PASS:"))
      .findFirst().orElseThrow().substring(4);
    System.out.println(marker);
    new BufferedReader(new InputStreamReader(System.in)).readLine();
  }
}
`);
  childProcess.execFileSync(javac, [source], { cwd: fixtureRoot });
  childProcess.execFileSync(jar, ["--create", "--file", fakeJar, "--main-class", "FakeServer", "-C", fixtureRoot, "FakeServer.class"]);

  try {
    const invocation = childProcess.spawnSync("pwsh", [
      "-NoProfile",
      "-File", path.resolve("tools/integration-test.ps1"),
      "-MinecraftServerJar", fakeJar,
      "-JavaExecutable", java,
    ], {
      encoding: "utf8",
      env: { ...process.env, TEMP: controlledTemp, TMP: controlledTemp },
      timeout: 30_000,
    });

    assert.equal(invocation.error, undefined, invocation.error?.message);
    assert.equal(invocation.status, 0, `${invocation.stdout}\n${invocation.stderr}`);
    assert.match(invocation.stdout, /MATH_TEST_PASS:/);
  } finally {
    fs.rmSync(controlledTemp, { recursive: true, force: true });
  }
});

test("integration harness reports captured streams when a marked server exits nonzero", (t) => {
  const javacProbe = childProcess.spawnSync("javac", ["-J-XshowSettings:properties", "-version"], { encoding: "utf8" });
  const javaHome = `${javacProbe.stdout ?? ""}\n${javacProbe.stderr ?? ""}`.match(/^\s*java\.home\s*=\s*(.+)$/m)?.[1].trim();
  const executableSuffix = process.platform === "win32" ? ".exe" : "";
  const javac = javaHome && path.join(javaHome, "bin", `javac${executableSuffix}`);
  const jar = javaHome && path.join(javaHome, "bin", `jar${executableSuffix}`);
  const java = javaHome && path.join(javaHome, "bin", `java${executableSuffix}`);
  if (!javac || !fs.existsSync(javac) || !fs.existsSync(jar) || !fs.existsSync(java)) {
    t.skip("a JDK is required to build the temporary marked-server fixture");
    return;
  }

  const repositoryRoot = process.cwd();
  const controlledTemp = fs.mkdtempSync(path.join(os.tmpdir(), "math-harness-marked-contract-"));
  const fixtureRoot = path.join(controlledTemp, "fixture");
  fs.mkdirSync(fixtureRoot);
  const source = path.join(fixtureRoot, "FakeServer.java");
  const fakeJar = path.join(fixtureRoot, "fake-server.jar");
  fs.writeFileSync(source, `
import java.io.*;
import java.nio.file.*;

public final class FakeServer {
  public static void main(String[] args) throws Exception {
    Path assertions = Path.of("world", "datapacks", "MathAssertions", "data", "math_test", "function", "run.mcfunction");
    String marker = Files.readAllLines(assertions).stream()
      .filter(line -> line.startsWith("say MATH_TEST_PASS:"))
      .findFirst().orElseThrow().substring(4);
    System.out.println("FAKE_POST_MARKER_STDOUT");
    System.err.println("FAKE_POST_MARKER_STDERR");
    System.out.println(marker);
    new BufferedReader(new InputStreamReader(System.in)).readLine();
    System.exit(7);
  }
}
`);
  childProcess.execFileSync(javac, [source], { cwd: fixtureRoot });
  childProcess.execFileSync(jar, ["--create", "--file", fakeJar, "--main-class", "FakeServer", "-C", fixtureRoot, "FakeServer.class"]);
  const repositoryBefore = repositorySnapshot(repositoryRoot);
  const harnessChildren = () => fs.readdirSync(controlledTemp).filter((name) => name.startsWith("math-pack-test-")).sort();
  const tempBefore = harnessChildren();

  try {
    const invocation = childProcess.spawnSync("pwsh", [
      "-NoProfile",
      "-File", path.resolve("tools/integration-test.ps1"),
      "-MinecraftServerJar", fakeJar,
      "-JavaExecutable", java,
    ], {
      encoding: "utf8",
      env: { ...process.env, TEMP: controlledTemp, TMP: controlledTemp },
      timeout: 30_000,
    });

    assert.equal(invocation.error, undefined, invocation.error?.message);
    assert.notEqual(invocation.status, 0, "post-marker nonzero exit must fail the harness");
    assert.match(invocation.stderr, /STDOUT:/, "error must label captured stdout");
    assert.match(invocation.stderr, /FAKE_POST_MARKER_STDOUT/, "error must include captured stdout payload");
    assert.match(invocation.stderr, /STDERR:/, "error must label captured stderr");
    assert.match(invocation.stderr, /FAKE_POST_MARKER_STDERR/, "error must include captured stderr payload");
    assert.deepEqual(harnessChildren(), tempBefore, "temporary child must be removed");
    assert.deepEqual(repositorySnapshot(repositoryRoot), repositoryBefore, "repository content must not change");
  } finally {
    fs.rmSync(controlledTemp, { recursive: true, force: true });
  }
});
