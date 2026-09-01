# Storage-only Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the checked `ans`/`error`/function-result runtime contract with an unchecked storage-only API, move scratch values under `storage math: internal`, clean scratch after each public call, and document every valid input range.

**Architecture:** Generated providers and functions remain owned by `tools/generate-math-providers.mjs`. Simple public functions calculate directly in `0.start`; branch-heavy functions use a naturally-ending `0.start` wrapper around a private compute function so internal early returns cannot skip scratch cleanup or escape through the public function tag. The Node harness models the same nested storage layout, while README becomes the authoritative valid-input contract.

**Tech Stack:** Minecraft Java Edition 26.3 Pre-Release 1 data pack format 119, `context_float_provider`, predicates, `.mcfunction`, JavaScript ES modules, Node.js built-in test runner, PowerShell official-server integration harness.

**Spec:** `docs/superpowers/specs/2026-09-02-storage-only-runtime-design.md`

## Global Constraints

- Public callers continue to use `function #math:<name>` and the existing input fields in `storage math:`.
- The only public output is `storage math: ans`; `storage math: error` and function result are not APIs.
- Remove stale `ans` and legacy `error` before every public calculation.
- Valid supported inputs retain the existing binary32 numerical results and accuracy bounds.
- Invalid, missing, non-finite, out-of-domain, and overflowing inputs have undefined output.
- Move all scratch data from `storage math:internal <path>` to `storage math: internal.<path>`.
- Remove `storage math: internal` after every normally completed public call.
- Do not add entry-time scratch clearing; generated valid paths must assign scratch before reading it.
- Keep predicates and returns needed for algorithmic control; remove validation-only resources and public success/failure propagation.
- Generate assets through `node tools/generate-math-providers.mjs`; do not hand-edit generated files.
- README must give concrete, inclusive/exclusive valid-input constraints for every public function.

---

### Task 1: Make README the Valid-input Contract

**Files:**
- Modify: `README.md`
- Modify: `tests/static.test.mjs`

**Interfaces:**
- Consumes: `PUBLIC_FUNCTION_NAMES` from `tools/function-layout.mjs` and the current runtime validation conditions in `tools/generate-math-providers.mjs`.
- Produces: one README table row for every `#math:<name>`, with a fourth `有効入力` column, plus shared binary32 and undefined-input rules used by later tasks.

- [ ] **Step 1: Write the failing README coverage test**

Add this test next to `public documentation uses function tags` in `tests/static.test.mjs`:

```js
test("README documents a valid-input contract for every public function", () => {
  const readme = fs.readFileSync("README.md", "utf8");
  const documented = new Set(
    [...readme.matchAll(/^\| `#math:([a-z0-9_]+)` \|[^\n]*\|[^\n]*\|[^\n]+\|$/gm)]
      .map((match) => match[1]),
  );
  assert.deepEqual([...documented].sort(), [...PUBLIC_FUNCTION_NAMES].sort());
  assert.match(readme, /無効な入力に対する `ans` の存在・型・値は保証しません/);
  assert.match(readme, /すべての数値入力は有限な32-bit float/);
});
```

- [ ] **Step 2: Run the focused test and confirm the old three-column tables fail**

Run: `node --test --test-name-pattern="README documents" tests/static.test.mjs`

Expected: FAIL because the current API rows do not contain a fourth valid-input column and the unchecked-input statement is absent.

- [ ] **Step 3: Rewrite the usage and API documentation**

In `README.md`:

1. Replace the success/error paragraphs with this contract:

```markdown
実行前に古い `ans` は削除され、計算結果が得られた場合だけ新しい値が入ります。function resultによる成功・失敗は返しません。

- 入力値は変更されません。
- すべての数値入力は有限な32-bit floatで指定してください。
- 下表の有効入力条件を満たさない入力の動作は未定義です。
- 無効な入力に対する `ans` の存在・型・値は保証しません。
- `internal` は非公開scratchであり、通常終了後に削除されます。
```

2. Remove `error` from the input/output field table and delete the error-ID section.
3. Add `有効入力` to every API table. Use these exact constraints, combining identical rows where useful but retaining one row per public name:

```markdown
| 種類 | 有効入力 |
| :- | :- |
| add/sub/mul | `a`, `b`が有限で、数学的結果が有限floatに収まる |
| div | `a`, `b`が有限、`b != 0`、商が有限floatに収まる |
| reciprocal | `a`が有限、`a != 0`、逆数が有限floatに収まる |
| remainder/mod | `a`, `b`が有限、`b != 0` |
| abs/sign/min/max | 必須入力が有限 |
| clamp | `a`, `min`, `max`が有限、`min <= max` |
| floor/ceil/round/truncate | `a`が有限 |
| square/cube | `a`が有限で、結果が有限floatに収まる |
| sqrt | `a`が有限、`a >= 0` |
| pow | `a`, `b`が有限。`a < 0`なら`b`は整数。`a == 0`なら`b >= 0`。結果が有限floatに収まる |
| exp | `a`が有限、`a <= 88.72283172607422f` |
| log | `a`が有限、`a > 0` |
| sin/cos/atanとdegree版 | `a`が有限 |
| tan/tan_degrees | `a`が有限で、正接が定義され安全に有限floatで表現できる |
| asin/acosとdegree版 | `a`が有限、`-1 <= a <= 1` |
| atan2とdegree版 | `a`, `b`が有限。`atan2(0,0)`は`0.0f` |
| rad/deg | `a`が有限で、変換結果が有限floatに収まる |
| pi/tau/e | 入力なし |
| lerp | `a`, `b`, `t`が有限で、結果が有限floatに収まる |
| bezier | `a`, `b`, `t`, `max`, `curve`の全要素が有限、`max > 0`、`curve`は4要素、`0 <= x1 <= 1`、`0 <= x2 <= 1` |
| elastic | `a`, `b`, `t`, `max`, `amplitude`, `period`が有限、`max > 0`、`amplitude >= 1`、`period > 0` |
| elastic_decay | 必須入力が有限、`max > 0`、`oscillations > 0`、`damping > 0` |
| bounce | `a`, `b`, `t`, `max`が有限、`max > 0` |
| bounce_decay | 必須入力が有限、`max > 0`、`bounces > 0`、`decay >= 0`。精度保証は`bounces <= 30` |
| quaternion_to_axis_angle | `rotation`が有限float 4要素の`[x,y,z,w]`で、全要素が同時に0ではない |
```

4. Preserve existing behavioral notes such as endpoint clamping, `pow(0,0)`, angle units, curve layout, and quaternion output structure.

- [ ] **Step 4: Run the README/static tests**

Run: `node --test --test-name-pattern="documentation|README" tests/static.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit the documented contract**

```powershell
git add -- README.md tests/static.test.mjs
git commit -m "Document valid math input ranges"
```

---

### Task 2: Move Scratch State into the Public Storage Compound

**Files:**
- Modify: `tools/generate-math-providers.mjs`
- Modify: `tests/mcfunction-test-harness.mjs`
- Modify: `tests/mcfunction-test-harness-structured.test.mjs`
- Modify: `tests/functions.test.mjs`
- Modify: `tests/static.test.mjs`
- Regenerate: `Math/data/math/context_float_provider/**/*.json`
- Regenerate: `Math/data/math/predicate/**/*.json`
- Regenerate: `Math/data/math/function/**/*.mcfunction`
- Regenerate: `tools/generated-math-files.json`

**Interfaces:**
- Consumes: provider `storage(storageId, path)` from `tools/math-provider-lib.mjs` and the harness `internalInput` object accepted by `runImplementation` and `evaluateGeneratedProvider`.
- Produces: provider JSON and mcfunction commands that address scratch as storage ID `math:` plus path prefix `internal.`; harness callers continue passing an unwrapped `internalInput` object.

- [ ] **Step 1: Add failing static assertions for the new storage layout**

Add to `tests/static.test.mjs`:

```js
test("generated resources use one math storage with nested internal scratch", () => {
  const manifest = JSON.parse(fs.readFileSync("tools/generated-math-files.json", "utf8"));
  for (const relativePath of manifest.files) {
    if (!/\.(?:json|mcfunction)$/.test(relativePath)) continue;
    const source = fs.readFileSync(relativePath, "utf8");
    assert.doesNotMatch(source, /math:internal/, relativePath);
  }
  assert.match(
    fs.readFileSync("Math/data/math/function/add/0.start.mcfunction", "utf8"),
    /storage math: internal\.x/,
  );
});
```

Update the focused harness expectation to require nested input:

```js
const result = evaluateGeneratedProvider("math:.common/add", {}, { x: 1.25, y: 2.5 });
assert.equal(result, 3.75);
```

- [ ] **Step 2: Run the focused tests and verify old `math:internal` references fail**

Run: `node --test tests/static.test.mjs tests/provider-evaluator.test.mjs tests/mcfunction-test-harness-structured.test.mjs`

Expected: FAIL at the new no-`math:internal` assertion.

- [ ] **Step 3: Add a single internal-storage abstraction to the generator**

At the provider declaration section of `tools/generate-math-providers.mjs`, add and use:

```js
const internalPath = (pathText) => `internal.${pathText}`;
const internalStorage = (pathText) => storage("math:", internalPath(pathText));

const x = internalStorage("x");
const y = internalStorage("y");
const z = internalStorage("z");
const w = internalStorage("w");
```

Replace every remaining `storage("math:internal", path)` construction with `internalStorage(path)`, including staged predicates and quaternion arrays.

In `emitFunction`, migrate command sources before canonical provider/predicate rewriting:

```js
.replaceAll(/storage math:internal ([A-Za-z0-9_.\[\]-]+)/g, "storage math: internal.$1")
```

Keep public paths such as `storage math: ans` unchanged.

- [ ] **Step 4: Model nested scratch in the harness**

Change `runWithStorage` and `evaluateGeneratedProvider` in `tests/mcfunction-test-harness.mjs` to initialize one storage object:

```js
const storage = {
  "math:": {
    ...clone(publicInput),
    internal: clone(internalInput),
  },
};
```

For provider-only evaluation use:

```js
new Map([["math:", { ...clone(publicInput), internal: clone(internalInput) }]])
```

Allow public-function tests to seed scratch explicitly without treating `internal` as a public input:

```js
export function runFunction(name, publicInput, internalInput = {}) {
  return runWithStorage(publicImplementationPath(name), publicInput, internalInput);
}
```

Update assertions that inspect `storage["math:internal"]` to inspect `storage["math:"].internal`. Do not yet require cleanup; this task changes location only.

- [ ] **Step 5: Regenerate and run the storage-focused tests**

Run:

```powershell
node tools/generate-math-providers.mjs
node --test tests/provider-evaluator.test.mjs tests/mcfunction-test-harness-structured.test.mjs tests/functions.test.mjs tests/static.test.mjs
```

Expected: PASS, with no generated `math:internal` references.

- [ ] **Step 6: Commit the storage migration**

```powershell
git add -- tools/generate-math-providers.mjs tests/mcfunction-test-harness.mjs tests/mcfunction-test-harness-structured.test.mjs tests/functions.test.mjs tests/static.test.mjs Math tools/generated-math-files.json
git commit -m "Move math scratch into nested storage"
```

---

### Task 3: Remove Public Validation, Errors, and Function Results

**Files:**
- Modify: `tools/function-layout.mjs`
- Modify: `tools/generate-math-providers.mjs`
- Modify: `tests/functions.test.mjs`
- Modify: `tests/mcfunction-test-harness-structured.test.mjs`
- Modify: `tests/static.test.mjs`
- Modify: numerical tests containing `returned` or `error` assertions under `tests/*.test.mjs`
- Regenerate: public and private files under `Math/data/math/function/`
- Regenerate: `tools/generated-math-files.json`

**Interfaces:**
- Consumes: nested `storage math: internal.*` from Task 2 and the valid-input rules from Task 1.
- Produces: naturally-ending public `0.start` functions, no writes to `storage math: error`, no public `return`, stale-output removal, and exit-time scratch cleanup.

- [ ] **Step 1: Replace checked-runtime tests with storage-only assertions**

Rewrite the first public-wrapper tests in `tests/functions.test.mjs` around this contract:

```js
test("public functions expose ans only and clean scratch", () => {
  for (const [name, inputs, expected] of wrappers) {
    const publicInput = {
      ...inputs,
      ans: -999,
      error: "stale_error",
    };
    const { storage, returned } = runFunction(name, publicInput, { x: 999, w_stale: 1 });
    assert.equal(returned, undefined, `${name} must naturally end`);
    assert.equal(storage["math:"].ans, Math.fround(expected), `${name} ans`);
    assert.equal(storage["math:"].error, undefined, `${name} legacy error`);
    assert.equal(storage["math:"].internal, undefined, `${name} scratch cleanup`);
    for (const field of ["a", "b", "min", "max", "t"]) {
      assert.deepEqual(storage["math:"][field], publicInput[field], `${name} preserves ${field}`);
    }
  }
});
```

Add a static test:

```js
test("public entries naturally end without exposing function results", () => {
  for (const name of PUBLIC_FUNCTION_NAMES) {
    const source = fs.readFileSync(`Math/data/math/function/${name}/0.start.mcfunction`, "utf8");
    assert.doesNotMatch(source, /(?:^|\n)return(?: |\n)/, name);
    assert.doesNotMatch(source, /storage math: error set/, name);
    assert.match(source, /^data remove storage math: ans$/m, name);
    assert.match(source, /^data remove storage math: internal$/m, name);
  }
});
```

Delete tests that require a particular invalid-input value, `error` ID, `return fail`, or public result `1`. Retain all valid boundary and accuracy cases, changing only their result assertions to inspect `ans`.

- [ ] **Step 2: Run focused tests and confirm the checked contract fails**

Run: `node --test tests/functions.test.mjs tests/static.test.mjs`

Expected: FAIL because generated public functions still return success/failure, write errors, and retain scratch.

- [ ] **Step 3: Introduce direct and controlled public emitters**

Replace the one-form `emitPublicFunction` with two explicit generator paths:

```js
const publicPreamble = [
  "data remove storage math: error",
  "data remove storage math: ans",
];
const publicCleanup = "data remove storage math: internal";

function emitDirectPublicFunction(name, computeLines) {
  emitFunction(PUBLIC_FUNCTION_PATHS[name], [
    ...publicPreamble,
    ...computeLines,
    publicCleanup,
  ]);
  emitFunctionTag(name, publicTag(name));
}

function emitControlledPublicFunction(name, computePath, computeLines) {
  emitFunction(PUBLIC_FUNCTION_PATHS[name], [
    ...publicPreamble,
    `function ${functionId(computePath)}`,
    publicCleanup,
  ]);
  emitFunction(computePath, computeLines);
  emitFunctionTag(name, publicTag(name));
}
```

Direct public bodies must contain no `return`. Controlled compute bodies may use early `return 1` only to stop their own remaining commands; their public wrapper calls them with plain `function` and swallows the value.

- [ ] **Step 4: Allocate controlled compute files without numeric collisions**

Use `1.compute` for the branch-heavy public implementations and shift existing public-folder helpers as follows:

```text
bezier: solve 1->2, finish 2->3
bounce: finish 1->2
bounce_decay: finish 1->2
div: existing helpers 1..4 -> 2..5
elastic: phase 1->2, finish 2->3
elastic_decay: finish 1->2
mod: negative_b 1->2
pow: existing helpers 1..9 -> 2..10
quaternion_to_axis_angle: existing helpers 1..4 -> 2..5
sqrt: existing helpers 1..3 -> 2..4
```

Also emit `1.compute` for `atan2`, `atan2_degrees`, `exp`, `sin`, `sin_degrees`, `cos`, `cos_degrees`, `tan`, and `tan_degrees`. Update every corresponding `FUNCTION_PATHS` value and internal function reference atomically.

- [ ] **Step 5: Remove validation/error behavior while preserving valid control flow**

Apply these exact rules in `tools/generate-math-providers.mjs`:

- Delete `validationLines`, the seven `.common/_error` function emissions, and all `storage math: error set value ...` commands.
- Delete finite-input and finite-result staging performed solely to choose an error function.
- Delete unconditional trailing `return 1` from direct public bodies.
- Replace public `return run function` propagation with plain `function` calls inside the `0.start` wrapper.
- For valid algorithmic branches—zero fast paths, interpolation endpoints, exp underflow, negative-base integer power, modulo sign, quaternion zero-vector axis selection—retain private early returns.
- When an invalid branch still has to stop a private algorithm from reading unusable scratch, clear no public output and use a private early `return 1`; the wrapper has already removed stale `ans` and will still remove `internal`.
- Remove result-finite checks after provider evaluation. If `data ... compute` writes `0.0f`, retain it as the unchecked result.
- Ensure every valid path assigns every scratch field before reading it, including when the caller supplied a stale `internal` compound.

The generated public shape for a direct function must match:

```mcfunction
data remove storage math: error
data remove storage math: ans
data modify storage math: internal.x set from storage math: a
data modify storage math: ans set compute default float math:.common/abs
data remove storage math: internal
```

The generated public shape for a controlled function must match:

```mcfunction
data remove storage math: error
data remove storage math: ans
function math:sqrt/1.compute
data remove storage math: internal
```

- [ ] **Step 6: Update valid numerical tests and run the runtime suite**

Search first:

Run: `rg -n "returned|\.error|invalid_number|result_out_of_range|return success|must fail" tests -g '*.test.mjs'`

For each match, preserve valid numerical assertions and remove only invalid-output/result-ID expectations. Then run:

```powershell
node tools/generate-math-providers.mjs
node --test tests/functions.test.mjs tests/mcfunction-test-harness-structured.test.mjs tests/arithmetic.test.mjs tests/transcendental.test.mjs tests/atan.test.mjs tests/inverse-trigonometry.test.mjs tests/quaternion.test.mjs tests/elastic.test.mjs tests/bounce.test.mjs tests/bezier.test.mjs
```

Expected: PASS. In particular, valid calls naturally end, write the expected `ans`, remove stale `error`, and leave no `internal` compound.

- [ ] **Step 7: Commit the storage-only public runtime**

```powershell
git add -- tools/function-layout.mjs tools/generate-math-providers.mjs tests Math tools/generated-math-files.json
git commit -m "Adopt unchecked storage-only math runtime"
```

---

### Task 4: Prune Validation-only Resources and Rebaseline Generated Costs

**Files:**
- Modify: `tools/generate-math-providers.mjs`
- Modify: `tools/generated-math-files.json`
- Modify: `tests/static.test.mjs`
- Modify: `tests/runtime-cost.test.mjs`
- Modify: `tests/bezier-cost.test.mjs`
- Modify: `tests/normalization-cost.test.mjs`
- Modify: `tests/remainder-cost.test.mjs`
- Modify: other cost tests whose exact command totals change
- Delete through generator manifest: validation-only JSON under `Math/data/math/context_float_provider/.validation/`
- Delete through generator manifest: validation-only JSON under `Math/data/math/predicate/.validation/`
- Delete through generator manifest: `Math/data/math/function/.common/_error/`

**Interfaces:**
- Consumes: the storage-only generator and shifted function paths from Task 3.
- Produces: a generated manifest containing only providers and predicates referenced by valid algorithms, with updated measured runtime budgets.

- [ ] **Step 1: Change static ownership assertions to require error-resource removal**

Replace the old `.common/_error` filename assertion in `tests/static.test.mjs` with:

```js
assert.equal(fs.existsSync(path.join(functionRoot, ".common", "_error")), false);

const manifest = JSON.parse(fs.readFileSync("tools/generated-math-files.json", "utf8"));
assert.equal(manifest.files.some((file) => file.includes("/.common/_error/")), false);
assert.equal(manifest.files.some((file) => file.includes("/.validation/finite/")), false);
```

Add a repository scan that rejects `w_validation_`, `return fail`, and `storage math: error set` in generated mcfunctions.

- [ ] **Step 2: Run static and cost tests to record failures before pruning**

Run:

```powershell
node --test tests/static.test.mjs
node --test tests/runtime-cost.test.mjs tests/bezier-cost.test.mjs tests/normalization-cost.test.mjs tests/remainder-cost.test.mjs
```

Expected: static FAIL while validation/error resources remain; cost tests may FAIL because Task 3 removed commands or added a wrapper call.

- [ ] **Step 3: Stop emitting validation-only resources**

Remove the finite-provider loop that emits `finite/{a,b,...,ans}` resources. Remove staged predicates used only by deleted error checks, including result-finite predicates and invalid public-domain predicates with no remaining algorithmic consumer. Keep branch predicates used by valid calculations, such as sign, endpoint, normalization, exponent classification, modulo direction, and quaternion normalization.

Delete obsolete error entries from `FUNCTION_PATHS`. Let the generator's previous-manifest cleanup remove stale files; do not manually delete untracked paths outside the manifest flow.

- [ ] **Step 4: Regenerate and prove every generated resource is consumed**

Run:

```powershell
node tools/generate-math-providers.mjs
node tools/generate-math-providers.mjs --check
node --test tests/static.test.mjs tests/provider-resource-optimizer.test.mjs tests/format-119.test.mjs
```

Expected: PASS with no `_error`, `finite`, `w_validation_`, `return fail`, or old scratch-storage references.

- [ ] **Step 5: Measure and update exact runtime budgets**

For every failing cost assertion, use its existing `staticFunctionCost`/`runtimeCost` measurement to obtain the new deterministic command count. Update only the literal expected total or budget justified by the newly removed validation commands and added private wrapper call; do not weaken relative-error assertions or replace exact assertions with broad upper bounds.

Run:

```powershell
node --test tests/runtime-cost.test.mjs tests/bezier-cost.test.mjs tests/normalization-cost.test.mjs tests/remainder-cost.test.mjs tests/reciprocal-staging.test.mjs
```

Expected: PASS on two consecutive runs with identical totals.

- [ ] **Step 6: Commit the resource pruning and cost baselines**

```powershell
git add -- tools/generate-math-providers.mjs tools/function-layout.mjs tools/generated-math-files.json tests Math
git commit -m "Prune obsolete math validation resources"
```

---

### Task 5: Update Official-server Assertions and Verify the Release

**Files:**
- Modify: `tools/integration-test.ps1`
- Modify if final wording needs synchronization: `README.md`
- Test: all files under `tests/`

**Interfaces:**
- Consumes: a local official Minecraft 26.3 Pre-Release 1 server JAR through environment variable `MINECRAFT_SERVER_JAR`.
- Produces: an integration harness that checks only public storage output, valid numerical cases, stale-output removal, and scratch cleanup.

- [ ] **Step 1: Rewrite generated integration assertions around storage output**

In `tools/integration-test.ps1`:

- Remove `execute store result score #return ... run function #math:*` and every `#return` guard.
- Invoke public functions with plain `function #math:<name>`.
- Remove invalid-input cases whose expected result was a specific error ID or return value.
- Keep all valid numerical, signed-zero, endpoint, structured quaternion, and precision cases.
- Continue preloading `ans` and legacy `error` before representative calls.
- After each representative call, assert `error` and `internal` are absent:

```powershell
$assertionCommands.Add("function #math:$Function")
Add-Guard -Condition 'if data storage math: error' -Case "${Case}_stale_error"
Add-Guard -Condition 'if data storage math: internal' -Case "${Case}_scratch"
```

- Add a sequential-call case that seeds `storage math: internal` with stale fields, calls a valid function, verifies its `ans`, then calls a second valid function and verifies both correctness and absence of `internal`.

- [ ] **Step 2: Run all offline verification**

Run:

```powershell
node tools/generate-math-providers.mjs --check
node --test
git diff --check
rg -n "storage math:internal|storage math: error set|return fail|w_validation_" Math tools/generated-math-files.json
```

Expected:

- generator check exits 0;
- all Node tests pass;
- `git diff --check` exits 0;
- final `rg` returns no matches.

- [ ] **Step 3: Run the official-server integration harness**

Run:

```powershell
pwsh -File tools/integration-test.ps1 -MinecraftServerJar "$env:MINECRAFT_SERVER_JAR"
```

Expected: one `MATH_TEST_PASS:<run-id>` line and exit code 0. The environment variable must point to the official Minecraft Java Edition 26.3 Pre-Release 1 server JAR.

- [ ] **Step 4: Review generated and documented API consistency**

Run:

```powershell
git status --short
git diff --stat
rg -n "#math:|有効入力|未定義|internal" README.md
```

Confirm all 48 public tags are documented, no generated public entry exposes a return value, every normal public call clears scratch, and no unrelated files changed.

- [ ] **Step 5: Commit the verified integration contract**

```powershell
git add -- tools/integration-test.ps1 README.md tests tools Math
git commit -m "Verify storage-only math API"
```
