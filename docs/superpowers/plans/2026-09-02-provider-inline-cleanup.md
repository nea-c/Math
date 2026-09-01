# Provider Inline Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove small single-command provider resources, redundant public-to-scratch staging, and obsolete public `error` cleanup from the generated math pack.

**Architecture:** Extend the existing provider optimizer to inline a bounded provider only when one recognized compute command is its sole consumer. Separately, construct simple public wrapper providers from public storage paths at generation time so scratch is never introduced; retain scratch wherever control flow, reuse, or mutation requires it.

**Tech Stack:** Node.js ES modules, `node:test`, generated Minecraft datapack JSON/mcfunction resources, PowerShell official-server harness.

**Spec:** `docs/superpowers/specs/2026-09-02-provider-inline-cleanup-design.md`

## Global Constraints

- Inline only providers at or below the existing `maxInlineBytes: 128` limit.
- A command-inline candidate must have exactly one supported mcfunction compute consumer and no JSON or other text consumer.
- Scratch removal requires local proof that no branch, function call, reuse, or mutation observes the staged value.
- Preserve public function tags, public storage input names, `ans` output shape, binary32 behavior, and valid-input semantics.
- Preserve the official Minecraft 26.3 Pre-Release 1 numerical tolerances and cleanup assertions.
- Follow strict RED → GREEN → REFACTOR: every production change must be preceded by a test that fails for the intended missing behavior.

---

### Task 1: Inline bounded providers used by one compute command

**Files:**
- Modify: `tests/provider-resource-optimizer.test.mjs`
- Modify: `tools/provider-resource-optimizer.mjs`

**Interfaces:**
- Consumes: `optimizeProviderResources(files, { maxInlineBytes })`, where each file is `{ kind, relativePath, value? , text? }`.
- Produces: the same function signature, additionally replacing an eligible command provider ID with compact `JSON.stringify(provider.value)` and removing that provider file.

- [ ] **Step 1: Add the failing positive command-consumer test**

Append a test using a literal provider and command:

```js
test("small provider with one compute-command consumer is inlined", () => {
  const provider = {
    kind: "json",
    relativePath: "Math/data/math/context_float_provider/quotient.json",
    value: {
      type: "minecraft:div",
      left: { type: "minecraft:storage", storage: "math:", path: "a" },
      right: { type: "minecraft:storage", storage: "math:", path: "b" },
    },
  };
  const command = {
    kind: "function",
    relativePath: "Math/data/math/function/div/0.start.mcfunction",
    text: "data modify storage math: ans set compute default float math:quotient\n",
  };

  assert.deepEqual(optimizeProviderResources([provider, command], { maxInlineBytes: 256 }), [{
    ...command,
    text: "data modify storage math: ans set compute default float {\"type\":\"minecraft:div\",\"left\":{\"type\":\"minecraft:storage\",\"storage\":\"math:\",\"path\":\"a\"},\"right\":{\"type\":\"minecraft:storage\",\"storage\":\"math:\",\"path\":\"b\"}}\n",
  }]);
});
```

The mutation caught is leaving a small provider as a registry resource when one compute command is its only consumer.

- [ ] **Step 2: Run the positive test and verify RED**

Run:

```powershell
node --test --test-name-pattern="one compute-command consumer" tests/provider-resource-optimizer.test.mjs
```

Expected: FAIL because the provider file remains and the command still contains `math:quotient`.

- [ ] **Step 3: Add failing safety tests for disqualified candidates**

Add table-driven literal fixtures that assert the provider remains unchanged for:

```js
const disqualified = [
  {
    name: "two compute commands",
    texts: [
      "data modify storage math: x set compute default float math:leaf\n",
      "data modify storage math: y set compute default float math:leaf\n",
    ],
  },
  {
    name: "unsupported text position",
    texts: ["say math:leaf\n"],
  },
];
```

Also add one JSON-consumer fixture and one provider larger than its test `maxInlineBytes`. Assert on the complete optimized file array, not helper call counts.

- [ ] **Step 4: Run the safety tests and confirm current behavior**

Run:

```powershell
node --test tests/provider-resource-optimizer.test.mjs
```

Expected: the new positive test remains RED; the safety fixtures pass against current behavior. If a safety fixture fails, correct the fixture before production changes.

- [ ] **Step 5: Implement structured compute-command consumer tracking**

In `tools/provider-resource-optimizer.mjs`:

```js
const computeProviderPattern = /^(data modify storage \S+ \S+ set compute default float )([a-z0-9_.-]+:[a-z0-9_./-]+)$/gm;

function commandProviderReferences(text, knownIds) {
  const result = [];
  for (const match of text.matchAll(computeProviderPattern)) {
    if (knownIds.has(match[2])) result.push({ id: match[2], index: match.index, full: match[0], prefix: match[1] });
  }
  return result;
}

function inlineCommandProvider(text, id, replacement) {
  let replacements = 0;
  const next = text.replace(computeProviderPattern, (full, prefix, reference) => {
    if (reference !== id) return full;
    replacements += 1;
    return `${prefix}${JSON.stringify(replacement)}`;
  });
  if (replacements !== 1) throw new Error(`Expected one compute consumer for ${id}, found ${replacements}`);
  return next;
}
```

Refactor `inlineSmallSingleUseProviders` to distinguish:

- JSON consumers;
- recognized compute-command consumers;
- all other text references.

Choose a candidate only when exactly one total supported consumer exists, there are no unsupported references, and its serialized byte size is within the limit. Preserve the existing fixed-point loop and JSON inlining path.

- [ ] **Step 6: Run optimizer tests and verify GREEN**

Run:

```powershell
node --test tests/provider-resource-optimizer.test.mjs
```

Expected: all optimizer tests PASS and the command contains the literal inline provider.

- [ ] **Step 7: Commit Task 1**

```powershell
git add -- tests/provider-resource-optimizer.test.mjs tools/provider-resource-optimizer.mjs
git commit -m "Inline single-use command providers"
```

---

### Task 2: Remove obsolete public error cleanup

**Files:**
- Modify: `tests/static.test.mjs`
- Modify: `tools/generate-math-providers.mjs`
- Regenerate: `Math/data/math/function/**/*.mcfunction`
- Modify: `tools/generated-math-files.json` only if regeneration changes its file list

**Interfaces:**
- Consumes: `publicPreamble` used by `emitDirectPublicFunction` and `emitControlledPublicFunction`.
- Produces: every public entry removes stale `ans` but never touches the retired `error` path.

- [ ] **Step 1: Add the failing public-entry behavior test**

In `tests/static.test.mjs`, extend the public-entry test to load every path in `PUBLIC_FUNCTION_PATHS` and assert:

```js
assert.equal(text.includes("data remove storage math: error"), false, `${publicPath} must not touch retired error state`);
assert.match(text, /^data remove storage math: ans$/m, `${publicPath} must clear stale ans`);
```

The mutation caught is reintroducing a public write/removal of the retired error state.

- [ ] **Step 2: Run the focused static test and verify RED**

Run:

```powershell
node --test --test-name-pattern="public entries" tests/static.test.mjs
```

Expected: FAIL on the first public entry because generated functions still remove `error`.

- [ ] **Step 3: Remove `error` from the shared preamble**

Change the generator definition to:

```js
const publicPreamble = [
  "data remove storage math: ans",
];
```

Do not add a replacement cleanup elsewhere.

- [ ] **Step 4: Regenerate and verify GREEN**

Run:

```powershell
node tools/generate-math-providers.mjs
node --test --test-name-pattern="public entries" tests/static.test.mjs
node tools/generate-math-providers.mjs --check
```

Expected: focused static test PASS; generator check exits 0.

- [ ] **Step 5: Commit Task 2**

```powershell
git add -- tools/generate-math-providers.mjs tools/generated-math-files.json tests/static.test.mjs Math/data/math/function
git commit -m "Drop retired public error cleanup"
```

---

### Task 3: Compute simple public operations directly from public storage

**Files:**
- Modify: `tests/arithmetic.test.mjs`
- Modify: `tests/format-119.test.mjs`
- Modify: `tests/static.test.mjs`
- Modify: `tests/runtime-cost.test.mjs`
- Modify: `tools/generate-math-providers.mjs`
- Regenerate/delete: `Math/data/math/context_float_provider/**/*.json`
- Regenerate: `Math/data/math/function/**/*.mcfunction`
- Modify: `tools/generated-math-files.json`

**Interfaces:**
- Consumes: provider builders from `tools/math-provider-lib.mjs`, including `absolute`, `sum`, `subtract`, `product`, `divide`, `minimum`, `maximum`, `floor`, `ceil`, `round`, `truncate`, `storage`, and existing conversion/composite builders.
- Produces: `inlineProvider(provider): string` and direct public wrapper commands whose providers read `storage math:` public paths without transient `internal.x/y/z/w` copies.

- [ ] **Step 1: Add failing division output assertions**

Replace the old `.common/div` assertion in `tests/arithmetic.test.mjs` with literal behavioral expectations:

```js
test("div computes directly from public storage with an inline native provider", () => {
  assert.equal(fs.existsSync(path.join(providerRoot, ".common/div.json")), false);
  const text = fs.readFileSync("Math/data/math/function/div/1.compute.mcfunction", "utf8");
  assert.doesNotMatch(text, /storage math: internal\.[xy] set from storage math: [ab]/);
  assert.match(text, /set compute default float \{\"type\":\"minecraft:div\"/);
  assert.match(text, /\"storage\":\"math:\",\"path\":\"a\"/);
  assert.match(text, /\"storage\":\"math:\",\"path\":\"b\"/);
});
```

Keep all existing numerical division tests unchanged.

- [ ] **Step 2: Add failing cross-pack redundancy assertions**

In `tests/static.test.mjs`, define the simple public wrappers:

```js
const directWrappers = [
  "add", "sub", "mul", "abs", "min", "max", "square", "cube",
  "rad", "deg", "lerp", "floor", "ceil", "round", "truncate", "clamp",
];
```

For each generated public function, assert its compute provider reads public paths and the file has no `set from storage math: a|b|t|min|max` into `internal.*`. Separately scan the generated manifest/provider contents and assert no provider at or below 128 serialized bytes has exactly one recognized command consumer and no other consumer. Use literal resource IDs gathered from the real manifest; do not call optimizer internals to compute the expected outcome.

Add explicit counterexamples for `reciprocal`, `remainder`, `pow`, trigonometric functions, and easing functions: their scratch must remain because later calls or branches reuse/mutate it.

The mutations caught are reintroducing staging into simple wrappers, leaving another eligible command-only provider resource, or over-deleting stateful scratch.

- [ ] **Step 3: Run focused tests and verify RED**

Run:

```powershell
node --test tests/arithmetic.test.mjs tests/static.test.mjs tests/format-119.test.mjs tests/runtime-cost.test.mjs
```

Expected: FAIL because `.common/div` exists, direct wrappers stage public values, and command-only providers have not yet been regenerated through Task 1's optimizer.

- [ ] **Step 4: Add compact inline-provider generation**

In `tools/generate-math-providers.mjs`, add:

```js
const inlineProvider = provider => JSON.stringify(provider);
const computeInline = (target, provider) =>
  `data modify storage math: ${target} set compute default float ${inlineProvider(provider)}`;
```

Replace `wrapper(name, providerId, inputMap)` with `wrapper(name, provider)` that emits only `computeInline("ans", provider)` plus the shared public preamble/cleanup. Build wrapper providers with public storage objects:

```js
wrapper("add", sum(publicA, publicB));
wrapper("sub", subtract(publicA, publicB));
wrapper("mul", product(publicA, publicB));
wrapper("abs", absolute(publicA));
wrapper("min", minimum(publicA, publicB));
wrapper("max", maximum(publicA, publicB));
wrapper("square", product(publicA, publicA));
wrapper("cube", product(publicA, publicA, publicA));
```

Use the existing radian/degree constants and builders for `rad`, `deg`, and `lerp`, but replace their storage leaves with `publicA`, `publicB`, and `publicT`. Use native builders for floor/ceil/round/truncate. Construct clamp as `minimum(maximum(publicA, publicMin), publicMax)` after defining `publicMin` and `publicMax` storage objects.

- [ ] **Step 5: Simplify division without changing zero handling**

Generate `div/1.compute` as:

```js
const lines = [];
lines.push("execute if data storage math: {b:0.0f} run return 1");
lines.push(computeInline("ans", divide(publicA, publicB)));
emitControlledPublicFunction("div", FUNCTION_PATHS.divideCompute, lines);
```

This preserves stale-`ans` removal and private early return while removing both scratch copies and `.common/div`.

- [ ] **Step 6: Regenerate and update exact expectations**

Run:

```powershell
node tools/generate-math-providers.mjs
node --test tests/arithmetic.test.mjs tests/static.test.mjs tests/format-119.test.mjs tests/runtime-cost.test.mjs
```

Expected: the old format test for `.common/div.json` fails because the file is intentionally gone; any exact runtime-cost assertions fail only where commands were removed.

Update `tests/format-119.test.mjs` to validate the inline `minecraft:div` object through the generated command/parser boundary rather than a deleted file. Update runtime-cost literals to the newly measured lower values; do not relax upper bounds or numerical tolerances.

- [ ] **Step 7: Verify focused GREEN and resource invariants**

Run:

```powershell
node --test tests/provider-resource-optimizer.test.mjs tests/arithmetic.test.mjs tests/static.test.mjs tests/format-119.test.mjs tests/runtime-cost.test.mjs
node tools/generate-math-providers.mjs --check
git diff --check
```

Expected: all focused tests PASS, generator check exits 0, diff check has no output, and the manifest matches generated resources.

- [ ] **Step 8: Run the complete offline suite**

Run:

```powershell
node --test
```

Expected: all tests PASS with zero failures. Record the exact pass count.

- [ ] **Step 9: Run official 26.3 Pre-Release 1 integration**

Download the official server jar to a unique OS temporary directory, run the harness, and delete the directory in `finally`:

```powershell
$verifyDir = Join-Path ([System.IO.Path]::GetTempPath()) ("math-provider-inline-" + [guid]::NewGuid().ToString("N"))
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

Expected: exit 0 and a `MATH_TEST_PASS:` marker followed by the harness-generated run UUID. Do not store the jar in the repository.

- [ ] **Step 10: Commit Task 3**

```powershell
git add -- tools/generate-math-providers.mjs tools/generated-math-files.json tests/arithmetic.test.mjs tests/format-119.test.mjs tests/static.test.mjs tests/runtime-cost.test.mjs Math/data/math
git commit -m "Inline simple public math providers"
```

---

### Task 4: Final synchronization and review package

**Files:**
- Verify only; modify earlier task files only if verification exposes a regression.

**Interfaces:**
- Consumes: commits from Tasks 1–3 and the acceptance criteria in the design spec.
- Produces: a clean, reviewable branch with synchronized generator sources, generated resources, manifest, tests, and official-server evidence.

- [ ] **Step 1: Audit the final generated graph**

Run:

```powershell
node tools/generate-math-providers.mjs --check
node --test --test-name-pattern="reach every generated|single command|public entries|computes directly" tests/static.test.mjs tests/arithmetic.test.mjs tests/provider-resource-optimizer.test.mjs
git status --short
git diff --check master..HEAD
```

Expected: all checks PASS; status is clean; no eligible provider or redundant direct wrapper staging remains.

- [ ] **Step 2: Inspect the branch diff against the spec**

Run:

```powershell
git diff --stat master..HEAD
git diff master..HEAD -- tools/provider-resource-optimizer.mjs tools/generate-math-providers.mjs tests Math/data/math tools/generated-math-files.json
```

Confirm that changes are limited to the approved optimizer, generator, generated resources, tests, manifest, spec, and plan. Confirm no numerical tolerance, public tag, or input-domain change appears.

- [ ] **Step 3: Prepare reviewer evidence**

Record:

- merge base and HEAD SHA;
- RED failure messages for Tasks 1–3;
- focused and full offline pass counts;
- generator/diff check exit codes;
- official server `MATH_TEST_PASS` marker;
- counts and byte totals of provider files/commands removed;
- any conservative scratch candidates intentionally retained and why.

No additional commit is required when the tree is clean. If review finds a defect, fix it through a new failing regression test and commit the scoped correction separately.
