import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  maximum,
  minimum,
  product,
  storage,
  sum,
  writeGeneratedJson,
} from "./math-provider-lib.mjs";

const command = "node tools/generate-math-providers.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const finiteLimit = 3.4028234663852886e38;
const smallestNegativeFloat = -1.401298464324817e-45;
const generatedFiles = [];

function emit(relativePath, value) {
  generatedFiles.push({ kind: "json", relativePath: `Math/data/math/number_provider/${relativePath}.json`, value });
}

function emitPredicate(relativePath, value) {
  generatedFiles.push({ kind: "json", relativePath: `Math/data/math/predicate/internal/${relativePath}.json`, value });
}

function emitFunction(name, lines) {
  generatedFiles.push({ kind: "function", relativePath: `Math/data/math/function/${name}.mcfunction`, text: `${lines.join("\n")}\n` });
}

function finitePredicate(pathName) {
  return {
    condition: "minecraft:value_check",
    value: storage("math:", pathName),
    range: { min: -finiteLimit, max: finiteLimit },
  };
}

const x = storage("math:internal", "x");
const y = storage("math:internal", "y");
const z = storage("math:internal", "z");
const w = storage("math:internal", "w");

for (const [name, provider] of Object.entries({ x, y, z, w })) emit(`common/input/${name}`, provider);

emit("common/constant/pi", Math.fround(Math.PI));
emit("common/constant/tau", Math.fround(Math.PI * 2));
emit("common/constant/e", Math.fround(Math.E));
emit("common/arithmetic/add", sum(x, y));
emit("common/arithmetic/subtract", sum(x, product(-1, y)));
emit("common/arithmetic/multiply", product(x, y));
emit("common/arithmetic/square", product(x, x));
emit("common/arithmetic/cube", product(x, x, x));
emit("common/arithmetic/lerp", sum(x, product(z, sum(y, product(-1, x)))));
emit("common/comparison/absolute", maximum(x, product(-1, x)));
emit("common/comparison/minimum", minimum(x, y));
emit("common/comparison/maximum", maximum(x, y));
emit("common/comparison/clamp", maximum(minimum(x, w), z));
emit("common/conversion/rad", product(x, Math.fround(Math.PI / 180)));
emit("common/conversion/deg", product(x, Math.fround(180 / Math.PI)));

for (const name of ["a", "b", "min", "max", "t"]) emitPredicate(`finite/${name}`, finitePredicate(name));
emitPredicate("range/min_greater_than_max", {
  condition: "minecraft:value_check",
  value: sum(w, product(-1, z)),
  range: { max: smallestNegativeFloat },
});
emitPredicate("range/negative", {
  condition: "minecraft:value_check",
  value: x,
  range: { max: smallestNegativeFloat },
});
emitPredicate("range/positive", {
  condition: "minecraft:value_check",
  value: x,
  range: { min: -smallestNegativeFloat },
});

function validationLines(inputs) {
  const lines = ["data remove storage math: error"];
  for (const input of inputs) {
    lines.push(`execute unless predicate math:internal/finite/${input} run data remove storage math: ans`);
    lines.push(`execute unless predicate math:internal/finite/${input} run data modify storage math: error set value \"invalid_number\"`);
    lines.push(`execute unless predicate math:internal/finite/${input} run return fail`);
  }
  return lines;
}

function wrapper(name, inputs, provider, inputMap) {
  const lines = validationLines(inputs);
  for (const [internalName, publicName] of Object.entries(inputMap)) {
    lines.push(`data modify storage math:internal ${internalName} set from storage math: ${publicName}`);
  }
  lines.push(`data modify storage math: ans set compute default ${provider}`);
  lines.push("return 1");
  emitFunction(name, lines);
}

wrapper("add", ["a", "b"], "math:common/arithmetic/add", { x: "a", y: "b" });
wrapper("subtract", ["a", "b"], "math:common/arithmetic/subtract", { x: "a", y: "b" });
wrapper("multiply", ["a", "b"], "math:common/arithmetic/multiply", { x: "a", y: "b" });
wrapper("absolute", ["a"], "math:common/comparison/absolute", { x: "a" });
wrapper("minimum", ["a", "b"], "math:common/comparison/minimum", { x: "a", y: "b" });
wrapper("maximum", ["a", "b"], "math:common/comparison/maximum", { x: "a", y: "b" });
wrapper("square", ["a"], "math:common/arithmetic/square", { x: "a" });
wrapper("cube", ["a"], "math:common/arithmetic/cube", { x: "a" });
wrapper("rad", ["a"], "math:common/conversion/rad", { x: "a" });
wrapper("deg", ["a"], "math:common/conversion/deg", { x: "a" });
wrapper("lerp", ["a", "b", "t"], "math:common/arithmetic/lerp", { x: "a", y: "b", z: "t" });
for (const name of ["pi", "tau", "e"]) wrapper(name, [], `math:common/constant/${name}`, {});

{
  const lines = validationLines(["a"]);
  lines.push("data modify storage math:internal x set from storage math: a");
  lines.push("data modify storage math: ans set value 0.0f");
  lines.push("execute if predicate math:internal/range/negative run data modify storage math: ans set value -1.0f");
  lines.push("execute if predicate math:internal/range/positive run data modify storage math: ans set value 1.0f");
  lines.push("return 1");
  emitFunction("sign", lines);
}

{
  const lines = validationLines(["a", "min", "max"]);
  lines.push("data modify storage math:internal x set from storage math: a");
  lines.push("data modify storage math:internal z set from storage math: min");
  lines.push("data modify storage math:internal w set from storage math: max");
  lines.push("execute if predicate math:internal/range/min_greater_than_max run data remove storage math: ans");
  lines.push("execute if predicate math:internal/range/min_greater_than_max run data modify storage math: error set value \"invalid_clamp_range\"");
  lines.push("execute if predicate math:internal/range/min_greater_than_max run return fail");
  lines.push("data modify storage math: ans set compute default math:common/comparison/clamp");
  lines.push("return 1");
  emitFunction("clamp", lines);
}

function generate(targetRoot) {
  for (const file of generatedFiles) {
    if (file.kind === "json") {
      writeGeneratedJson(targetRoot, file.relativePath.replace(/\.json$/, ""), file.value);
    } else {
      const target = path.join(targetRoot, ...file.relativePath.split("/"));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, file.text);
    }
  }
  if (targetRoot === root) {
    fs.writeFileSync(
      path.join(root, "tools", "generated-math-files.json"),
      JSON.stringify({ command, files: generatedPaths() }, null, 2) + "\n",
    );
  }
}

function generatedPaths() {
  return generatedFiles.map(({ relativePath }) => relativePath).sort();
}

function check() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "math-provider-generation-"));
  try {
    generate(tempRoot);
    const manifest = JSON.parse(fs.readFileSync(path.join(root, "tools", "generated-math-files.json"), "utf8"));
    const expectedPaths = generatedPaths();
    if (manifest.command !== command || !Array.isArray(manifest.files)) {
      throw new Error("tools/generated-math-files.json must contain the generator command and a files array");
    }
    if (JSON.stringify(manifest.files) !== JSON.stringify(expectedPaths)) {
      throw new Error("tools/generated-math-files.json does not match the generated provider paths");
    }
    for (const relativePath of expectedPaths) {
      const expected = fs.readFileSync(path.join(tempRoot, ...relativePath.split("/")));
      const actual = fs.readFileSync(path.join(root, ...relativePath.split("/")));
      if (!actual.equals(expected)) {
        throw new Error(`Generated provider differs: ${relativePath}`);
      }
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

try {
  if (process.argv.includes("--check")) {
    check();
  } else {
    generate(root);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
