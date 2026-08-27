# Function Layout Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `#math:<name>` the only public function API and reorganize every generated mcfunction into a shallow, numbered operation folder with reusable kernels under `.common`.

**Architecture:** A small layout module is the single source of truth for public names and implementation resource paths. The generator emits public wrappers at `<name>/0.start`, emits one function tag per public name, and emits helpers either beside their owner or under `.common/<module>/`; the offline harness resolves the public tag before executing an implementation. Static and Snapshot 10 tests enforce the layout without changing storage, numeric, or error behavior.

**Tech Stack:** Minecraft Java Edition 26.3 Snapshot 10 data pack format 118, mcfunction, function tags, JavaScript ES modules, Node.js built-in test runner, PowerShell integration harness, Java 25.

**Spec:** `docs/superpowers/specs/2026-08-27-function-layout-design.md`

## Global Constraints

- The public API is exactly the existing 34 tags named `#math:<name>`.
- A public tag contains exactly one value, `math:<name>/0.start`.
- Public implementation files live directly in `data/math/function/<name>/`; no deeper public subdirectory is allowed.
- Reusable implementation files live directly in `data/math/function/.common/<module>/`; no directory below a module is allowed.
- Every function filename matches `<number>.<snake_case_role>.mcfunction`; every function directory starts with `0.start.mcfunction`.
- `data/math/function/internal/`, `data/math/function/common/`, and root-level `.mcfunction` files must not exist.
- No compatibility alias for `function math:<name>` is retained.
- Data pack function code may call implementation IDs directly, but public examples and integration entry points use tags.
- Storage fields, results, error IDs, algorithms, precision guarantees, number-provider paths, and predicate paths remain unchanged.
- Generated files are changed only through `tools/generate-math-providers.mjs` and its manifest.
- No third-party Node.js dependencies are introduced.

## File Structure

- Create `tools/function-layout.mjs`: authoritative public name list, named implementation paths, and validation helpers.
- Create `tests/function-layout.test.mjs`: unit tests for the public list, helper-table size, representative exact paths, and tag generation.
- Modify `tools/generate-math-providers.mjs`: consume the layout module, emit moved functions and public tags, and update every generated function reference.
- Modify `tools/generated-math-files.json`: regenerated manifest containing the new function and tag paths and no old function paths.
- Modify `tests/mcfunction-test-harness.mjs`: load `tags/function`, resolve public names through tags, and execute implementation IDs.
- Modify `tests/arithmetic.test.mjs`: replace the two old `runInternalFunction` names with exact reusable implementation paths.
- Modify `tests/static.test.mjs`: enforce tag targets, depth, numbering, forbidden directories, and tag graph resolution.
- Modify `tools/integration-test.ps1`: retain tag-only public invocations and add an assertion that direct root public IDs are absent from generated commands.
- Modify `README.md`: remove direct-call compatibility text and document tags as the only supported entry points.
- Regenerate `Math/data/math/function/**` and `Math/data/math/tags/function/**`: new implementation tree and tags.

## Required Function Path Table

Public names map mechanically to `<name>/0.start`:

```js
export const PUBLIC_FUNCTION_NAMES = Object.freeze([
  "absolute", "add", "ceil", "clamp", "cos", "cos_degrees", "cube",
  "deg", "divide", "e", "exp", "floor", "lerp", "log", "maximum",
  "minimum", "modulo", "multiply", "pi", "power", "rad", "reciprocal",
  "remainder", "round", "sign", "sin", "sin_degrees", "square",
  "square_root", "subtract", "tan", "tan_degrees", "tau", "truncate",
]);
```

Helper symbols map exactly as follows:

```js
export const FUNCTION_PATHS = Object.freeze({
  invalidNumber: ".common/invalid_number/0.start",
  resultOutOfRange: ".common/result_out_of_range/0.start",
  floor: ".common/floor/0.start",
  truncate: ".common/truncate/0.start",
  reciprocal: ".common/reciprocal/0.start",
  reciprocalScaleUp: ".common/reciprocal/1.scale_up",
  reciprocalFinishAtScaleLimit: ".common/reciprocal/2.finish_at_scale_limit",
  reciprocalScaleDown: ".common/reciprocal/3.scale_down",
  reciprocalFinish: ".common/reciprocal/4.finish",
  reduceRemainder: ".common/reduce_remainder/0.start",
  normalizePeriod: ".common/normalize_period/0.start",
  normalizePeriodNegative: ".common/normalize_period/1.negative",
  sin: ".common/sin/0.start",
  sinEvaluate: ".common/sin/1.evaluate",
  cos: ".common/cos/0.start",
  tan: ".common/tan/0.start",
  log: ".common/log/0.start",
  logPrepare: ".common/log/1.prepare",
  logNormalize: ".common/log/2.normalize",
  logNormalizeScaleUp: ".common/log/3.normalize_scale_up",
  logNormalizeScaleDown: ".common/log/4.normalize_scale_down",
  exp: ".common/exp/0.start",
  divideNormalize: "divide/1.normalize",
  divideNormalizeScaleUp: "divide/2.normalize_scale_up",
  divideNormalizeScaleDown: "divide/3.normalize_scale_down",
  divideUnderflow: "divide/4.underflow",
  moduloNegativeB: "modulo/1.negative_b",
  squareRootNormalize: "square_root/1.normalize",
  squareRootNormalizeScaleUp: "square_root/2.normalize_scale_up",
  squareRootNormalizeScaleDown: "square_root/3.normalize_scale_down",
  powerZero: "power/1.zero",
  powerNegative: "power/2.negative",
  powerPositive: "power/3.positive",
  powerNegativeOdd: "power/4.negative_odd",
  powerNonfinitePositive: "power/5.nonfinite_positive",
  powerNonfiniteNegative: "power/6.nonfinite_negative",
  powerBoundaryPositive: "power/7.boundary_positive",
  powerBoundaryNegative: "power/8.boundary_negative",
  powerClassifyOverflow: "power/9.classify_overflow",
});
```

---

### Task 1: Create the Function Layout Source of Truth

**Files:**
- Create: `tools/function-layout.mjs`
- Create: `tests/function-layout.test.mjs`

**Interfaces:**
- Consumes: no repository-specific module.
- Produces: `PUBLIC_FUNCTION_NAMES: readonly string[]`, `PUBLIC_FUNCTION_PATHS: Readonly<Record<string,string>>`, `FUNCTION_PATHS: Readonly<Record<string,string>>`, `functionId(path: string): string`, and `publicTag(name: string): { values: string[] }`.

- [ ] **Step 1: Write the failing layout-module test**

Create `tests/function-layout.test.mjs` with literal expectations that do not reuse the implementation's path builder:

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  FUNCTION_PATHS,
  PUBLIC_FUNCTION_NAMES,
  PUBLIC_FUNCTION_PATHS,
  functionId,
  publicTag,
} from "../tools/function-layout.mjs";

test("function layout defines the complete public API", () => {
  assert.equal(PUBLIC_FUNCTION_NAMES.length, 34);
  assert.equal(PUBLIC_FUNCTION_PATHS.add, "add/0.start");
  assert.equal(PUBLIC_FUNCTION_PATHS.divide, "divide/0.start");
  assert.equal(PUBLIC_FUNCTION_PATHS.tan_degrees, "tan_degrees/0.start");
  assert.deepEqual(publicTag("divide"), { values: ["math:divide/0.start"] });
});

test("function layout assigns representative owned and common helpers", () => {
  assert.equal(Object.keys(FUNCTION_PATHS).length, 39);
  assert.equal(FUNCTION_PATHS.divideNormalize, "divide/1.normalize");
  assert.equal(FUNCTION_PATHS.powerClassifyOverflow, "power/9.classify_overflow");
  assert.equal(FUNCTION_PATHS.reciprocal, ".common/reciprocal/0.start");
  assert.equal(FUNCTION_PATHS.logNormalizeScaleDown, ".common/log/4.normalize_scale_down");
  assert.equal(functionId(FUNCTION_PATHS.sinEvaluate), "math:.common/sin/1.evaluate");
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
node --test tests/function-layout.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `tools/function-layout.mjs`.

- [ ] **Step 3: Implement the layout module**

Create the two exported tables with the exact values in “Required Function Path Table,” then add:

```js
export const PUBLIC_FUNCTION_PATHS = Object.freeze(Object.fromEntries(
  PUBLIC_FUNCTION_NAMES.map((name) => [name, `${name}/0.start`]),
));

export function functionId(path) {
  return `math:${path}`;
}

export function publicTag(name) {
  const implementationPath = PUBLIC_FUNCTION_PATHS[name];
  if (!implementationPath) throw new Error(`Unknown public function: ${name}`);
  return { values: [functionId(implementationPath)] };
}
```

- [ ] **Step 4: Run the focused and full tests**

Run:

```powershell
node --test tests/function-layout.test.mjs
node --test
```

Expected: the focused test passes and the full suite reports 83 tests, 0 failures.

- [ ] **Step 5: Commit the layout module**

```powershell
git add tools/function-layout.mjs tests/function-layout.test.mjs
git commit -m "refactor: define function layout paths"
```

### Task 2: Make the Offline Harness Execute Public Tags

**Files:**
- Modify: `tests/mcfunction-test-harness.mjs`
- Modify: `tests/functions.test.mjs`

**Interfaces:**
- Consumes: function tags stored below `Math/data/math/tags/function`.
- Produces: `resolvePublicFunctionTag(tag, name): string`, `runFunction(name, publicInput)` resolving `math:<name>` through its tag, plus `runImplementation(path, publicInput, internalInput)` for exact implementation-level tests.

- [ ] **Step 1: Add a failing test for strict one-value tag resolution**

In `tests/functions.test.mjs`, import `resolvePublicFunctionTag` and add a test using literal tag fixtures:

```js
test("public function tags resolve exactly one implementation", () => {
  assert.equal(resolvePublicFunctionTag({ values: ["math:add"] }, "add"), "add");
  assert.throws(
    () => resolvePublicFunctionTag({ values: [] }, "add"),
    /Public function tag must contain exactly one function: math:add/,
  );
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
node --test --test-name-pattern="public function tags resolve" tests/functions.test.mjs
```

Expected: FAIL because `resolvePublicFunctionTag` is not exported.

- [ ] **Step 3: Load tags and resolve public execution**

In `tests/mcfunction-test-harness.mjs`, add:

```js
const functionTagRoot = path.resolve("Math/data/math/tags/function");
const functionTags = jsonRegistry(functionTagRoot, "math:");

export function resolvePublicFunctionTag(tag, name) {
  if (!tag || !Array.isArray(tag.values) || tag.values.length !== 1 || typeof tag.values[0] !== "string") {
    throw new Error(`Public function tag must contain exactly one function: math:${name}`);
  }
  return functionPath(tag.values[0]);
}

function publicImplementationPath(name) {
  return resolvePublicFunctionTag(functionTags.get(`math:${name}`), name);
}
```

Replace the exports at the bottom with:

```js
export function runFunction(name, publicInput) {
  return runWithStorage(publicImplementationPath(name), publicInput, {});
}

export function runImplementation(path, publicInput = {}, internalInput = {}) {
  return runWithStorage(path, publicInput, internalInput);
}
```

Keep `runInternalFunction` temporarily so the two existing arithmetic tests remain green until Task 3 moves their targets.

- [ ] **Step 4: Run the focused and full tests**

Run:

```powershell
node --test --test-name-pattern="public function tags resolve" tests/functions.test.mjs
node --test
```

Expected: the new test passes and the full suite reports 84 tests, 0 failures.

- [ ] **Step 5: Commit tag-aware offline execution**

```powershell
git add tests/mcfunction-test-harness.mjs tests/functions.test.mjs
git commit -m "test: execute public functions through tags"
```

### Task 3: Regenerate the Function Tree in the New Layout

**Files:**
- Modify: `tools/generate-math-providers.mjs`
- Modify: `tools/generated-math-files.json`
- Modify: `tests/static.test.mjs`
- Modify: `tests/arithmetic.test.mjs`
- Modify: `tests/mcfunction-test-harness.mjs`
- Regenerate: `Math/data/math/function/**`
- Regenerate: `Math/data/math/tags/function/**`

**Interfaces:**
- Consumes: every export from `tools/function-layout.mjs` and `runImplementation(path, publicInput, internalInput)` from the harness.
- Produces: the exact directory and function-ID layout required by the spec, with no root or `internal` mcfunctions.

- [ ] **Step 1: Change the static contract first**

Replace the current tag test in `tests/static.test.mjs` with assertions that:

```js
assert.deepEqual(tag, { values: [`math:${name}/0.start`] }, name);
assert.equal(fs.existsSync(path.join(functionRoot, "internal")), false);
assert.equal(fs.existsSync(path.join(functionRoot, "common")), false);
assert.deepEqual(
  fs.readdirSync(functionRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".mcfunction")),
  [],
);
```

Walk all public directories and `.common/<module>` directories. Assert that no function directory exceeds the permitted depth, each leaf directory contains `0.start.mcfunction`, every file matches `/^\d+\.[a-z0-9_]+\.mcfunction$/`, and numeric prefixes do not repeat within a directory.

Extend `validatePackGraph` so JSON files under `data/<namespace>/tags/function` register tag IDs and every string in `values` must resolve to an existing function. Report a dangling value in this exact form:

```text
data/math/tags/function/fixture.json:values[0]: dangling function math:missing/entry
```

- [ ] **Step 2: Run static tests and verify RED**

Run:

```powershell
node --test --test-name-pattern="function tags|function layout|pack graph" tests/static.test.mjs
```

Expected: FAIL because tags still target `math:<name>` and root-level mcfunctions still exist.

- [ ] **Step 3: Add generator primitives for public functions and tags**

Import the layout module:

```js
import {
  FUNCTION_PATHS,
  PUBLIC_FUNCTION_PATHS,
  functionId,
  publicTag,
} from "./function-layout.mjs";
```

Keep `emitFunction(path, lines)` responsible only for an implementation path. Add:

```js
function emitFunctionTag(name, value) {
  generatedFiles.push({
    kind: "json",
    relativePath: `Math/data/math/tags/function/${name}.json`,
    value,
  });
}

function emitPublicFunction(name, lines) {
  emitFunction(PUBLIC_FUNCTION_PATHS[name], lines);
  emitFunctionTag(name, publicTag(name));
}
```

Change all 34 public `emitFunction(name, lines)` calls to `emitPublicFunction(name, lines)`.

- [ ] **Step 4: Move every helper and update every function command**

Change helper `emitFunction` paths to the exact `FUNCTION_PATHS` entries. Replace function command literals with interpolated resource IDs, for example:

```js
`function ${functionId(FUNCTION_PATHS.floor)}`
`return run function ${functionId(FUNCTION_PATHS.invalidNumber)}`
```

Apply the complete mapping from “Required Function Path Table.” Provider and predicate IDs containing `math:internal/` are intentionally unchanged. Verify only function-command references are gone:

```powershell
rg -n "(?:run )?function math:internal/" tools/generate-math-providers.mjs
```

Expected: no matches.

- [ ] **Step 5: Regenerate and verify old paths are removed**

After manifest-owned obsolete files are removed, delete the two forbidden legacy function directories so empty directories do not survive a local generation:

```js
fs.rmSync(path.join(targetRoot, "Math", "data", "math", "function", "internal"), { recursive: true, force: true });
fs.rmSync(path.join(targetRoot, "Math", "data", "math", "function", "common"), { recursive: true, force: true });
```

Run:

```powershell
node tools/generate-math-providers.mjs
node tools/generate-math-providers.mjs --check
```

Then verify:

```powershell
Get-ChildItem Math/data/math/function -File
Test-Path Math/data/math/function/internal
Test-Path Math/data/math/function/common
```

Expected: the file listing is empty and both path checks print `False`.

- [ ] **Step 6: Point internal algorithm tests at exact new implementations**

In `tests/arithmetic.test.mjs`, import `runImplementation` instead of `runInternalFunction` for the two direct-kernel tests and change calls to:

```js
runImplementation(".common/reciprocal/0.start", {}, { x: input, y: 1 });
runImplementation(".common/normalize_period/0.start", {}, internal);
```

Delete `runInternalFunction` from `tests/mcfunction-test-harness.mjs` once no test imports it.

- [ ] **Step 7: Run static, behavior, and full tests**

Run:

```powershell
node --test tests/function-layout.test.mjs tests/static.test.mjs
node --test tests/functions.test.mjs tests/arithmetic.test.mjs tests/transcendental.test.mjs
node --test
```

Expected: every command exits 0; the full suite reports 84 tests, 0 failures.

- [ ] **Step 8: Commit the generated layout migration**

```powershell
git add tools/generate-math-providers.mjs tools/generated-math-files.json tools/function-layout.mjs tests/static.test.mjs tests/arithmetic.test.mjs tests/mcfunction-test-harness.mjs Math/data/math/function Math/data/math/tags/function
git commit -m "refactor: organize generated function modules"
```

### Task 4: Update the Public Documentation and Integration Contract

**Files:**
- Modify: `README.md`
- Modify: `tools/integration-test.ps1`
- Test: `tests/static.test.mjs`

**Interfaces:**
- Consumes: public tags emitted by Task 3.
- Produces: user documentation and a Snapshot 10 test path that expose no direct public function IDs.

- [ ] **Step 1: Add a failing documentation/API guard**

In `tests/static.test.mjs`, add a test that reads `README.md` and `tools/integration-test.ps1`. Strip fenced code only when checking prose, then assert:

```js
assert.doesNotMatch(readme, /function math:(?!internal)/);
assert.doesNotMatch(integrationHarness, /run function math:(?!internal)/);
assert.match(readme, /function #math:divide/);
assert.match(integrationHarness, /run function #math:add/);
```

- [ ] **Step 2: Run the guard and verify RED**

Run:

```powershell
node --test --test-name-pattern="public documentation uses function tags" tests/static.test.mjs
```

Expected: FAIL because README still states that `function math:<name>` is retained for compatibility.

- [ ] **Step 3: Make tags the only documented API**

Remove the compatibility paragraph from README. State that implementation IDs under `Math/data/math/function` are private and unstable, while the supported entry points are exactly `function #math:<name>`. Keep every example tag-based.

Confirm every generated public invocation in `tools/integration-test.ps1` uses `function #math:`; do not change the server lifecycle or temporary-directory behavior.

- [ ] **Step 4: Run documentation, harness, and full tests**

Run:

```powershell
node --test --test-name-pattern="public documentation uses function tags|integration harness" tests/static.test.mjs
node --test
```

Expected: all focused tests pass and the full suite reports 85 tests, 0 failures.

- [ ] **Step 5: Commit the public contract update**

```powershell
git add README.md tools/integration-test.ps1 tests/static.test.mjs
git commit -m "docs: make function tags the public API"
```

### Task 5: Verify on Minecraft 26.3 Snapshot 10

**Files:**
- Verify only; no planned source changes.

**Interfaces:**
- Consumes: completed generated pack and integration harness.
- Produces: final evidence that generation, offline behavior, registry loading, tag execution, and cleanup all succeed.

- [ ] **Step 1: Verify deterministic generation and repository diff hygiene**

Run:

```powershell
node tools/generate-math-providers.mjs --check
git diff --check
```

Expected: both commands exit 0.

- [ ] **Step 2: Run the complete offline suite**

Run:

```powershell
node --test
```

Expected: 85 tests, 85 passes, 0 failures.

- [ ] **Step 3: Run the official Snapshot 10 integration test**

Run:

```powershell
pwsh -NoProfile -File tools/integration-test.ps1 `
  -MinecraftServerJar "C:\Users\nea\AppData\Local\Temp\minecraft-26.3-snapshot-10-server.jar" `
  -JavaExecutable "C:\Program Files (x86)\Minecraft Launcher\runtime\java-runtime-epsilon\windows-x64\java-runtime-epsilon\bin\java.exe"
```

Expected: exit 0, one `MATH_TEST_PASS:<run-id>` marker, and no function/tag/codec parsing errors.

- [ ] **Step 4: Verify cleanup and the final tree**

Run:

```powershell
$children = Get-ChildItem -LiteralPath ([IO.Path]::GetTempPath()) -Directory -Filter 'math-pack-test-*' -ErrorAction SilentlyContinue
"temporary_children=$(@($children).Count)"
git status --short --untracked-files=all
```

Expected: `temporary_children=0`; Git status contains only the intended plan-tracking state, if any.

- [ ] **Step 5: Commit any test-only verification adjustment, otherwise do not create an empty commit**

If verification required a real test correction, stage only that correction and commit:

```powershell
git add tests tools/integration-test.ps1
git commit -m "test: verify function tag layout"
```

If no files changed during verification, record the passing commands in the handoff and leave Git history unchanged.
