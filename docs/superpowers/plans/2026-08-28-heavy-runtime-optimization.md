# Heavy Runtime Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** README の数値・エラー保証を維持したまま、重い公開数学関数の実行 command 数、provider 式ノード数、判定数、および再帰深度を削減する。

**Architecture:** 生成器に決定的な負荷測定と平衡 lookup を追加し、周期縮約と binary32 正規化を共有する。関数固有の巨大式は storage へ段階保存し、適応処理は保証を満たさない場合に現行経路へフォールバックする。

**Tech Stack:** JavaScript ESM、Node.js `node:test`、Minecraft Snapshot 10 mcfunction / number provider / predicate、既存の offline mcfunction harness。

**Spec:** `docs/superpowers/specs/2026-08-28-heavy-runtime-optimization-design.md`

## Global Constraints

- 公開 function tag、storage schema、function result、エラー ID、入力保持を変更しない。
- README 記載の誤差上限を緩和しない。最下位ビットの変化は許容する。
- `remainder` と `modulo` は binary32 の有限入力に対して完全一致を維持する。
- `divide` のサブノーマル保証、`tan` の保守的拒否条件、`bezier` の `2^-20` 区間保証を維持する。
- 生成物は `tools/generate-math-providers.mjs` と `tools/generated-math-files.json` で一元管理する。
- 既存の未コミット変更を上書き、削除、または無関係な commit に含めない。
- 各フェーズは負荷と数値の両方が改善条件を満たす場合だけ残す。

---

### Task 1: 決定的な実行負荷測定基盤

**Files:**
- Create: `tests/runtime-cost.mjs`
- Create: `tests/runtime-cost.test.mjs`
- Modify: `tests/mcfunction-test-harness.mjs`

**Interfaces:**
- Produces: `loadGeneratedGraph() -> { functions, providers, predicates }`
- Produces: `expandedProviderNodes(id, graph) -> number`
- Produces: `staticFunctionCost(path, graph, options) -> { commands, providerNodes, calls }`
- Produces: `runFunction()` / `runImplementation()` result field `commandsExecuted: number`
- Consumes: generated files under `Math/data/math/`

- [ ] **Step 1: Write failing tests for provider and command accounting**

Create `tests/runtime-cost.test.mjs` with fixtures that assert provider references are expanded, only executed conditional branches count dynamically, and recursive calls are capped explicitly:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { expandedProviderNodes, loadGeneratedGraph, staticFunctionCost } from "./runtime-cost.mjs";
import { runFunction } from "./mcfunction-test-harness.mjs";

const graph = loadGeneratedGraph();

test("runtime cost expands referenced providers", () => {
  assert.ok(expandedProviderNodes("math:internal/reciprocal/newton", graph) > 1);
});

test("runtime cost reports public command work", () => {
  const cost = staticFunctionCost("tan/0.start", graph, { recursionLimit: 320 });
  assert.ok(cost.commands > 0);
  assert.ok(cost.providerNodes > 0);
  assert.ok(cost.calls.includes(".common/tan/0.start"));
});

test("harness exposes dynamically executed command count", () => {
  const result = runFunction("add", { a: 1, b: 2 });
  assert.equal(typeof result.commandsExecuted, "number");
  assert.ok(result.commandsExecuted > 0);
});
```

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `node --test tests/runtime-cost.test.mjs`

Expected: FAIL because `tests/runtime-cost.mjs` and `commandsExecuted` do not exist.

- [ ] **Step 3: Add dynamic command accounting to the harness**

In `runWithStorage`, initialize `let commandsExecuted = 0;`, increment it immediately before each parsed command is executed, and include it in both exported runner results:

```js
let commandsExecuted = 0;

function runCommands(functionName, macros = {}) {
  for (const sourceCommand of commandsFor(functionName)) {
    const command = sourceCommand.startsWith("$")
      ? sourceCommand.slice(1).replaceAll(/\$\(([A-Za-z0-9_]+)\)/g, (_, key) => `${macros[key]}`)
      : sourceCommand;
    commandsExecuted += 1;
    const result = execute(command);
    if (result !== undefined) return result;
  }
}

return { storage, numericTags, returned, commandsExecuted };
```

- [ ] **Step 4: Implement the static graph loader and cost walkers**

`tests/runtime-cost.mjs` must load JSON and mcfunction files once, reject provider reference cycles, expand `operands`, dispatcher cases, and conditional branches, and report the maximum function-call path. Function parsing must recognize direct `function`, `return run function`, and `execute ... run function` forms already supported by the harness.

```js
export function expandedProviderNodes(id, graph, stack = []) {
  if (typeof id === "number") return 1;
  if (typeof id === "string") {
    assert.ok(!stack.includes(id), `provider cycle: ${[...stack, id].join(" -> ")}`);
    return expandedProviderNodes(graph.providers.get(id), graph, [...stack, id]);
  }
  assert.ok(id && typeof id === "object");
  const children = [
    ...(id.operands ?? []),
    ...(id.cases ?? []).map(entry => entry.number_provider),
    ...("default" in id ? [id.default] : []),
    ...("on_true" in id ? [id.on_true, id.on_false] : []),
  ];
  return 1 + children.reduce((total, child) => total + expandedProviderNodes(child, graph, stack), 0);
}
```

- [ ] **Step 5: Record the pre-change baselines**

Add a table constant to `tests/runtime-cost.test.mjs` for `tan`, `tan_degrees`, `log`, `divide`, `square_root`, `bezier`, `remainder`, `modulo`, and `power`. Measure representative normal and boundary inputs dynamically, and serialize the measured numbers as explicit upper bounds. Do not estimate the constants manually.

```js
const BASELINE_INPUTS = {
  tan: { a: 1 },
  tan_degrees: { a: 45 },
  log: { a: 3 },
  divide: { a: 7, b: 3 },
  square_root: { a: 3 },
  bezier: { t: 5, max: 10, a: 0, b: 1, curve: [0.25, 0.1, 0.25, 1] },
  remainder: { a: 12345.5, b: 7 },
  modulo: { a: -12345.5, b: 7 },
  power: { a: 3, b: 2.5 },
};
```

- [ ] **Step 6: Verify the measurement foundation**

Run: `node --test tests/runtime-cost.test.mjs tests/static.test.mjs`

Expected: PASS, with deterministic counts on two consecutive runs.

- [ ] **Step 7: Checkpoint only the measurement files**

Review: `git diff -- tests/runtime-cost.mjs tests/runtime-cost.test.mjs tests/mcfunction-test-harness.mjs`

If commits are authorized, commit only those three paths with message `test: add deterministic runtime cost budgets`.

---

### Task 2: tan の周期縮約共有

**Files:**
- Modify: `tools/generate-math-providers.mjs`
- Modify: `tools/generated-math-files.json` (generated)
- Modify: `tests/transcendental.test.mjs`
- Modify: `tests/runtime-cost.test.mjs`
- Regenerate: `Math/data/math/function/.common/tan/0.start.mcfunction`
- Regenerate: tan scratch providers under `Math/data/math/number_provider/tan/`

**Interfaces:**
- Consumes: `.common/normalize_period/0.start`, `.common/sin/1.evaluate`, common reciprocal kernel
- Produces scratch: `w_tan_phase`, `w_tan_sin`, `w_tan_cos`
- Produces: `.common/tan/0.start` that performs one period normalization

- [ ] **Step 1: Add a failing structural and cost test**

```js
test("tan normalizes its input once and reuses one phase", () => {
  const source = fs.readFileSync("Math/data/math/function/.common/tan/0.start.mcfunction", "utf8");
  assert.equal((source.match(/math:\.common\/normalize_period\/0\.start/g) ?? []).length, 1);
  assert.doesNotMatch(source, /math:\.common\/(?:sin|cos)\/0\.start/);
  assert.match(source, /w_tan_sin/);
  assert.match(source, /w_tan_cos/);
});
```

Add a budget asserting representative `tan(1)` and `tan_degrees(45)` execute fewer commands than Task 1 baselines.

- [ ] **Step 2: Verify the test fails against the double-normalization implementation**

Run: `node --test tests/runtime-cost.test.mjs tests/transcendental.test.mjs`

Expected: FAIL on the one-normalization structural assertion.

- [ ] **Step 3: Generate a shared-phase tangent kernel**

Change `FUNCTION_PATHS.tan` emission so it normalizes once, preserves the phase, evaluates sine, restores the phase, evaluates the cosine transform plus sine polynomial, and stores both outputs:

```js
emitFunction(FUNCTION_PATHS.tan, [
  "data modify storage math:internal y set compute default math:common/constant/tau",
  `function ${functionId(FUNCTION_PATHS.normalizePeriod)}`,
  "data modify storage math:internal w_tan_phase set from storage math:internal z",
  "data modify storage math:internal x set from storage math:internal z",
  `function ${functionId(FUNCTION_PATHS.sinEvaluate)}`,
  "data modify storage math:internal w_tan_sin set from storage math:internal x",
  "data modify storage math:internal x set from storage math:internal w_tan_phase",
  "data modify storage math:internal x set compute default math:cos/00",
  "data modify storage math:internal z set from storage math:internal x",
  `function ${functionId(FUNCTION_PATHS.sinEvaluate)}`,
  "data modify storage math:internal w_tan_cos set from storage math:internal x",
  "return 1",
]);
```

Update `tangentResultLines` to guard `w_tan_cos`, call reciprocal with `x = w_tan_cos`, and compute `ans = w_tan_sin * reciprocal` without using stale `ans`, `w`, or phase scratch.

- [ ] **Step 4: Regenerate and run tangent guarantees**

Run: `node tools/generate-math-providers.mjs`

Run: `node --test tests/transcendental.test.mjs tests/runtime-cost.test.mjs tests/static.test.mjs`

Expected: all tangent accuracy/domain tests PASS; both tangent cost budgets are below baseline.

- [ ] **Step 5: Run the full suite**

Run: `node --test`

Expected: PASS.

- [ ] **Step 6: Checkpoint the tangent phase**

Review generated deletion/addition scope with `git diff --stat` and `git diff -- tools/generate-math-providers.mjs tests/transcendental.test.mjs tests/runtime-cost.test.mjs`.

If commits are authorized, commit only tangent-related sources, tests, manifest, and generated files with message `perf: reuse tangent period reduction`.

---

### Task 3: 共通 binary32 正規化と log/divide の段階計算

**Files:**
- Modify: `tools/function-layout.mjs`
- Modify: `tools/generate-math-providers.mjs`
- Modify: `tools/generated-math-files.json` (generated)
- Create: `tests/normalization-cost.test.mjs`
- Modify: `tests/arithmetic.test.mjs`
- Modify: `tests/transcendental.test.mjs`
- Modify: `tests/runtime-cost.test.mjs`
- Regenerate: common normalization functions/providers and affected `log`, `reciprocal`, `divide` files

**Interfaces:**
- Consumes internal `x`: finite nonzero magnitude
- Produces `w_normalize_mantissa`, `w_normalize_exponent`, `w_normalize_scale`, `w_normalize_multiplier_a`, `w_normalize_multiplier_b`
- Produces function path `.common/normalize_binary32/0.start`
- Preserves caller-owned public storage and `ans`/`error`

- [ ] **Step 1: Add exhaustive exponent-classification tests before generation code**

Create `tests/normalization-cost.test.mjs`. For every binary32 exponent from `-149` through `127`, test the power of two and its adjacent representable values. Assert `mantissa` is in `[1, 2)`, reconstruction rounds to the original magnitude, and lookup depth is bounded.

```js
for (let exponent = -149; exponent <= 127; exponent += 1) {
  const input = Math.fround(2 ** exponent);
  if (input === 0 || !Number.isFinite(input)) continue;
  const result = runImplementation(".common/normalize_binary32/0.start", {}, { x: input });
  const internal = result.storage["math:internal"];
  assert.equal(result.returned, 1);
  assert.ok(internal.w_normalize_mantissa >= 1 && internal.w_normalize_mantissa < 2);
  assert.equal(Math.fround(internal.w_normalize_mantissa * (2 ** internal.w_normalize_exponent)), input);
  assert.equal(internal.w_normalize_exponent, exponent);
}
```

- [ ] **Step 2: Verify failure because the common normalizer is absent**

Run: `node --test tests/normalization-cost.test.mjs`

Expected: FAIL with unknown function `.common/normalize_binary32/0.start`.

- [ ] **Step 3: Add balanced input lookup generation**

Add generator helpers whose selector is explicit rather than hard-coded to `z`:

```js
function balancedRangeLookup(entries, selector, selectValue) {
  if (entries.length === 1) return selectValue(entries[0]);
  const middle = Math.floor(entries.length / 2);
  const lower = entries.slice(0, middle);
  const upper = entries.slice(middle);
  return numberDispatcher([{
    condition: inlineValueCheck(selector, undefined, lower.at(-1).maximum),
    number_provider: balancedRangeLookup(lower, selector, selectValue),
  }], balancedRangeLookup(upper, selector, selectValue));
}
```

Generate finite exponent entries in ascending magnitude order. For each entry, emit an exponent provider, a reconstruction scale provider, and one or two exact power-of-two normalization multipliers. A multiplier may not exceed the finite binary32 range: for exponents below `-127`, split `2 ** -exponent` into `2 ** 127` and the remaining power. Handle subnormal powers individually; do not derive their exponent with a rounded logarithm.

- [ ] **Step 4: Emit the common normalizer and migrate callers one at a time**

Add `normalizeBinary32` to `FUNCTION_PATHS`. Its start function writes the lookup exponent, reconstruction scale, and normalization multiplier pair, then computes the normalized mantissa using two staged power-of-two multiplications. Migrate in this order, running focused tests after each edit: `reciprocal`, `log`, `divide` input A, and `divide` input B. Add a separate balanced exponent-to-scale provider for `divide` result scaling because that stage consumes an exponent difference rather than a magnitude.

Delete the old scale-up/scale-down function constants only after no generated function references them. Update the function-layout test to require the new common folder and reject the retired recursive normalizers.

- [ ] **Step 5: Stage log's private Newton denominator**

Replace the three `internal/reciprocal/log_newton/<stage>/00` expressions with one small update provider using dedicated scratch:

```js
const storedLogMantissa = storage("math:internal", "w_log_mantissa");
const storedLogReciprocal = storage("math:internal", "w_log_reciprocal");
emit("internal/reciprocal/log_initial", sum(48 / 17, product(-32 / 17, storedLogMantissa)));
emit("internal/reciprocal/log_newton", product(
  storedLogReciprocal,
  sum(2, product(-1, storedLogMantissa, storedLogReciprocal)),
));
```

Generate three consecutive writes to `w_log_reciprocal`, followed by `log_denominator`. Add a structural test that no `log_newton/00`, `01`, or `02` subtree remains and each active provider stays below 60 expanded nodes.

- [ ] **Step 6: Preserve divide compensation while removing repeated expression trees**

Keep the existing fields `w_divide_product_high`, `w_divide_product_low`, `w_divide_residual_high`, `w_divide_residual_low`, and `w_divide_quotient`. Add assertions that every compute line consumes only already-materialized fields and that no active divide provider exceeds the recorded pre-change node maximum.

- [ ] **Step 7: Verify numeric contracts and cost reductions**

Run: `node tools/generate-math-providers.mjs`

Run: `node --test tests/normalization-cost.test.mjs tests/reciprocal-staging.test.mjs tests/arithmetic.test.mjs tests/transcendental.test.mjs tests/runtime-cost.test.mjs tests/static.test.mjs`

Expected: PASS; representative and boundary `log`/`divide` command counts are below Task 1 baselines; normalization lookup depth is fixed across exponents.

- [ ] **Step 8: Run the full suite and generator check**

Run: `node --test`

Run: `node tools/generate-math-providers.mjs --check`

Expected: both PASS.

- [ ] **Step 9: Checkpoint the shared-normalization phase**

Review all retired recursive generated files and confirm they are listed as deletions rather than left beside new paths.

If commits are authorized, commit this phase with message `perf: share binary32 normalization`.

---

### Task 4: square_root の保証付き反復削減

**Files:**
- Modify: `tools/generate-math-providers.mjs`
- Modify: `tools/generated-math-files.json` (generated)
- Create: `tests/square-root-cost.test.mjs`
- Modify: `tests/transcendental.test.mjs`
- Modify: `tests/runtime-cost.test.mjs`
- Regenerate: `square_root` providers/functions

**Interfaces:**
- Consumes: Task 3 common normalizer outputs
- Produces: `w_sqrt_estimate`, `w_sqrt_residual`, optional slow-path function `square_root/2.refine`
- Maintains relative error `<= 1e-5`

- [ ] **Step 1: Add adversarial accuracy and path-budget tests**

Generate cases at every power-of-two boundary, both adjacent floats, all representative subnormal exponent bands, and 50,000 deterministic positive finite bit patterns. Assert the README relative error bound. Count commands separately for ordinary and slow-path values.

```js
let state = 0x9e3779b9;
for (let count = 0; count < 50_000;) {
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  const input = floatFromBits(state & 0x7fffffff);
  if (!Number.isFinite(input) || input === 0) continue;
  assertSquareRoot(input);
  count += 1;
}
```

- [ ] **Step 2: Verify the cost test fails against the fixed current iteration path**

Run: `node --test tests/square-root-cost.test.mjs`

Expected: FAIL on the new ordinary-path command budget, while accuracy passes.

- [ ] **Step 3: Materialize each Newton update and a residual guard**

Use dedicated scratch so each update provider has one multiplication/addition tree:

```js
const sqrtEstimate = storage("math:internal", "w_sqrt_estimate");
const sqrtMantissa = storage("math:internal", "w_normalize_mantissa");
emit("square_root/newton/update", product(0.5, sum(
  sqrtEstimate,
  product(sqrtMantissa, storage("math:internal", "w_sqrt_reciprocal")),
)));
emit("square_root/residual", sum(product(sqrtEstimate, sqrtEstimate), product(-1, sqrtMantissa)));
```

Run the minimum fixed number of updates established by the exhaustive test. Use the staged residual predicate only to enter one additional update. Do not select the threshold from decimal intuition: scan float32 candidates in the test and choose the widest threshold with no accuracy failure.

- [ ] **Step 4: Regenerate and verify both paths**

Run: `node tools/generate-math-providers.mjs`

Run: `node --test tests/square-root-cost.test.mjs tests/transcendental.test.mjs tests/runtime-cost.test.mjs tests/static.test.mjs`

Expected: PASS; ordinary path improves; slow path is no worse than its Task 1 boundary baseline.

- [ ] **Step 5: Full verification and checkpoint**

Run: `node --test`

Run: `node tools/generate-math-providers.mjs --check`

If commits are authorized, commit with message `perf: adapt square root refinement`.

---

### Task 5: bezier の負荷改善可否ゲート

**Files:**
- Modify: `tools/generate-math-providers.mjs` only if the feasibility gate passes
- Modify: `tools/function-layout.mjs` only if a fallback function is required
- Modify: `tools/generated-math-files.json` (generated, only if changed)
- Create: `tests/bezier-cost.test.mjs`
- Modify: `tests/bezier.test.mjs`
- Modify: `tests/runtime-cost.test.mjs`
- Regenerate: bezier files only if changed

**Interfaces:**
- Consumes/produces bracket: `w_bezier_low`, `w_bezier_high`
- Maintains invariant `x(low) <= u <= x(high)` and final width `<= 2 ** -20`
- May produce `w_bezier_candidate`, `w_bezier_derivative`

- [ ] **Step 1: Add bracket-invariant and exact-width observability**

Expose the final bracket only in `math:internal`, never public storage. Extend `tests/bezier-cost.test.mjs` with identity, flat-start, flat-end, symmetric, and strongly biased curves. Assert:

```js
const internal = result.storage["math:internal"];
assert.ok(internal.w_bezier_low <= internal.w_bezier_high);
assert.ok(internal.w_bezier_high - internal.w_bezier_low <= 2 ** -20);
assert.ok(bezierX(internal.w_bezier_low, curve) <= u + 2 ** -23);
assert.ok(bezierX(internal.w_bezier_high, curve) >= u - 2 ** -23);
```

- [ ] **Step 2: Establish a feasibility gate before changing the solver**

Implement a pure-JavaScript prototype inside the test file for safeguarded Newton plus bisection. It must count float32 adds/multiplies and bracket evaluations. Require it to beat 20-step bisection for the normal curve set without exceeding 20-step work on flat curves, while certifying the width. If this test cannot pass, stop this task and keep the current solver; record `bezier: no safe runtime win under 2^-20 bracket guarantee` as a diagnostic. Do not weaken the guarantee.

- [ ] **Step 3: Write the failing generated-structure test only if the gate passes**

Require candidate, derivative, bracket update, and fallback providers, and require the normal curve command count to fall below the Task 1 baseline.

- [ ] **Step 4: Generate the proven solver exactly**

Translate the float32 prototype operation-for-operation into providers. A Newton candidate may be accepted only when finite, inside the current bracket, and when the prototype proves the resulting certified interval reduction. Otherwise perform the ordinary midpoint step. Preserve endpoint and curve-validation paths unchanged.

- [ ] **Step 5: Verify or deliberately retain the current implementation**

Run: `node --test tests/bezier-cost.test.mjs tests/bezier.test.mjs tests/runtime-cost.test.mjs tests/static.test.mjs`

If the feasibility gate passed, expected: PASS with a lower normal-path budget and an equal-or-lower bad-condition budget. If it did not pass, expected: PASS with the original generated solver unchanged and an explicit diagnostic.

- [ ] **Step 6: Full verification and checkpoint**

Run: `node --test`

Run: `node tools/generate-math-providers.mjs --check`

If code changed and commits are authorized, commit with message `perf: reduce certified bezier solve work`. If the gate rejected the change, commit only the test/diagnostic if authorized.

---

### Task 6: exact remainder/modulo の直接開始型縮約

**Files:**
- Modify: `tools/generate-math-providers.mjs`
- Modify: `tools/generated-math-files.json` (generated)
- Create: `tests/remainder-cost.test.mjs`
- Modify: `tests/arithmetic.test.mjs`
- Modify: `tests/runtime-cost.test.mjs`
- Regenerate: `.common/reduce_remainder` and its providers/predicates

**Interfaces:**
- Consumes internal magnitudes `x = |a|`, `y = |b|`
- Produces exact magnitude `x = |a| % |b|`
- Consumes Task 3 exponent classifier for both magnitudes
- Produces `w_remainder_shift`, `w_remainder_scaled_divisor`
- Reused by `remainder`, `modulo`, and period normalization

- [ ] **Step 1: Add bit-exact adversarial tests and recursion budgets**

Reuse `exactRemainderReference` and `exactModuloReference`. Add exponent-gap pairs including `finiteLimit % smallestFloat`, adjacent powers of two, equal operands, divisor larger than dividend, and 50,000 deterministic finite pairs. Compare bit patterns, not decimal tolerances.

```js
assert.equal(bitsFromFloat(actual), bitsFromFloat(expected), `${a} % ${b}`);
```

Require the maximum dynamic command count for a wide exponent gap to be below the Task 1 baseline by at least the removed ascent work.

- [ ] **Step 2: Verify the cost budget fails with recursive doubling**

Run: `node --test tests/remainder-cost.test.mjs tests/arithmetic.test.mjs`

Expected: exactness PASS, cost FAIL.

- [ ] **Step 3: Generate a balanced starting-divisor selector**

Normalize `x` and `y` separately and subtract their classified exponents to obtain a candidate shift in `0..276`. Use a balanced lookup on that integer shift to select up to three finite power-of-two multipliers, each no larger than `2 ** 127`. Apply them as staged writes so a JSON numeric constant never overflows. If the resulting divisor is greater than `x`, halve it once. Store the corrected shift and divisor in `w_remainder_shift` and `w_remainder_scaled_divisor`.

```js
const remainderX = storage("math:internal", "x");
const remainderY = storage("math:internal", "y");
const shifts = Array.from({ length: 277 }, (_, shift) => ({
  shift,
  factors: [Math.min(shift, 127), Math.min(Math.max(shift - 127, 0), 127), Math.max(shift - 254, 0)]
    .filter(bits => bits > 0)
    .map(bits => 2 ** bits),
}));
const storedShift = storage("math:internal", "w_remainder_shift");
const shiftBands = shifts.map(entry => ({ ...entry, maximum: entry.shift }));
for (let stage = 0; stage < 3; stage += 1) {
  emit(`common/reduce_remainder/factor_${stage}`, balancedRangeLookup(
    shiftBands,
    storedShift,
    entry => entry.factors[stage] ?? 1,
  ));
}
```

- [ ] **Step 4: Replace ascent/descent recursion with descent only**

The start function selects the scaled divisor. The reducer conditionally subtracts it, halves it, and recurses until it reaches the original divisor. Preserve the early paths `x < y`, `x == y`, and doubling overflow.

- [ ] **Step 5: Regenerate and verify exactness plus shared trig behavior**

Run: `node tools/generate-math-providers.mjs`

Run: `node --test tests/remainder-cost.test.mjs tests/arithmetic.test.mjs tests/transcendental.test.mjs tests/runtime-cost.test.mjs tests/static.test.mjs`

Expected: all bit comparisons PASS; `remainder`, `modulo`, and large-angle trig command counts improve or remain below their phase baselines.

- [ ] **Step 6: Full verification and checkpoint**

Run: `node --test`

Run: `node tools/generate-math-providers.mjs --check`

If commits are authorized, commit with message `perf: start exact remainder at the leading shift`.

---

### Task 7: power の早期分岐と境界式の再利用

**Files:**
- Modify: `tools/generate-math-providers.mjs`
- Modify: `tools/generated-math-files.json` (generated)
- Create: `tests/power-cost.test.mjs`
- Modify: `tests/transcendental.test.mjs`
- Modify: `tests/runtime-cost.test.mjs`
- Regenerate: power functions/providers/predicates

**Interfaces:**
- Consumes: optimized common `log` and `exp`
- Produces materialized boundary fields `w_power_log_high`, `w_power_log_low`, `w_power_product_high`, `w_power_product_low`, `w_power_delta`
- Maintains relative/scaled error `<= 5e-5` and current error classification

- [ ] **Step 1: Add path-separation and boundary-neighbor tests**

Require ordinary `power(3, 2.5)` not to call `power/9.classify_overflow`; require threshold-adjacent cases to call it exactly once. Enumerate the previous/current/next float around bases and exponents that place `b * log(|a|)` around the finite overflow threshold. Preserve current success/failure classification and accuracy.

- [ ] **Step 2: Add a failing node and command budget**

Measure the expanded nodes of every active `power/classify/**` provider and dynamic commands for ordinary, negative-integer, near-overflow, underflow, and nonfinite-result paths. Set each new ceiling below the corresponding Task 1 or post-Task-3 baseline.

- [ ] **Step 3: Move cheap classifications before log/exp evaluation**

Generate the path order as:

```text
validate -> zero -> negative-base integer/parity -> cheap definite range
         -> ordinary log/exp -> narrow overflow boundary classifier only when needed
```

Do not calculate any high/low polynomial stage before `needs_overflow_classification` succeeds.

- [ ] **Step 4: Materialize boundary subexpressions once**

Keep the current high/low algorithm and coefficients. Rewrite providers so a stage reads only the preceding materialized fields. Ensure `powerClassifyOverflow` writes each of the five interface fields once and predicates read the stored `w_power_delta` rather than embedding the classifier expression.

- [ ] **Step 5: Attempt degree reduction only behind an exhaustive gate**

In `tests/power-cost.test.mjs`, compare the current classifier and each shorter candidate over all existing 1,500+ boundary cases plus adjacent binary32 values. A candidate is eligible only with zero success/failure misclassifications and error `<= 5e-5`. If no candidate qualifies, retain the current degree and accept only staging/early-branch improvements.

- [ ] **Step 6: Regenerate and run focused verification**

Run: `node tools/generate-math-providers.mjs`

Run: `node --test tests/power-cost.test.mjs tests/transcendental.test.mjs tests/runtime-cost.test.mjs tests/static.test.mjs`

Expected: PASS; ordinary path clearly improves; boundary path does not regress and its provider-node total decreases.

- [ ] **Step 7: Run final project verification**

Run: `node --test`

Run: `node tools/generate-math-providers.mjs --check`

If a local Snapshot 10 server fixture is configured, run its existing integration command and record the output. Do not download a server or dependencies without separate authorization.

- [ ] **Step 8: Produce the final before/after report and checkpoint**

Update the explicit budgets in `tests/runtime-cost.test.mjs` to the verified final ceilings. Report each function in the same simple format requested by the user: function name, final load class, normal command count, worst command count, and provider-node maximum. Do not label entries only as “improved”.

If commits are authorized, commit with message `perf: reduce power boundary work`.

---

## Final Acceptance Checklist

- [ ] `node --test` passes without skipped numeric guarantee tests.
- [ ] `node tools/generate-math-providers.mjs --check` passes.
- [ ] Every target has an explicit normal and worst-path budget or an approved no-change feasibility result.
- [ ] `remainder` and `modulo` remain bit-exact.
- [ ] README error/accuracy contracts and public inputs remain unchanged.
- [ ] Generated manifest contains no retired duplicate paths.
- [ ] Pack byte growth is reported beside runtime savings.
- [ ] Unrelated user changes are absent from every phase diff/checkpoint.

