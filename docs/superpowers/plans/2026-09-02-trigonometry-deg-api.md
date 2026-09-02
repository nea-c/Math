# Trigonometry `*_deg` API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove redundant public sine/cosine control flow and rename every degree-based trigonometry function from `*_degrees` to `*_deg`.

**Architecture:** Keep shared sine/cosine kernels for composite internal consumers, but generate public sine and cosine entries as direct native provider expressions over `storage math: a`. Treat the degree suffix change as a breaking generated API migration spanning the layout, generator, generated pack, tests, documentation, and official integration harness.

**Tech Stack:** Node.js ES modules, `node:test`, generated Minecraft datapack JSON/mcfunction resources, PowerShell official-server harness.

**Spec:** `docs/superpowers/specs/2026-09-02-trigonometry-deg-api-design.md`

## Global Constraints

- Rename all seven degree APIs to `sin_deg`, `cos_deg`, `tan_deg`, `asin_deg`, `acos_deg`, `atan_deg`, and `atan2_deg`.
- Do not retain forwarding functions, tags, aliases, generated paths, or documentation for `*_degrees`.
- Public `sin`, `cos`, `sin_deg`, and `cos_deg` must evaluate native providers directly from public storage without scratch staging, zero branches, shared-kernel calls, or secondary compute functions.
- Retain `.common/sin` and `.common/cos` for tangent and other composite internal consumers.
- Preserve public storage inputs, the `ans` output, numerical tolerances, signed-zero behavior, and vanilla invalid-value semantics.
- Follow strict RED → GREEN → REFACTOR: every production change must be preceded by a focused test that fails for the intended missing behavior.
- Preserve unrelated worktree changes and stage only task-owned paths in each commit.

---

### Task 1: Rename the complete degree-based trigonometry API

**Files:**
- Modify: `tests/function-layout.test.mjs`
- Modify: `tests/static.test.mjs`
- Modify: `tests/atan.test.mjs`
- Modify: `tests/inverse-trigonometry.test.mjs`
- Modify: `tests/transcendental.test.mjs`
- Modify: `tests/runtime-cost.test.mjs`
- Modify: `tools/function-layout.mjs`
- Modify: `tools/generate-math-providers.mjs`
- Modify: `tools/integration-test.ps1`
- Modify: `README.md`
- Regenerate: `Math/data/math/function/{sin_deg,cos_deg,tan_deg,asin_deg,acos_deg,atan_deg,atan2_deg}/**`
- Regenerate: `Math/data/math/tags/function/{sin_deg,cos_deg,tan_deg,asin_deg,acos_deg,atan_deg,atan2_deg}.json`
- Delete through regeneration: corresponding `*_degrees` function directories and tags
- Modify: `tools/generated-math-files.json`

**Interfaces:**
- Consumes: `PUBLIC_FUNCTION_NAMES`, `PUBLIC_FUNCTION_PATHS`, `FUNCTION_PATHS`, `publicTag(name)`, and generator emitters.
- Produces: seven public `*_deg/0.start` implementations and seven `#math:*_deg` tags; internal owned paths `atan2DegCompute`, `sineDegCompute`, `cosineDegCompute`, and `tangentDegCompute` while their secondary compute functions remain.

- [ ] **Step 1: Write failing layout and retired-name tests**

In `tests/function-layout.test.mjs`, replace the old degree assertions with exact new paths and explicitly reject old names:

```js
for (const name of ["sin_deg", "cos_deg", "tan_deg", "asin_deg", "acos_deg", "atan_deg", "atan2_deg"]) {
  assert.equal(PUBLIC_FUNCTION_PATHS[name], `${name}/0.start`);
}
for (const name of ["sin_degrees", "cos_degrees", "tan_degrees", "asin_degrees", "acos_degrees", "atan_degrees", "atan2_degrees"]) {
  assert.equal(Object.hasOwn(PUBLIC_FUNCTION_PATHS, name), false);
  assert.throws(() => publicTag(name), /Unknown public function/);
}
```

Also assert the remaining degree compute paths use `Deg` naming:

```js
assert.equal(FUNCTION_PATHS.atan2DegCompute, "atan2_deg/1.compute");
assert.equal(FUNCTION_PATHS.sineDegCompute, "sin_deg/1.compute");
assert.equal(FUNCTION_PATHS.cosineDegCompute, "cos_deg/1.compute");
assert.equal(FUNCTION_PATHS.tangentDegCompute, "tan_deg/1.compute");
for (const retired of ["atan2DegreesCompute", "sineDegreesCompute", "cosineDegreesCompute", "tangentDegreesCompute"]) {
  assert.equal(Object.hasOwn(FUNCTION_PATHS, retired), false);
}
```

In `tests/static.test.mjs`, add a repository-facing assertion over functional and documentation locations:

```js
test("retired degrees API names are absent", () => {
  const roots = ["README.md", "tools", "tests", "Math/data/math/function", "Math/data/math/tags/function"];
  const retired = ["sin_degrees", "cos_degrees", "tan_degrees", "asin_degrees", "acos_degrees", "atan_degrees", "atan2_degrees"];
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
```

Exclude historical design/plan documents from this assertion. The mutation caught is leaving any callable, generated, tested, or documented compatibility surface under the old suffix.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```powershell
node --test tests/function-layout.test.mjs tests/static.test.mjs
```

Expected: FAIL because only `*_degrees` paths exist and `*_deg` paths are absent.

- [ ] **Step 3: Rename layout and generator identifiers**

In `tools/function-layout.mjs`, replace all seven public names and rename every owned degree compute path that still represents a real file:

```js
atan2DegCompute: "atan2_deg/1.compute",
sineDegCompute: "sin_deg/1.compute",
cosineDegCompute: "cos_deg/1.compute",
tangentDegCompute: "tan_deg/1.compute",
```

Retain `sineCompute` and `cosineCompute` temporarily. Replace `sineDegreesCompute` and `cosineDegreesCompute` with `sineDegCompute` and `cosineDegCompute`; Task 2 removes all four sine/cosine compute paths after direct generation is covered by a failing test.

In `tools/generate-math-providers.mjs`, rename the inverse and tangent calls exactly:

```js
emitDirectPublicFunction("asin_deg", inverseTrigonometryPublicLines(FUNCTION_PATHS.asin, true));
emitDirectPublicFunction("acos_deg", inverseTrigonometryPublicLines(FUNCTION_PATHS.acos, true));
emitDirectPublicFunction("atan_deg", atanPublicLines(true));
emitControlledPublicFunction("atan2_deg", FUNCTION_PATHS.atan2DegCompute, atan2PublicLines(true));
```

The tangent generator must emit `tan` with `FUNCTION_PATHS.tangentCompute` and `tan_deg` with `FUNCTION_PATHS.tangentDegCompute`. Do not create an old-name alias.

Until Task 2 simplifies sine and cosine, the same loop must emit `sin_deg` through `FUNCTION_PATHS.sineDegCompute` and `cos_deg` through `FUNCTION_PATHS.cosineDegCompute`.

- [ ] **Step 4: Rename all behavioral, cost, documentation, and integration references**

Perform exact identifier replacements in:

```text
sin_degrees   -> sin_deg
cos_degrees   -> cos_deg
tan_degrees   -> tan_deg
asin_degrees  -> asin_deg
acos_degrees  -> acos_deg
atan_degrees  -> atan_deg
atan2_degrees -> atan2_deg
```

Apply them to `tests/atan.test.mjs`, `tests/inverse-trigonometry.test.mjs`, `tests/transcendental.test.mjs`, `tests/runtime-cost.test.mjs`, `tools/integration-test.ps1`, and `README.md`. Rename integration case labels as well as their `-Function` values so test output contains no retired identifier. Do not alter tolerances or expected numerical values in this step.

- [ ] **Step 5: Regenerate and verify the renamed API**

Run:

```powershell
node tools/generate-math-providers.mjs
node --test tests/function-layout.test.mjs tests/static.test.mjs tests/atan.test.mjs tests/inverse-trigonometry.test.mjs
node tools/generate-math-providers.mjs --check
```

Expected: all focused tests PASS; the manifest lists only `*_deg` paths; old generated directories and tags are deleted.

- [ ] **Step 6: Commit Task 1**

Stage the listed source, test, documentation, harness, manifest, and generated `*_deg`/`*_degrees` paths explicitly, then commit:

```powershell
git add -- README.md tools/function-layout.mjs tools/generate-math-providers.mjs tools/integration-test.ps1 tools/generated-math-files.json tests/function-layout.test.mjs tests/static.test.mjs tests/atan.test.mjs tests/inverse-trigonometry.test.mjs tests/transcendental.test.mjs tests/runtime-cost.test.mjs
git add -A -- Math/data/math/function/sin_deg Math/data/math/function/cos_deg Math/data/math/function/tan_deg Math/data/math/function/asin_deg Math/data/math/function/acos_deg Math/data/math/function/atan_deg Math/data/math/function/atan2_deg Math/data/math/function/sin_degrees Math/data/math/function/cos_degrees Math/data/math/function/tan_degrees Math/data/math/function/asin_degrees Math/data/math/function/acos_degrees Math/data/math/function/atan_degrees Math/data/math/function/atan2_degrees
git add -A -- Math/data/math/tags/function/sin_deg.json Math/data/math/tags/function/cos_deg.json Math/data/math/tags/function/tan_deg.json Math/data/math/tags/function/asin_deg.json Math/data/math/tags/function/acos_deg.json Math/data/math/tags/function/atan_deg.json Math/data/math/tags/function/atan2_deg.json Math/data/math/tags/function/sin_degrees.json Math/data/math/tags/function/cos_degrees.json Math/data/math/tags/function/tan_degrees.json Math/data/math/tags/function/asin_degrees.json Math/data/math/tags/function/acos_degrees.json Math/data/math/tags/function/atan_degrees.json Math/data/math/tags/function/atan2_degrees.json
git commit -m "Rename degree trigonometry APIs"
```

---

### Task 2: Generate public sine and cosine as direct providers

**Files:**
- Modify: `tests/static.test.mjs`
- Modify: `tests/transcendental.test.mjs`
- Modify: `tests/runtime-cost.test.mjs`
- Modify: `tools/generate-math-providers.mjs`
- Regenerate: `Math/data/math/function/{sin,cos,sin_deg,cos_deg}/0.start.mcfunction`
- Delete through regeneration: `Math/data/math/function/{sin,cos,sin_deg,cos_deg}/1.compute.mcfunction`
- Modify: `tools/generated-math-files.json`

**Interfaces:**
- Consumes: `computeInline(target, provider)`, `emitDirectPublicFunction(name, lines)`, `sine(provider)`, `cosine(provider)`, `product(...providers)`, and `publicA`.
- Produces: four direct public entry functions; radians-per-degree is the float constant `Math.fround(Math.PI / 180)` nested in the degree provider expression.

- [ ] **Step 1: Add failing direct-wrapper structure tests**

In `tests/static.test.mjs`, add a test that loads the four public entry files and validates the generated structure:

```js
test("public sine and cosine wrappers use direct native providers", () => {
  for (const name of ["sin", "cos", "sin_deg", "cos_deg"]) {
    const source = fs.readFileSync(`Math/data/math/function/${name}/0.start.mcfunction`, "utf8");
    assert.doesNotMatch(source, /data modify storage math: internal\.[^ ]+ set /);
    assert.doesNotMatch(source, /^function /m);
    assert.equal(fs.existsSync(`Math/data/math/function/${name}/1.compute.mcfunction`), false);
  }
  assert.match(fs.readFileSync("Math/data/math/function/sin/0.start.mcfunction", "utf8"), /"type":"minecraft:sine"/);
  assert.match(fs.readFileSync("Math/data/math/function/cos/0.start.mcfunction", "utf8"), /"type":"minecraft:cosine"/);
  assert.match(fs.readFileSync("Math/data/math/function/sin_deg/0.start.mcfunction", "utf8"), /"type":"minecraft:mul"/);
  assert.match(fs.readFileSync("Math/data/math/function/cos_deg/0.start.mcfunction", "utf8"), /"type":"minecraft:mul"/);
});
```

Strengthen it by parsing the inline provider JSON from each `set compute default float` command and asserting the radian wrappers have a direct `minecraft:storage` input `{ storage: "math:", path: "a" }`, while degree wrappers contain that same storage leaf exactly once beneath a multiply by `Math.fround(Math.PI / 180)`.

- [ ] **Step 2: Run the focused structure test and verify RED**

Run:

```powershell
node --test --test-name-pattern="public sine and cosine wrappers" tests/static.test.mjs
```

Expected: FAIL because each wrapper still stages `internal.x`, calls a secondary compute function and shared kernel, and performs zero-branch control flow.

- [ ] **Step 3: Replace the generic trigonometric wrapper with direct sine/cosine generation**

In `tools/generate-math-providers.mjs`, emit direct entries:

```js
const radiansPerDegree = Math.fround(Math.PI / 180);

emitDirectPublicFunction("sin", [computeInline("ans", sine(publicA))]);
emitDirectPublicFunction("cos", [computeInline("ans", cosine(publicA))]);
emitDirectPublicFunction("sin_deg", [computeInline("ans", sine(product(publicA, radiansPerDegree)))]);
emitDirectPublicFunction("cos_deg", [computeInline("ans", cosine(product(publicA, radiansPerDegree)))]);
```

At the same time, remove `sineCompute`, `cosineCompute`, `sineDegCompute`, and `cosineDegCompute` from `FUNCTION_PATHS` because these four secondary files no longer exist.

Replace `trigWrapper` with a tangent-only helper:

```js
function tangentWrapper(name, computePath, degrees) {
  const lines = ["data modify storage math:internal x set from storage math: a"];
  if (degrees) lines.push("data modify storage math:internal x set compute default math:.common/rad");
  lines.push("execute if data storage math:internal {x:0.0f} run return run data modify storage math: ans set compute default float math:.common/input/x");
  lines.push(`function ${functionId(FUNCTION_PATHS.tan)}`);
  lines.push(...tangentResultLines());
  emitControlledPublicFunction(name, computePath, lines);
}
```

Call it for `tan` and `tan_deg`. Retain the `.common/sin`, `.common/cos`, and `.common/tan` emissions unchanged.

- [ ] **Step 4: Regenerate and verify numerical behavior**

Run:

```powershell
node tools/generate-math-providers.mjs
node --test --test-name-pattern="native sine and cosine|radian sine and cosine|degree sine and cosine|huge finite|public sine and cosine wrappers" tests/transcendental.test.mjs tests/static.test.mjs
```

Expected: structure and numerical tests PASS, including positive/negative zero and representative radian/degree samples. If the direct provider changes a numerical expectation outside the approved tolerances, stop and diagnose instead of widening the tolerance.

- [ ] **Step 5: Lock the reduced runtime cost**

In `tests/runtime-cost.test.mjs`, add an exact regression test for the four direct wrappers:

```js
test("public sine and cosine wrappers execute only their direct entry commands", () => {
  for (const name of ["sin", "cos", "sin_deg", "cos_deg"]) {
    assert.equal(runFunction(name, { a: 30 }).commandsExecuted, 3, name);
  }
});
```

The three commands are stale-`ans` removal, the direct native computation, and shared public scratch cleanup. Run:

```powershell
node --test tests/runtime-cost.test.mjs
```

Expected: PASS with exactly three commands for each direct wrapper. Retain tangent and inverse-trigonometry budgets except for identifier renames.

Then rerun:

```powershell
node --test tests/runtime-cost.test.mjs tests/transcendental.test.mjs tests/static.test.mjs
node tools/generate-math-providers.mjs --check
git diff --check
```

Expected: all focused tests PASS, generator check exits 0, and diff check has no output.

- [ ] **Step 6: Commit Task 2**

Stage only the generator, three test files, manifest, and four affected generated function directories, then commit:

```powershell
git add -- tools/function-layout.mjs tools/generate-math-providers.mjs tools/generated-math-files.json tests/static.test.mjs tests/transcendental.test.mjs tests/runtime-cost.test.mjs
git add -A -- Math/data/math/function/sin Math/data/math/function/cos Math/data/math/function/sin_deg Math/data/math/function/cos_deg
git commit -m "Inline public sine and cosine providers"
```

---

### Task 3: Verify the breaking migration and generated pack

**Files:**
- Verify: all files changed by Tasks 1–2
- Modify only when a failing regression test identifies a defect

**Interfaces:**
- Consumes: the generator, generated manifest, datapack graph, renamed test harness, and acceptance criteria from the design spec.
- Produces: synchronized generated resources and evidence that no retired API or redundant public sine/cosine flow remains.

- [ ] **Step 1: Audit names and generated structure**

Run:

```powershell
rg -n "(sin|cos|tan|asin|acos|atan|atan2)_degrees\b" README.md tools tests Math/data/math/function Math/data/math/tags/function
node tools/generate-math-providers.mjs --check
node --test tests/function-layout.test.mjs tests/static.test.mjs
```

Expected: `rg` exits 1 with no matches; generator check exits 0; both test files PASS.

- [ ] **Step 2: Run the complete offline suite**

Run:

```powershell
node --test
```

Expected: all tests PASS with zero failures. Record the exact test/pass counts.

- [ ] **Step 3: Run official Minecraft integration**

Use an official compatible server jar in a unique OS temporary directory:

```powershell
$verifyDir = Join-Path ([System.IO.Path]::GetTempPath()) ("math-trig-deg-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $verifyDir | Out-Null
$serverJar = Join-Path $verifyDir "server.jar"
try {
  Invoke-WebRequest -Uri "https://piston-data.mojang.com/v1/objects/1e6e3a06cc13cf6975a0921b272ab544798d4b06/server.jar" -OutFile $serverJar
  pwsh -NoProfile -File tools/integration-test.ps1 -MinecraftServerJar $serverJar
  if ($LASTEXITCODE -ne 0) { throw "Official integration failed with exit code $LASTEXITCODE" }
} finally {
  $resolvedVerifyDir = [System.IO.Path]::GetFullPath($verifyDir)
  $tempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
  if (-not $resolvedVerifyDir.StartsWith($tempRoot, [System.StringComparison]::OrdinalIgnoreCase) -or $resolvedVerifyDir -eq $tempRoot) {
    throw "Refusing cleanup outside OS temp: $resolvedVerifyDir"
  }
  Remove-Item -LiteralPath $resolvedVerifyDir -Recurse -Force
}
```

Expected: exit 0 and a `MATH_TEST_PASS:` marker. Do not store the server jar in the repository.

- [ ] **Step 4: Inspect the final diff and commit any verification fix**

Run:

```powershell
git diff --check
git status --short
git diff -- tools/function-layout.mjs tools/generate-math-providers.mjs tests README.md tools/integration-test.ps1 tools/generated-math-files.json Math/data/math/function Math/data/math/tags/function
```

Confirm that no old alias remains, all removed secondary sine/cosine paths disappeared from the manifest, shared internal kernels remain, and no tolerance was weakened. If verification required a correction, add a failing regression test first and commit the scoped fix separately; otherwise no extra implementation commit is required.
