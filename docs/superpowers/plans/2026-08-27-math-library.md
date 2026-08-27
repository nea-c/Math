# Minecraft 26.3 Math Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable float math data pack for Minecraft Java Edition 26.3 with arithmetic, rounding, powers, logarithms, trigonometry, conversions, constants, errors, generated providers, and verified accuracy.

**Architecture:** Public `math:*` functions copy stable inputs from `storage math:` into `storage math:internal`, validate domains, and evaluate reusable number providers. A dependency-free Node.js generator emits large provider graphs into responsibility-based subdirectories; Node's built-in test runner evaluates those graphs with `Math.fround` after every provider operation, and a temporary official-server harness verifies Minecraft integration without committing server state.

**Tech Stack:** Minecraft Java Edition 26.3 Snapshot 10 data pack format 118, `.mcfunction`, JSON number providers and predicates, Node.js ES modules with `node:test`, PowerShell integration harness.

**Spec:** `docs/superpowers/specs/2026-08-27-math-library-design.md`

## Global Constraints

- Target Minecraft Java Edition 26.3 Snapshot 10 and data pack format `118`.
- Public inputs are `storage math:` fields `a`, `b`, `min`, `max`, and `t`; public outputs are `ans` or `error`.
- Public input fields must never be modified.
- All scratch values use `storage math:internal` fields beginning with `x`, `y`, `z`, and `w`.
- All public numeric outputs are 32-bit float tags, including integer-valued rounding results.
- Large generated providers are split with subdirectories such as `common/reciprocal/normalize/00`, never filename suffix groups such as `normalize_00`.
- The server JAR, EULA, temporary world, logs, and other server runtime files must stay outside the repository.
- No runtime mod, plugin, or third-party Node package is allowed.
- Every behavior change follows red-green-refactor: add one failing test, observe the expected failure, implement the minimum behavior, and rerun the focused plus full tests.

---

## File Map

- `Math/pack.mcmeta`: declares format 118.
- `Math/data/math/function/*.mcfunction`: stable public wrappers.
- `Math/data/math/function/internal/*.mcfunction`: shared preparation, normalization, rounding, and approximation stages.
- `Math/data/math/number_provider/common/**`: shared inputs, constants, arithmetic, normalization, reciprocal, and polynomial building blocks.
- `Math/data/math/number_provider/{square_root,log,exp,sin}/**`: function-specific approximation providers.
- `Math/data/math/predicate/internal/**`: generated finite, sign, range, zero, and exponent-band checks.
- `tools/math-provider-lib.mjs`: provider builders, deterministic writer, and float-accurate evaluator.
- `tools/generate-math-providers.mjs`: sole owner of generated provider and predicate assets.
- `tools/generated-math-files.json`: generated asset manifest and regeneration command; used instead of invalid JSON comments or unrecognized provider fields.
- `tools/integration-test.ps1`: creates and removes the temporary official-server test environment.
- `tests/static.test.mjs`: manifest, JSON, reference, naming, and generated-file checks.
- `tests/provider-evaluator.test.mjs`: evaluator unit tests.
- `tests/arithmetic.test.mjs`: exact arithmetic, reciprocal, rounding, remainder, and modulo vectors.
- `tests/transcendental.test.mjs`: root, log, exp, power, and trigonometric accuracy tests.
- `tests/functions.test.mjs`: public wrapper contract and error-path checks.
- `README.md`: installation and complete API documentation.

### Shared JavaScript interfaces

`tools/math-provider-lib.mjs` produces these stable exports for all later tasks:

```js
export const f32 = Math.fround;
export const storage = (storageId, path) => ({
  type: "minecraft:storage",
  storage: storageId,
  path,
});
export const sum = (...operands) => ({ type: "minecraft:sum", operands });
export const product = (...operands) => ({ type: "minecraft:product", operands });
export const minimum = (...operands) => ({ type: "minecraft:minimum", operands });
export const maximum = (...operands) => ({ type: "minecraft:maximum", operands });
export const ref = id => id;
```

`evaluateProvider(id, registry, storages)` returns one float number. `writeGeneratedJson(root, relativePath, value)` returns the absolute path it wrote. Later tasks consume these exact names and argument orders.

---

### Task 1: Test foundation, manifest, and deterministic generation

**Files:**
- Create: `tools/math-provider-lib.mjs`
- Create: `tools/generate-math-providers.mjs`
- Create: `tools/generated-math-files.json`
- Create: `tests/provider-evaluator.test.mjs`
- Create: `tests/static.test.mjs`
- Modify: `Math/pack.mcmeta`

**Interfaces:**
- Consumes: the repository root and existing `Math/data/math/number_provider` assets.
- Produces: `f32`, provider builder functions, `evaluateProvider`, `writeGeneratedJson`, and `node tools/generate-math-providers.mjs --check`.

- [ ] **Step 1: Write the failing manifest and evaluator tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { evaluateProvider } from "../tools/math-provider-lib.mjs";

test("pack targets data pack format 118", () => {
  const meta = JSON.parse(fs.readFileSync("Math/pack.mcmeta", "utf8"));
  assert.equal(meta.pack.min_format, 118);
  assert.equal(meta.pack.max_format, 118);
});

test("provider evaluator rounds every aggregate operation to float", () => {
  const registry = new Map([["math:test", {
    type: "minecraft:sum",
    operands: [16777216, 1, -16777216],
  }]]);
  assert.equal(evaluateProvider("math:test", registry, new Map()), 0);
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `node --test tests/provider-evaluator.test.mjs tests/static.test.mjs`

Expected: FAIL because `math-provider-lib.mjs` is missing and `pack.mcmeta` still reports format 117.

- [ ] **Step 3: Implement the float evaluator and deterministic writer**

Implement `evaluateProvider` with explicit cases for constants, registry references, `minecraft:storage`, `minecraft:sum`, `minecraft:product`, `minecraft:minimum`, `minecraft:maximum`, and `minecraft:average`. Apply `Math.fround` to every constant, storage read, and intermediate aggregate result. Resolve both prefixed (`minecraft:sum`) and current unprefixed (`sum`) type spellings while migrating old assets.

Implement `writeGeneratedJson` as:

```js
export function writeGeneratedJson(root, relativePath, value) {
  const target = path.join(root, ...relativePath.split("/")) + ".json";
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(value, null, 2) + "\n");
  return target;
}
```

Make `generate-math-providers.mjs --check` generate into an OS temporary directory and byte-compare the expected generated tree without changing the working tree. Write `tools/generated-math-files.json` with `{ "command": "node tools/generate-math-providers.mjs", "files": [...] }`, sorted by resource path. Do not add comment-like fields to provider JSON because registry codecs own those schemas.

- [ ] **Step 4: Update the manifest and verify GREEN**

Change both format fields in `Math/pack.mcmeta` from `117` to `118`, then run:

`node --test tests/provider-evaluator.test.mjs tests/static.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add Math/pack.mcmeta tools/math-provider-lib.mjs tools/generate-math-providers.mjs tools/generated-math-files.json tests/provider-evaluator.test.mjs tests/static.test.mjs
git commit -m "test: add float provider generation harness"
```

---

### Task 2: Common constants, exact operations, conversions, and wrappers

**Files:**
- Modify: `tools/generate-math-providers.mjs`
- Create: `tests/arithmetic.test.mjs`
- Create: `tests/functions.test.mjs`
- Create: `Math/data/math/function/{add,subtract,multiply,absolute,sign,minimum,maximum,clamp,square,cube,rad,deg,pi,tau,e,lerp}.mcfunction`
- Generate: `Math/data/math/number_provider/common/{input,constant,arithmetic,comparison,conversion}/**/*.json`
- Generate: `Math/data/math/predicate/internal/{finite,range}/**/*.json`

**Interfaces:**
- Consumes: Task 1 provider builders and evaluator.
- Produces: exact providers that read `storage math:internal` fields and public wrappers that read only `storage math:`.

- [ ] **Step 1: Write failing exact-operation vectors**

```js
const cases = [
  ["math:common/arithmetic/add", { x: 1.25, y: -0.5 }, 0.75],
  ["math:common/arithmetic/subtract", { x: 1.25, y: -0.5 }, 1.75],
  ["math:common/arithmetic/multiply", { x: 1.25, y: -0.5 }, -0.625],
  ["math:common/comparison/absolute", { x: -3.5 }, 3.5],
  ["math:common/conversion/rad", { x: 180 }, Math.fround(Math.PI)],
  ["math:common/conversion/deg", { x: Math.PI }, 180],
];
for (const [id, internal, expected] of cases) {
  assert.equal(run(id, internal), Math.fround(expected));
}
```

Also assert that every named public wrapper exists, removes stale `error` on success, writes `ans`, returns `1`, and never writes `storage math: a`, `b`, `min`, `max`, or `t`.

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/arithmetic.test.mjs tests/functions.test.mjs`

Expected: FAIL with missing generated provider IDs and missing public functions.

- [ ] **Step 3: Generate common exact providers**

Use these provider definitions as the canonical building blocks:

```js
const x = storage("math:internal", "x");
const y = storage("math:internal", "y");
emit("common/arithmetic/add", sum(x, y));
emit("common/arithmetic/subtract", sum(x, product(-1, y)));
emit("common/arithmetic/multiply", product(x, y));
emit("common/comparison/absolute", maximum(x, product(-1, x)));
emit("common/comparison/minimum", minimum(x, y));
emit("common/comparison/maximum", maximum(x, y));
emit("common/conversion/rad", product(x, Math.fround(Math.PI / 180)));
emit("common/conversion/deg", product(x, Math.fround(180 / Math.PI)));
```

Emit float constants using `Math.fround(Math.PI)`, `Math.fround(Math.PI * 2)`, and `Math.fround(Math.E)`. Emit `square`, `cube`, `clamp`, and `lerp` from sum/product/minimum/maximum references.

- [ ] **Step 4: Add wrappers and error helpers**

Use this binary wrapper shape for exact operations:

```mcfunction
data remove storage math: error
data modify storage math:internal x set from storage math: a
data modify storage math:internal y set from storage math: b
data modify storage math: ans set compute default math:common/arithmetic/add
return 1
```

`clamp` first rejects `min > max` with `invalid_clamp_range`. Generated `minecraft:value_check` predicates verify that each required input is within `[-3.4028234663852886e38, 3.4028234663852886e38]`; failed checks remove `ans`, set `invalid_number`, and `return fail`.

- [ ] **Step 5: Regenerate and verify GREEN**

Run:

```bash
node tools/generate-math-providers.mjs
node --test tests/arithmetic.test.mjs tests/functions.test.mjs tests/static.test.mjs
node tools/generate-math-providers.mjs --check
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

```bash
git add Math/data/math tools/generate-math-providers.mjs tests
git commit -m "feat: add exact math operations and constants"
```

---

### Task 3: Shared power-of-two normalization and corrected reciprocal

**Files:**
- Modify: `tools/generate-math-providers.mjs`
- Modify: `tests/arithmetic.test.mjs`
- Create: `Math/data/math/function/reciprocal.mcfunction`
- Modify: `Math/data/math/function/divide.mcfunction`
- Generate: `Math/data/math/number_provider/common/normalize/power_of_two/{scale,exponent}/**/*.json`
- Generate: `Math/data/math/number_provider/common/reciprocal/{00,normalize,approximate,newton}/**/*.json`
- Generate: `Math/data/math/predicate/internal/reciprocal/**/*.json`
- Remove after replacement: `Math/data/math/number_provider/reciprocal/*.json`

**Interfaces:**
- Consumes: `storage math:internal x` as a finite nonzero signed float.
- Produces: `math:common/normalize/power_of_two/scale`, `math:common/normalize/power_of_two/exponent`, and `math:common/reciprocal/00`.

- [ ] **Step 1: Add reciprocal regression tests and verify RED**

Test exact edge cases `1`, `-1`, `2`, `-2`, `0.1`, `-0.1`, `1e-20`, `-1e-20`, `Float32.MAX_VALUE`, and the smallest magnitude whose reciprocal is finite. Add 20,000 deterministic random finite nonzero floats and require maximum relative error at most `0.00001`. Assert zero takes the public `division_by_zero` path.

Run: `node --test tests/arithmetic.test.mjs`

Expected: FAIL, reproducing the current negative-input and small-magnitude failures.

- [ ] **Step 2: Generate shared exponent-band normalization**

For every binary exponent band needed by finite float reciprocals, emit non-overlapping inline `minecraft:value_check` cases in chunked `minecraft:number_dispatcher` providers. Each file contains at most 32 cases and returns zero outside its band; the public entry is the sum of chunk references.

For `x` with magnitude in `[2^e, 2^(e+1))`, return scale `2^-e`, except use the largest finite power-of-two scale for the smallest valid reciprocal band. The normalized mantissa is `m = abs(x) * scale` in `[1, 2)`, or `[0.5, 1)` only at the lowest boundary.

- [ ] **Step 3: Generate the reciprocal approximation**

Use the initial approximation and three Newton refinements:

```text
y0 = 48/17 - (32/17) * m
y1 = y0 * (2 - m*y0)
y2 = y1 * (2 - m*y1)
y3 = y2 * (2 - m*y2)
reciprocal(x) = sign(x) * scale * y3
```

Split `normalize/`, `approximate/`, and each `newton/NN/` stage into separate provider directories. `common/reciprocal/00.json` references the final sign-restored result.

- [ ] **Step 4: Replace the public reciprocal and divide wrappers**

`reciprocal` copies `a` to internal `x`; `divide` copies `b` to internal `x`, evaluates the common reciprocal into internal `z`, copies `a` to internal `x`, copies `z` to internal `y`, and evaluates common multiplication. Both reject zero before evaluation and preserve public inputs.

- [ ] **Step 5: Verify GREEN and deterministic generation**

Run:

```bash
node tools/generate-math-providers.mjs
node --test tests/arithmetic.test.mjs tests/static.test.mjs tests/functions.test.mjs
node tools/generate-math-providers.mjs --check
```

Expected: reciprocal maximum relative error is at most `0.00001`; all tests pass.

- [ ] **Step 6: Commit**

```bash
git add Math/data/math tools/generate-math-providers.mjs tests
git commit -m "fix: support full signed reciprocal range"
```

---

### Task 4: Rounding, remainder, and modulo

**Files:**
- Modify: `tools/generate-math-providers.mjs`
- Modify: `tests/arithmetic.test.mjs`
- Create: `Math/data/math/function/{floor,ceil,round,truncate,remainder,modulo}.mcfunction`
- Create: `Math/data/math/function/internal/{floor_x,truncate_x,normalize_period}.mcfunction`
- Generate: `Math/data/math/number_provider/common/rounding/**/*.json`
- Generate: `Math/data/math/predicate/internal/rounding/**/*.json`

**Interfaces:**
- Consumes: internal `x`; `normalize_period` additionally consumes positive period `y`.
- Produces: internal `z` as an integer-valued float for rounding helpers and normalized `z` for period reduction.

- [ ] **Step 1: Add signed boundary tests and verify RED**

Cover `-16777217`, `-16777216`, `-2.5`, `-1.5`, `-0.5`, negative zero, `0.5`, `1.5`, `2.5`, `16777216`, and `16777217`. Require:

```text
round(-1.5) = -1
floor(-1.5) = -2
ceil(-1.5) = -1
truncate(-1.5) = -1
remainder(-5, 3) = -2
modulo(-5, 3) = 1
```

Run: `node --test tests/arithmetic.test.mjs`

Expected: FAIL because the wrappers and providers are absent.

- [ ] **Step 2: Implement shared rounding helpers**

For `abs(x) >= 16777216`, copy `x` directly because every finite float at that magnitude is already integer-valued. Otherwise use `execute store result storage math:internal z float 1 run compute default math:common/input/x` for floor, sign-aware negation for ceil, `floor(x + 0.5)` for round, and choose floor or ceil by sign for truncate.

- [ ] **Step 3: Implement remainder, modulo, and period normalization**

Compute the float quotient with common reciprocal and multiplication, obtain `truncate(quotient)` or `floor(quotient)`, then evaluate `a - quotient*b`. Reject zero divisors. `internal/normalize_period` computes `x - round(x/y)*y`, with the result in `z`, and is reused by trigonometry.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/arithmetic.test.mjs tests/functions.test.mjs tests/static.test.mjs`

Expected: all signed rounding, remainder, and modulo cases pass.

- [ ] **Step 5: Commit**

```bash
git add Math/data/math tools/generate-math-providers.mjs tests
git commit -m "feat: add rounding remainder and modulo"
```

---

### Task 5: Square root

**Files:**
- Modify: `tools/generate-math-providers.mjs`
- Create: `tests/transcendental.test.mjs`
- Create: `Math/data/math/function/square_root.mcfunction`
- Generate: `Math/data/math/number_provider/square_root/{00,normalize,approximate,newton}/**/*.json`
- Generate: `Math/data/math/predicate/internal/square_root/**/*.json`

**Interfaces:**
- Consumes: positive internal `x` and shared power-of-two normalization.
- Produces: `math:square_root/00`; public zero returns exactly zero and negative input returns `negative_square_root`.

- [ ] **Step 1: Add root accuracy tests and verify RED**

Test zero, positive subnormals, powers of two, values adjacent to exponent bands, `2`, `3`, `10`, and `Float32.MAX_VALUE`. Add 10,000 deterministic positive random floats and require relative error at most `0.00001`.

Run: `node --test tests/transcendental.test.mjs --test-name-pattern="square root"`

Expected: FAIL with missing provider.

- [ ] **Step 2: Generate normalized root providers**

Normalize `x = m * 2^e` with `m` in `[1, 2)`. Generate a scale dispatcher returning `2^(floor(e/2))` and multiply the odd-exponent bands by the float constant `Math.fround(Math.SQRT2)`. Start with `y0 = 0.5 * (m + 1)` and apply three Babylonian refinements `y1 = 0.5 * (y0 + m/y0)`, `y2 = 0.5 * (y1 + m/y1)`, and `y3 = 0.5 * (y2 + m/y2)` using the common reciprocal component.

- [ ] **Step 3: Add wrapper and verify GREEN**

The wrapper returns exact zero before normalization, rejects negative input, evaluates `math:square_root/00`, and performs the standard finite-result check.

Run: `node --test tests/transcendental.test.mjs tests/functions.test.mjs tests/static.test.mjs`

Expected: maximum measured relative error is at most `0.00001`.

- [ ] **Step 4: Commit**

```bash
git add Math/data/math tools/generate-math-providers.mjs tests
git commit -m "feat: add square root"
```

---

### Task 6: Natural logarithm, exponential, and real power

**Files:**
- Modify: `tools/generate-math-providers.mjs`
- Modify: `tests/transcendental.test.mjs`
- Create: `Math/data/math/function/{log,exp,power}.mcfunction`
- Create: `Math/data/math/function/internal/{log_x,exp_x,power_positive}.mcfunction`
- Generate: `Math/data/math/number_provider/log/{00,normalize,polynomial}/**/*.json`
- Generate: `Math/data/math/number_provider/exp/{00,reduce,polynomial,scale}/**/*.json`
- Generate: `Math/data/math/number_provider/power/**/*.json`
- Generate: `Math/data/math/predicate/internal/{log,exp,power}/**/*.json`

**Interfaces:**
- Consumes: internal `x`, with internal `y` as the exponent for power.
- Produces: reusable `internal/log_x`, `internal/exp_x`, and `internal/power_positive` stages plus public functions.

- [ ] **Step 1: Add log/exp/power tests and verify RED**

Include `log(1)=0`, `log(e)=1`, `exp(0)=1`, `exp(1)=e`, inverse pairs across the finite exponential range, positive fractional powers, negative bases with odd/even integer exponents, `power(0,0)=1`, and every specified error. Require relative error `0.00001` for log/exp and `0.00005` for power.

Run: `node --test tests/transcendental.test.mjs --test-name-pattern="log|exp|power"`

Expected: FAIL with missing provider IDs.

- [ ] **Step 2: Implement logarithm**

Use shared power-of-two normalization `x = m * 2^e`, then evaluate:

```text
u = (m - 1) / (m + 1)
log(m) = 2 * (u + u^3/3 + u^5/5 + u^7/7 + u^9/9 + u^11/11)
log(x) = log(m) + e*ln(2)
```

Split normalization and Horner-form polynomial stages into their own directories. Reject `x <= 0` as `non_real_result`.

- [ ] **Step 3: Implement exponential**

Reduce `x = n*ln(2) + r` with `n = round(x/ln(2))`, evaluate `exp(r)` with a degree-8 Horner polynomial, and multiply by a generated `2^n` scale dispatcher. Reject finite inputs whose expected result overflows; allow underflow to positive zero only where Java float reference behavior also underflows.

- [ ] **Step 4: Implement real power**

For positive `a`, evaluate `exp(b*log(a))`. Handle zero exactly. For negative `a`, first require `b == truncate(b)`, evaluate the magnitude using `abs(a)`, and negate only for odd integer `b`; floats with `abs(b) >= 16777216` are necessarily even-valued. Return `non_real_result` for a negative base with a fractional exponent and `zero_to_negative_power` for zero with a negative exponent.

- [ ] **Step 5: Verify GREEN**

Run: `node --test tests/transcendental.test.mjs tests/functions.test.mjs tests/static.test.mjs`

Expected: all domain cases and accuracy bounds pass.

- [ ] **Step 6: Commit**

```bash
git add Math/data/math tools/generate-math-providers.mjs tests
git commit -m "feat: add logarithm exponential and power"
```

---

### Task 7: Trigonometry and angle variants

**Files:**
- Modify: `tools/generate-math-providers.mjs`
- Modify: `tests/transcendental.test.mjs`
- Create: `Math/data/math/function/{sin,cos,tan,sin_degrees,cos_degrees,tan_degrees}.mcfunction`
- Create: `Math/data/math/function/internal/{sin_x,cos_x,tan_x}.mcfunction`
- Generate: `Math/data/math/number_provider/sin/{00,fold,polynomial}/**/*.json`
- Generate: `Math/data/math/number_provider/cos/00.json`
- Generate: `Math/data/math/number_provider/tan/00.json`
- Generate: `Math/data/math/predicate/internal/tan/**/*.json`

**Interfaces:**
- Consumes: internal `x` in radians; degree wrappers convert before calling the same radian kernels.
- Produces: public radian and degree trigonometric functions with shared period normalization.

- [ ] **Step 1: Add trigonometric vectors and verify RED**

Test exact and adjacent-float values around multiples of `pi/2`, negative angles, `[-100,100]` radians, and `[-5000,5000]` degrees. Use deterministic grids plus random samples. Require absolute error at most `0.00001` for sine/cosine and `undefined_tangent` when absolute cosine is at most `0.00001`.

Run: `node --test tests/transcendental.test.mjs --test-name-pattern="sin|cos|tan|degree"`

Expected: FAIL with missing providers and wrappers.

- [ ] **Step 2: Implement shared period reduction and sine kernel**

Set internal `y` to `tau`, call `internal/normalize_period`, then fold the reduced value into `[-pi/2, pi/2]`. Evaluate sine in Horner form:

```text
sin(x) = x * (1 + x^2 * (c3 + x^2 * (c5 + x^2 * (c7 + x^2*c9))))
```

Use the float coefficients `c3 = Math.fround(-1/6)`, `c5 = Math.fround(1/120)`, `c7 = Math.fround(-1/5040)`, and `c9 = Math.fround(1/362880)`. The numerical test remains the acceptance gate for the fully float-rounded provider graph. Split fold and polynomial stages into subdirectories.

- [ ] **Step 3: Implement cosine, tangent, and degree wrappers**

Compute cosine through the same sine kernel with input `x + pi/2`. Compute tangent by evaluating sine and cosine, reject the documented pole threshold, then multiply sine by the common reciprocal of cosine. Degree wrappers first evaluate common `rad` conversion and call the same internal radian kernels.

- [ ] **Step 4: Verify GREEN and out-of-guarantee behavior**

Run: `node --test tests/transcendental.test.mjs tests/functions.test.mjs tests/static.test.mjs`

Expected: guaranteed domains meet their bounds, larger finite angles return finite results when range reduction retains usable phase, and tangent poles fail cleanly.

- [ ] **Step 5: Commit**

```bash
git add Math/data/math tools/generate-math-providers.mjs tests
git commit -m "feat: add trigonometric functions"
```

---

### Task 8: Official-server integration harness

**Files:**
- Create: `tools/integration-test.ps1`
- Modify: `tests/static.test.mjs`

**Interfaces:**
- Consumes: environment variable `MINECRAFT_SERVER_JAR` pointing to the official 26.3 Snapshot 10 server JAR and the repository's `Math` directory.
- Produces: exit code 0 only when the pack loads and representative public success/error calls pass; all runtime files live below a unique OS temporary directory.

- [ ] **Step 1: Write the failing harness contract test**

Add a static test requiring the script to use `[System.IO.Path]::GetTempPath()`, create a unique child directory, copy only the `Math` pack into the temporary world, and remove that exact resolved child directory in `finally`. Reject repository-relative `world`, `logs`, `eula.txt`, or server JAR output paths.

Run: `node --test tests/static.test.mjs --test-name-pattern="integration harness"`

Expected: FAIL because the script is absent.

- [ ] **Step 2: Implement the temporary server runner**

The script must:

```powershell
param(
    [Parameter(Mandatory=$true)][string]$MinecraftServerJar,
    [string]$JavaExecutable = 'java'
)
$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("math-pack-test-" + [guid]::NewGuid())
try {
    New-Item -ItemType Directory -Path $testRoot | Out-Null
    Set-Content -LiteralPath (Join-Path $testRoot 'eula.txt') -Value 'eula=true'
    Set-Content -LiteralPath (Join-Path $testRoot 'server.properties') -Value @(
        'level-name=world'
        'online-mode=false'
        'enable-command-block=true'
        'function-permission-level=4'
        'sync-chunk-writes=false'
    )
    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo.FileName = $JavaExecutable
    $process.StartInfo.ArgumentList.Add('-jar')
    $process.StartInfo.ArgumentList.Add($MinecraftServerJar)
    $process.StartInfo.ArgumentList.Add('nogui')
    $process.StartInfo.WorkingDirectory = $testRoot
    $process.StartInfo.UseShellExecute = $false
    $process.StartInfo.RedirectStandardInput = $true
    $process.StartInfo.RedirectStandardOutput = $true
    $process.StartInfo.RedirectStandardError = $true
    $null = $process.Start()
    $output = $process.StandardOutput.ReadToEnd()
    $process.WaitForExit()
    if ($process.ExitCode -ne 0 -or $output -notmatch 'MATH_TEST_PASS') {
        throw "Minecraft integration test failed.`n$output"
    }
}
finally {
    if ((Resolve-Path $testRoot).Path.StartsWith([System.IO.Path]::GetTempPath())) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}
```

Use `.NET Process` with redirected standard input/output. The temporary assertion pack exercises add, signed divide, small reciprocal, rounding, square root, log/exp, positive and negative power, rad/deg, sine/cosine, tangent error, and stale `ans`/`error` cleanup. It prints unique `MATH_TEST_PASS` or `MATH_TEST_FAIL:<case>` markers and stops the server.

- [ ] **Step 3: Verify the harness in a temporary environment**

Run:

`pwsh -File tools/integration-test.ps1 -MinecraftServerJar "$env:MINECRAFT_SERVER_JAR"`

Expected: server reports both data packs loaded, prints `MATH_TEST_PASS`, exits normally, and leaves no `math-pack-test-*` directory.

- [ ] **Step 4: Commit**

```bash
git add tools/integration-test.ps1 tests/static.test.mjs
git commit -m "test: add temporary 26.3 server verification"
```

---

### Task 9: Documentation and final verification

**Files:**
- Create: `README.md`
- Modify: `tests/static.test.mjs`
- Remove: `Math/data/math/function/debug/0.m.mcfunction`
- Remove: `Math/data/math/function/debug/1.tellraw.m.mcfunction`

**Interfaces:**
- Consumes: every public function and measured accuracy result from Tasks 1-8.
- Produces: user-facing installation/API/error/accuracy/generation/testing documentation and a clean release pack.

- [ ] **Step 1: Add failing documentation coverage assertions**

Require README sections for installation, storage contract, every public function name, all error identifiers, accuracy ranges, generator commands, offline tests, integration tests, and the statement that `storage math:internal` is unstable scratch state.

Run: `node --test tests/static.test.mjs --test-name-pattern="README"`

Expected: FAIL because README is absent.

- [ ] **Step 2: Write README and remove prototype debug functions**

Document representative calls such as:

```mcfunction
data modify storage math: a set value 12.0f
data modify storage math: b set value 5.0f
function math:divide
data get storage math: ans
```

Document `rad` as degrees-to-radians and `deg` as radians-to-degrees. Include the exact error and accuracy contracts from the spec, plus `node tools/generate-math-providers.mjs`, `node --test`, and the temporary server command.

- [ ] **Step 3: Run complete fresh verification**

Run:

```bash
node tools/generate-math-providers.mjs
node tools/generate-math-providers.mjs --check
node --test
pwsh -File tools/integration-test.ps1 -MinecraftServerJar "$env:MINECRAFT_SERVER_JAR"
git diff --check
git status --short
```

Expected: generator check exits 0; all Node tests pass with zero failures; the official server prints `MATH_TEST_PASS`; diff check emits no errors; status contains only intended files.

- [ ] **Step 4: Re-read the spec and verify every requirement**

Check off public API preservation, internal storage isolation, all named functions, all error identifiers, accuracy bounds, split directories, common reciprocal placement, no committed test runtime, pack format 118, and complete README coverage. Add a focused failing test before correcting any discovered gap.

- [ ] **Step 5: Commit**

```bash
git add README.md Math tools tests docs/superpowers
git commit -m "docs: document Minecraft math library"
```
