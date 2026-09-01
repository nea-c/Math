import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const packRoot = path.resolve("Math");
const providerRoot = path.join(packRoot, "data", "math", "context_float_provider");

function jsonFiles(root) {
  return fs.readdirSync(root, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith(".json"))
    .map(entry => path.join(entry.parentPath, entry.name));
}

function visit(value, callback) {
  callback(value);
  if (!value || typeof value !== "object") return;
  for (const child of Array.isArray(value) ? value : Object.values(value)) visit(child, callback);
}

test("generated pack uses the 119.0 context-float-provider registry and schema", () => {
  const meta = JSON.parse(fs.readFileSync(path.join(packRoot, "pack.mcmeta"), "utf8"));
  assert.equal(meta.pack.min_format, 119);
  assert.equal(meta.pack.max_format, 119);
  assert.equal(fs.existsSync(path.join(packRoot, "data", "math", "number_provider")), false);
  assert.equal(fs.existsSync(providerRoot), true);

  const obsoleteTypes = new Set([
    "minecraft:sum",
    "minecraft:product",
    "minecraft:minimum",
    "minecraft:maximum",
    "minecraft:average",
  ]);
  for (const file of jsonFiles(providerRoot)) {
    visit(JSON.parse(fs.readFileSync(file, "utf8")), value => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return;
      assert.equal(obsoleteTypes.has(value.type), false, `${file} uses obsolete provider type ${value.type}`);
      assert.equal(Object.hasOwn(value, "operands"), false, `${file} uses obsolete operands field`);
      assert.equal(Object.hasOwn(value, "number_provider"), false, `${file} uses obsolete dispatcher field`);
    });
  }
});

test("public arithmetic tags use the native provider names", () => {
  const tagRoot = path.join(packRoot, "data", "math", "tags", "function");
  for (const name of ["abs", "sub", "mul", "div", "min", "max", "mod", "sqrt", "pow", "remainder"]) {
    assert.equal(fs.existsSync(path.join(tagRoot, `${name}.json`)), true, `missing #math:${name}`);
  }
  for (const name of ["absolute", "subtract", "multiply", "divide", "minimum", "maximum", "modulo", "square_root", "power"]) {
    assert.equal(fs.existsSync(path.join(tagRoot, `${name}.json`)), false, `obsolete #math:${name} remains`);
  }
});

test("shared float providers use the private .common namespace", () => {
  assert.equal(fs.existsSync(path.join(providerRoot, "common")), false, "public-looking common provider directory remains");
  assert.equal(fs.existsSync(path.join(providerRoot, ".common")), true, "private .common provider directory is missing");

  const functionRoot = path.join(packRoot, "data", "math", "function");
  for (const entry of fs.readdirSync(functionRoot, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".mcfunction")) continue;
    const file = path.join(entry.parentPath, entry.name);
    assert.doesNotMatch(fs.readFileSync(file, "utf8"), /\bmath:common\//, file);
  }
});

test("public calculation providers mirror their function names", () => {
  for (const name of [
    "abs", "add", "clamp", "cube", "deg", "div", "lerp",
    "max", "min", "mul", "rad", "reciprocal", "square", "sub",
  ]) {
    assert.equal(fs.existsSync(path.join(providerRoot, ".common", `${name}.json`)), true, `missing provider ${name}`);
  }

  for (const obsolete of ["arithmetic", "comparison", "constant", "conversion"]) {
    assert.equal(fs.existsSync(path.join(providerRoot, ".common", obsolete)), false, `obsolete provider group ${obsolete} remains`);
  }
  assert.equal(fs.existsSync(path.join(providerRoot, "pow")), true, "pow provider directory is missing");
  assert.equal(fs.existsSync(path.join(providerRoot, "sqrt")), true, "sqrt provider directory is missing");
  assert.equal(fs.existsSync(path.join(providerRoot, "power")), false, "obsolete power provider directory remains");
  assert.equal(fs.existsSync(path.join(providerRoot, "square_root")), false, "obsolete square_root provider directory remains");
});

test("constant functions assign float literals without providers", () => {
  const expected = new Map([
    ["e", "2.7182817459106445f"],
    ["pi", "3.1415927410125732f"],
    ["tau", "6.2831854820251465f"],
  ]);
  for (const [name, literal] of expected) {
    const source = fs.readFileSync(path.join(packRoot, "data", "math", "function", name, "0.start.mcfunction"), "utf8");
    assert.match(source, new RegExp(`data modify storage math: ans set value ${literal.replace(".", "\\.")}`), name);
    assert.doesNotMatch(source, / set compute /, name);
  }
});

test("bezier copies curve inputs directly from storage", () => {
  assert.equal(fs.existsSync(path.join(providerRoot, "bezier", "input")), false, "obsolete Bezier input providers remain");
  const source = fs.readFileSync(path.join(packRoot, "data", "math", "function", "bezier", "0.start.mcfunction"), "utf8");
  for (const [target, index] of [["x1", 0], ["y1", 1], ["x2", 2], ["y2", 3]]) {
    assert.match(source, new RegExp(`data modify storage math:internal w_bezier_${target} set from storage math: curve\\[${index}\\]`));
  }
  assert.doesNotMatch(source, /math:bezier\/input\//);
});

test("generated commands select float provider evaluation explicitly", () => {
  const functionRoot = path.join(packRoot, "data", "math", "function");
  for (const entry of fs.readdirSync(functionRoot, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".mcfunction")) continue;
    const file = path.join(entry.parentPath, entry.name);
    const source = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(source, /\bcompute (?:default|block \S+|entity \S+) math:/, file);
    for (const line of source.split(/\r?\n/).filter(line => line.includes(" compute "))) {
      assert.match(line, /\bcompute (?:default|block \S+|entity \S+) float math:/, `${file}: ${line}`);
    }
  }
});

test("native operations back directly supported public calculations", () => {
  const expectedTypes = new Map([
    [".common/abs.json", "minecraft:abs"],
    [".common/sub.json", "minecraft:sub"],
    [".common/mul.json", "minecraft:mul"],
    [".common/div.json", "minecraft:div"],
    [".common/reciprocal.json", "minecraft:div"],
    [".common/min.json", "minecraft:min"],
    [".common/max.json", "minecraft:max"],
    [".common/rounding/floor.json", "minecraft:floor"],
    [".common/rounding/ceil.json", "minecraft:ceil"],
    [".common/rounding/round.json", "minecraft:round"],
    [".common/rounding/truncate.json", "minecraft:truncate"],
    ["remainder/00.json", "minecraft:mod"],
    ["sin/00.json", "minecraft:sin"],
    ["cos/00.json", "minecraft:cos"],
    ["sqrt/00.json", "minecraft:sqrt"],
    ["pow/positive/00.json", "minecraft:pow"],
  ]);
  for (const [relative, expectedType] of expectedTypes) {
    const provider = JSON.parse(fs.readFileSync(path.join(providerRoot, relative), "utf8"));
    assert.equal(provider.type, expectedType, relative);
  }
});

test("generated predicates use float_value_check with the test field", () => {
  const predicateRoot = path.join(packRoot, "data", "math", "predicate", "internal");
  for (const file of jsonFiles(predicateRoot)) {
    visit(JSON.parse(fs.readFileSync(file, "utf8")), value => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return;
      assert.notEqual(value.type, "minecraft:value_check", file);
      assert.equal(Object.hasOwn(value, "range"), false, `${file} uses obsolete range field`);
      if (value.type === "minecraft:float_value_check") assert.equal(Object.hasOwn(value, "test"), true, file);
    });
  }
});
