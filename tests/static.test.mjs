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

function validatePackGraph(packRoot) {
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
    }
  };

  const walkProvider = (provider, source, location) => {
    if (typeof provider === "number") return;
    if (typeof provider === "string") {
      checkReference("number_provider", provider, source, location);
      return;
    }
    assert.ok(provider && typeof provider === "object" && !Array.isArray(provider), `${relativeSource(source)}${location}: invalid number provider`);
    switch (provider.type) {
      case "minecraft:storage":
        return;
      case "minecraft:sum":
      case "minecraft:product":
      case "minecraft:maximum":
      case "minecraft:minimum":
        assert.ok(Array.isArray(provider.operands), `${relativeSource(source)}${location}: operands must be an array`);
        provider.operands.forEach((operand, index) => walkProvider(operand, source, `${location}.operands[${index}]`));
        return;
      case "minecraft:number_dispatcher":
        assert.ok(Array.isArray(provider.cases), `${relativeSource(source)}${location}: cases must be an array`);
        provider.cases.forEach((entry, index) => {
          walkPredicate(entry.condition, source, `${location}.cases[${index}].condition`);
          walkProvider(entry.number_provider, source, `${location}.cases[${index}].number_provider`);
        });
        walkProvider(provider.default, source, `${location}.default`);
        return;
      case "minecraft:conditional":
        walkPredicate(provider.condition, source, `${location}.condition`);
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
      case "minecraft:value_check":
        walkProvider(predicate.value, source, `${location}.value`);
        if (Object.hasOwn(predicate.range, "min")) walkProvider(predicate.range.min, source, `${location}.range.min`);
        if (Object.hasOwn(predicate.range, "max")) walkProvider(predicate.range.max, source, `${location}.range.max`);
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
      visitFiles(path.join(namespaceRoot, "number_provider"), ".json", (file) => {
        walkProvider(JSON.parse(fs.readFileSync(file, "utf8")), file, "");
      });
      visitFiles(path.join(namespaceRoot, "predicate"), ".json", (file) => {
        walkPredicate(JSON.parse(fs.readFileSync(file, "utf8")), file, "");
      });
      visitFiles(path.join(namespaceRoot, "function"), ".mcfunction", (file) => {
        const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
        lines.forEach((rawLine, index) => {
          const line = rawLine.trim();
          if (!line || line.startsWith("#")) return;
          const location = `:${index + 1}`;
          for (const match of line.matchAll(/\bfunction\s+(#?[a-z0-9_.-]+:[a-z0-9_./-]+)(?=\s|$)/g)) {
            checkReference("function", match[1], file, location);
          }
          for (const match of line.matchAll(/\b(?:if|unless)\s+predicate\s+(#?[a-z0-9_.-]+:[a-z0-9_./-]+)(?=\s|$)/g)) {
            checkReference("predicate", match[1], file, location);
          }
          for (const match of line.matchAll(/\bcompute\s+default\s+([a-z0-9_.-]+:[a-z0-9_./-]+)(?=\s|$)/g)) {
            checkReference("number_provider", match[1], file, location);
          }
        });
      });
    }
  }
  return issues.sort();
}

test("pack graph validator detects controlled dangling registry references", () => {
  const packRoot = fs.mkdtempSync(path.join(os.tmpdir(), "math-pack-graph-"));
  try {
    const write = (relative, value) => {
      const file = path.join(packRoot, relative);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`);
    };
    write("data/math/number_provider/fixture/root.json", {
      type: "minecraft:sum",
      operands: ["math:missing/provider", 1],
    });
    write("data/math/predicate/fixture/root.json", {
      type: "minecraft:all_of",
      terms: ["math:missing/predicate"],
    });
    write("data/math/number_provider/fixture/conditional.json", {
      type: "minecraft:conditional",
      condition: {
        type: "minecraft:value_check",
        value: 0,
        range: { min: "math:missing/range_bound" },
      },
      on_true: "math:missing/on_true",
      on_false: 0,
    });
    write("data/math/function/fixture/root.mcfunction", [
      "function math:missing/function",
      "execute run compute default math:missing/computed",
      "return run function math:missing/returned_function",
      "execute if score #x fixture matches 1 run function math:missing/executed_function",
      "",
    ].join("\n"));

    assert.deepEqual(validatePackGraph(packRoot), [
      "data/math/function/fixture/root.mcfunction:1: dangling function math:missing/function",
      "data/math/function/fixture/root.mcfunction:2: dangling number_provider math:missing/computed",
      "data/math/function/fixture/root.mcfunction:3: dangling function math:missing/returned_function",
      "data/math/function/fixture/root.mcfunction:4: dangling function math:missing/executed_function",
      "data/math/number_provider/fixture/conditional.json:condition.range.min: dangling number_provider math:missing/range_bound",
      "data/math/number_provider/fixture/conditional.json:on_true: dangling number_provider math:missing/on_true",
      "data/math/number_provider/fixture/root.json:operands[0]: dangling number_provider math:missing/provider",
      "data/math/predicate/fixture/root.json:terms[0]: dangling predicate math:missing/predicate",
    ]);
  } finally {
    fs.rmSync(packRoot, { recursive: true, force: true });
  }
});

test("all pack registry references resolve", () => {
  assert.deepEqual(validatePackGraph("Math"), []);
});

test("pack targets data pack format 118", () => {
  const meta = JSON.parse(fs.readFileSync("Math/pack.mcmeta", "utf8"));
  assert.equal(meta.pack.min_format, 118);
  assert.equal(meta.pack.max_format, 118);
});

test("release pack excludes prototype debug functions", () => {
  const debugRoot = "Math/data/math/function/debug";
  const debugFunctions = fs.existsSync(debugRoot)
    ? fs.readdirSync(debugRoot, { recursive: true }).filter((name) => name.endsWith(".mcfunction"))
    : [];
  assert.deepEqual(debugFunctions, []);
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
        const staged = value.storage === "math:internal" && value.path.startsWith("w_comparison.");
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
      const staged = value.storage === "math:internal" && value.path.startsWith("w_comparison.");
      const normalizedInteger = value.storage === "math:internal"
        && ["x", "w"].includes(value.path)
        && file.includes(`${path.sep}comparison${path.sep}`);
      assert.ok(staged || normalizedInteger, `${file} condition source is not proven integer-valued`);
    }
  }
});

test("generated functions and conditions use only declared storage with x/y/z/w-prefixed scratch", () => {
  const allowedStorage = new Set(["math:", "math:internal"]);
  const assertStorage = (storageId, storagePath, file) => {
    assert.ok(allowedStorage.has(storageId), `${file} uses undeclared storage ${storageId}`);
    if (storageId === "math:internal") {
      const normalizedPath = storagePath.startsWith("{") ? storagePath.slice(1) : storagePath;
      assert.match(normalizedPath, /^[xyzw](?:_|$|\.|:)/, `${file} scratch path ${storagePath} must be x/y/z/w-prefixed`);
    }
  };
  const visit = (value, file) => {
    if (!value || typeof value !== "object") return;
    if (value.type === "minecraft:storage") assertStorage(value.storage, value.path, file);
    for (const child of Array.isArray(value) ? value : Object.values(value)) visit(child, file);
  };

  for (const root of ["Math/data/math/number_provider", "Math/data/math/predicate"]) {
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
