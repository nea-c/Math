import test from "node:test";
import assert from "node:assert/strict";
import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

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

test("pack targets data pack format 118", () => {
  const meta = JSON.parse(fs.readFileSync("Math/pack.mcmeta", "utf8"));
  assert.equal(meta.pack.min_format, 118);
  assert.equal(meta.pack.max_format, 118);
});

test("generated providers are current", () => {
  childProcess.execFileSync(process.execPath, ["tools/generate-math-providers.mjs", "--check"], {
    encoding: "utf8",
  });
});

test("generated value-check predicates use the format 118 type discriminator", () => {
  function assertTyped(condition, file) {
    if (condition.type === "minecraft:all_of") {
      for (const term of condition.terms) assertTyped(term, file);
      return;
    }
    assert.equal(condition.type, "minecraft:value_check", file);
    assert.equal(condition.condition, undefined, file);
  }

  const predicateRoot = path.join("Math/data/math/predicate/internal");
  for (const entry of fs.readdirSync(predicateRoot, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const file = path.join(entry.parentPath, entry.name);
    const predicate = JSON.parse(fs.readFileSync(file, "utf8"));
    assertTyped(predicate, file);
  }

  const providerRoot = path.join("Math/data/math/number_provider");
  for (const entry of fs.readdirSync(providerRoot, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const provider = JSON.parse(fs.readFileSync(path.join(entry.parentPath, entry.name), "utf8"));
    if (provider.type !== "minecraft:number_dispatcher") continue;
    for (const dispatcherCase of provider.cases) {
      assertTyped(dispatcherCase.condition, path.join(entry.parentPath, entry.name));
    }
  }
});

test("every dispatcher condition reads an integer-valued staged or reduced field", () => {
  assert.equal(fs.existsSync("Math/data/math/number_provider/reciprocal"), false);
  assert.equal(fs.existsSync("Math/data/math/number_provider/divide.json"), false);
  const legacyNormalizer = "Math/data/math/number_provider/common/normalize/power_of_two";
  const legacyFiles = fs.existsSync(legacyNormalizer)
    ? fs.readdirSync(legacyNormalizer, { recursive: true }).filter((name) => name.endsWith(".json"))
    : [];
  assert.deepEqual(legacyFiles, []);

  const providerRoot = path.join("Math/data/math/number_provider");
  const dispatchers = [];
  for (const entry of fs.readdirSync(providerRoot, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const file = path.join(entry.parentPath, entry.name);
    const provider = JSON.parse(fs.readFileSync(file, "utf8"));
    if (provider.type === "minecraft:number_dispatcher") dispatchers.push([file, provider]);
  }
  assert.equal(dispatchers.length, 24);

  function conditionValues(condition) {
    if (condition.type === "minecraft:all_of") return condition.terms.flatMap(conditionValues);
    return [condition.value];
  }
  for (const [file, dispatcher] of dispatchers) {
    for (const dispatcherCase of dispatcher.cases) {
      for (const value of conditionValues(dispatcherCase.condition)) {
        assert.equal(value.type, "minecraft:storage", `${file} condition must read a materialized field`);
        const staged = value.storage === "math:comparison";
        const reducedExponent = file.includes(`${path.sep}exp${path.sep}`)
          && value.storage === "math:internal"
          && value.path === "z";
        assert.ok(staged || reducedExponent, `${file} condition source is not proven integer-valued`);
      }
    }
  }
});

test("every named predicate condition reads a materialized storage field", () => {
  const predicateRoot = path.join("Math/data/math/predicate/internal");

  function conditionValues(condition) {
    if (condition.type === "minecraft:all_of") return condition.terms.flatMap(conditionValues);
    assert.equal(condition.type, "minecraft:value_check");
    return [condition.value];
  }

  for (const entry of fs.readdirSync(predicateRoot, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const file = path.join(entry.parentPath, entry.name);
    const predicate = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const value of conditionValues(predicate)) {
      assert.equal(value.type, "minecraft:storage", `${file} condition must read a materialized field`);
      const staged = value.storage === "math:comparison";
      const normalizedInteger = value.storage === "math:internal"
        && ["x", "w"].includes(value.path)
        && file.includes(`${path.sep}comparison${path.sep}`);
      assert.ok(staged || normalizedInteger, `${file} condition source is not proven integer-valued`);
    }
  }
});

test("integration harness cleans its unique temporary child and preserves the repository on controlled failure", () => {
  const repositoryRoot = process.cwd();
  const controlledTemp = fs.mkdtempSync(path.join(os.tmpdir(), "math-harness-contract-"));
  const invalidJar = path.join(controlledTemp, "invalid-server.jar");
  fs.writeFileSync(invalidJar, "not a server jar\n");
  const repositoryBefore = repositorySnapshot(repositoryRoot);
  const tempBefore = fs.readdirSync(controlledTemp).sort();

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
    assert.deepEqual(fs.readdirSync(controlledTemp).sort(), tempBefore, "temporary child must be removed");
    assert.deepEqual(repositorySnapshot(repositoryRoot), repositoryBefore, "repository content must not change");
  } finally {
    fs.rmSync(controlledTemp, { recursive: true, force: true });
  }
});
