# Inverse Trigonometry and Quaternion-to-Axis-Angle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add public inverse sine/cosine APIs and a sign-preserving, safely normalized quaternion-to-Minecraft-axis-angle conversion.

**Architecture:** Bring the existing Elastic inverse-sine assets under the deterministic generator, then generalize that private positive-domain solver into public radian/degree wrappers. Build quaternion conversion as a dedicated public wrapper that validates a four-element numeric list, scale-normalizes the quaternion and vector part, reuses the internal inverse-cosine calculation, and assembles a typed axis-angle compound in `ans`.

**Tech Stack:** Minecraft Java Edition 26.3 Snapshot 10 datapack format 118, `compute`, `minecraft:number_provider`, generated `.mcfunction`/JSON assets, Node.js `node:test`, PowerShell official-server integration harness.

**Spec:** `docs/superpowers/specs/2026-08-29-inverse-trigonometry-quaternion-axis-angle-design.md`

## Global Constraints

- Target Minecraft Java Edition 26.3 Snapshot 10 and data pack format `118`.
- Add no runtime, npm, mod, plugin, or server dependency.
- Public callers use only `#math:<name>` function tags and `storage math:`.
- Preserve every public input; use only `storage math:internal` fields whose root begins with `x`, `y`, `z`, or `w` for scratch state.
- Successful scalar calls clear `error`, write float `ans`, and return `1`; failures remove `ans`, write the specified error ID, and return `0`.
- `quaternion_to_axis_angle` is the sole public function that writes compound `ans:{angle:<float>,axis:[<float>,<float>,<float>]}`.
- The quaternion conversion accepts any numeric NBT element type, converts to binary32, rejects malformed/non-finite/all-zero input as `invalid_quaternion`, and does not change `rotation`.
- Preserve quaternion sign and return angles in `[0,2*pi]`; do not canonicalize to `[0,pi]`.
- Generated assets are changed through `tools/generate-math-providers.mjs`, never by independently editing their emitted files.
- Keep unrelated working-tree changes out of every commit.

---

### Task 1: Put the existing Elastic inverse-sine graph under generator ownership

**Files:**
- Modify: `tests/static.test.mjs`
- Modify: `tools/generate-math-providers.mjs`
- Modify: `tools/generated-math-files.json`
- Regenerate: `Math/data/math/function/.common/asin_positive/*.mcfunction`
- Regenerate: `Math/data/math/function/.common/_error/invalid_elastic.mcfunction`
- Regenerate: `Math/data/math/function/elastic/*.mcfunction`
- Regenerate: `Math/data/math/function/elastic_decay/*.mcfunction`
- Regenerate: `Math/data/math/number_provider/common/asin_positive/*.json`
- Regenerate: `Math/data/math/number_provider/elastic/**/*.json`
- Regenerate: `Math/data/math/number_provider/elastic_decay/**/*.json`
- Regenerate: `Math/data/math/number_provider/internal/comparison/finite/{amplitude,damping,oscillations,period}.json`
- Regenerate: `Math/data/math/number_provider/internal/comparison/predicate/{elastic,elastic_decay}/**/*.json`
- Regenerate: `Math/data/math/predicate/internal/asin_positive/*.json`
- Regenerate: `Math/data/math/predicate/internal/{elastic,elastic_decay}/*.json`
- Regenerate: `Math/data/math/tags/function/{elastic,elastic_decay}.json`
- Test: `tests/elastic.test.mjs`

**Interfaces:**
- Consumes: the checked-in Elastic behavior and the existing `FUNCTION_PATHS.asinPositive`, `asinPositiveSolve`, `asinPositiveStep`, `elasticPhase`, `elasticFinish`, and `elasticDecayFinish` paths.
- Produces: byte-identical or behavior-identical Elastic assets listed in `tools/generated-math-files.json` and reproducible by `node tools/generate-math-providers.mjs`.

- [ ] **Step 1: Add a failing generator-ownership assertion**

In `tests/static.test.mjs`, load `tools/generated-math-files.json` and assert representative existing assets are owned:

```js
test("elastic and inverse-sine assets are generator-owned", () => {
  const manifest = JSON.parse(fs.readFileSync("tools/generated-math-files.json", "utf8"));
  for (const file of [
    "Math/data/math/function/.common/asin_positive/0.start.mcfunction",
    "Math/data/math/function/elastic/0.start.mcfunction",
    "Math/data/math/function/elastic_decay/0.start.mcfunction",
    "Math/data/math/number_provider/common/asin_positive/midpoint.json",
    "Math/data/math/tags/function/elastic.json",
  ]) assert.ok(manifest.files.includes(file), `${file} must be generated`);
});
```

- [ ] **Step 2: Run the ownership test to verify RED**

Run: `node --test --test-name-pattern="generator-owned" tests/static.test.mjs`

Expected: FAIL because the current manifest omits the Elastic and `asin_positive` paths.

- [ ] **Step 3: Re-express the existing assets in the generator**

Add generator declarations for the current public inputs (`amplitude`, `period`, `oscillations`, `damping`), their finite validators and staged predicates, the Elastic/Elastic Decay providers, and all current wrappers. Generate the positive-domain inverse-sine helpers from the existing algorithm:

```js
emit("common/asin_positive/half_pi", halfPi);
emit("common/asin_positive/midpoint", product(0.5, sum(
  storage("math:internal", "w_asin_low"),
  storage("math:internal", "w_asin_high"),
)));
emit("common/asin_positive/compare", floatComparison(
  sum(
    storage("math:internal", "w_asin_sine"),
    product(-1, storage("math:internal", "w_asin_target")),
  ),
  0,
));
```

Emit the fixed 20-step solve loop through `FUNCTION_PATHS`, and reproduce the existing validation, exact endpoint, interpolation, and error behavior. Do not change `tests/elastic.test.mjs` expectations in this migration.

- [ ] **Step 4: Regenerate and verify behavior**

Run: `node tools/generate-math-providers.mjs`

Run: `node --test tests/elastic.test.mjs tests/static.test.mjs tests/function-layout.test.mjs`

Expected: PASS, and the manifest contains every migrated path.

- [ ] **Step 5: Commit the ownership migration**

```powershell
git add -- tools/generate-math-providers.mjs tools/generated-math-files.json tests/static.test.mjs Math/data/math
git commit -m "build: generate elastic math assets"
```

---

### Task 2: Add public inverse sine and inverse cosine

**Files:**
- Create: `tests/inverse-trigonometry.test.mjs`
- Modify: `tests/function-layout.test.mjs`
- Modify: `tests/runtime-cost.test.mjs`
- Modify: `tools/function-layout.mjs`
- Modify: `tools/generate-math-providers.mjs`
- Modify: `tools/generated-math-files.json`
- Create through generator: `Math/data/math/tags/function/{asin,asin_degrees,acos,acos_degrees}.json`
- Create through generator: `Math/data/math/function/{asin,asin_degrees,acos,acos_degrees}/0.start.mcfunction`
- Create through generator: `Math/data/math/function/.common/{asin,acos}/*.mcfunction`
- Create through generator: `Math/data/math/number_provider/common/inverse_trigonometry/**/*.json`
- Create through generator: `Math/data/math/predicate/internal/inverse_trigonometry/*.json`
- Create through generator: `Math/data/math/number_provider/internal/comparison/predicate/inverse_trigonometry/**/*.json`

**Interfaces:**
- Consumes: `storage math: a` and the positive-magnitude solver; internal magnitude input is `math:internal x` in `[0,1]` and its radian result is returned in `x`.
- Produces: public `#math:asin`, `#math:asin_degrees`, `#math:acos`, and `#math:acos_degrees`; a private inverse-cosine entry point that consumes normalized `x` in `[-1,1]` and returns radians in `x` for Task 4.

- [ ] **Step 1: Write failing public behavior and accuracy tests**

Create `tests/inverse-trigonometry.test.mjs` with a helper that checks return value, stale cleanup, preservation of `a`, float typing, and absolute angular error:

```js
function assertInverse(name, input, reference, tolerance) {
  const result = runFunction(name, { a: Math.fround(input), ans: 91, error: "stale_error" });
  assert.equal(result.returned, 1);
  assert.equal(result.storage["math:"].error, undefined);
  assert.equal(result.storage["math:"].a, Math.fround(input));
  assert.equal(result.numericTags.get(storageFieldKey("math:", "ans")), "float");
  assert.ok(Math.abs(result.storage["math:"].ans - reference) <= tolerance);
}
```

Exercise `-1`, `-0.5`, `-0`, `0`, `0.5`, `1`, adjacent floats around both endpoints, and 10,000 deterministic binary32 samples in `[-1,1]`. Use `Math.asin`, `Math.acos`, and degree conversion as references. Require exact stored binary32 results at the documented `-1`, `0`, and `1` endpoints. Assert `non_real_result` plus stale-`ans` removal for the first floats outside `[-1,1]`; assert `invalid_number` for `NaN` and infinities.

- [ ] **Step 2: Update layout tests and verify RED**

Add the four names to `PUBLIC_FUNCTION_NAMES`, expected paths to the layout test, and private paths such as:

```js
asin: ".common/asin/0.start",
acos: ".common/acos/0.start",
```

Run: `node --test tests/inverse-trigonometry.test.mjs tests/function-layout.test.mjs`

Expected: FAIL because the tags and generated implementations do not exist.

- [ ] **Step 3: Generalize the internal solver and emit public wrappers**

Keep the 20-step positive-magnitude bisection shared with Elastic. Implement signs and quadrants around that solver:

```text
asin(x) = -asin(-x), x < 0
acos(x) = pi/2 - asin(x), x >= 0
acos(x) = pi/2 + asin(-x), x < 0
```

Handle `-1`, `0`, and `1` before bisection so the stored endpoint constants are exact. Validate finite input before range predicates; values outside `[-1,1]` remove `ans`, set `non_real_result`, and return failure. Emit degree wrappers by applying the existing `common/conversion/deg` provider to the final radian result.

- [ ] **Step 4: Regenerate and make numerical tests GREEN**

Run: `node tools/generate-math-providers.mjs`

Run: `node --test tests/inverse-trigonometry.test.mjs tests/elastic.test.mjs tests/function-layout.test.mjs tests/static.test.mjs`

Expected: PASS; Elastic retains its prior tolerance and all four new functions meet `(pi/2)*2^-20` radians plus binary32-rounding allowance.

- [ ] **Step 5: Add deterministic runtime budgets**

In `tests/runtime-cost.test.mjs`, add baseline/boundary inputs for the four names and budgets measured from two identical harness runs. Also assert the public wrappers call the shared `.common/asin/0.start` or `.common/acos/0.start` implementation rather than duplicating 20 bisection steps.

Run: `node --test tests/runtime-cost.test.mjs`

Expected: PASS with identical command counts on repeated runs and explicit headroom above the observed counts.

- [ ] **Step 6: Commit inverse trigonometry**

```powershell
git add -- tools/function-layout.mjs tools/generate-math-providers.mjs tools/generated-math-files.json tests/function-layout.test.mjs tests/inverse-trigonometry.test.mjs tests/runtime-cost.test.mjs Math/data/math
git commit -m "feat: add inverse trigonometric functions"
```

---

### Task 3: Teach the offline harness structured SNBT output

**Files:**
- Create: `tests/mcfunction-test-harness-structured.test.mjs`
- Modify: `tests/mcfunction-test-harness.mjs`

**Interfaces:**
- Consumes: generated commands of the form `data modify storage <id> <path> set value <SNBT>` and paths containing list indices such as `ans.axis[2]`.
- Produces: `parseGeneratedSnbt(text)` returning `{ value, numericTags }`; bracket-aware `getPath`, `setPath`, and `removePath`; nested numeric tag keys such as `math:|ans.axis[0]`.

- [ ] **Step 1: Write parser and path tests that fail**

Export `parseGeneratedSnbt` for focused tests and assert parsing of the exact output template:

```js
const parsed = parseGeneratedSnbt("{angle:0.0f,axis:[0.0f,0.0f,0.0f]}");
assert.deepEqual(parsed.value, { angle: 0, axis: [0, 0, 0] });
assert.deepEqual([...parsed.numericTags.entries()], [
  ["angle", "float"],
  ["axis[0]", "float"],
  ["axis[1]", "float"],
  ["axis[2]", "float"],
]);
```

Also test nested read/write/removal through `ans.axis[1]` and preservation/deletion of nested numeric type tags when a parent is overwritten or removed.

- [ ] **Step 2: Run focused tests to verify RED**

Run: `node --test tests/mcfunction-test-harness-structured.test.mjs`

Expected: FAIL because `parseGeneratedSnbt` and bracket-aware mutation are not implemented.

- [ ] **Step 3: Implement the smallest recursive SNBT subset used by generated code**

Support unquoted compound keys, quoted strings, numeric suffixes `b/f/d`, lists, compounds, commas, and whitespace. Reject trailing input and unsupported tokens with an error containing the original literal. Normalize paths with the same `[(\d+)] -> .$1` rule already used by `getPath`. When setting/removing a parent, clear descendant keys from `numericTags`; when setting structured data, install each relative numeric tag below the destination path.

Replace the separate string/numeric `set value` command branches with one branch:

```js
match = command.match(/^data modify storage (\S+) (\S+) set value (.+)$/);
if (match) {
  const parsed = parseGeneratedSnbt(match[3]);
  setTypedPath(storage, numericTags, match[1], match[2], parsed);
  return undefined;
}
```

- [ ] **Step 4: Verify harness compatibility**

Run: `node --test tests/mcfunction-test-harness-structured.test.mjs tests/functions.test.mjs tests/elastic.test.mjs tests/transcendental.test.mjs`

Expected: PASS; existing scalar string/byte/float/double commands behave unchanged.

- [ ] **Step 5: Commit harness support**

```powershell
git add -- tests/mcfunction-test-harness.mjs tests/mcfunction-test-harness-structured.test.mjs
git commit -m "test: support structured generated NBT"
```

---

### Task 4: Add quaternion-to-axis-angle conversion

**Files:**
- Create: `tests/quaternion.test.mjs`
- Modify: `tests/function-layout.test.mjs`
- Modify: `tests/runtime-cost.test.mjs`
- Modify: `tests/static.test.mjs`
- Modify: `tools/function-layout.mjs`
- Modify: `tools/generate-math-providers.mjs`
- Modify: `tools/generated-math-files.json`
- Create through generator: `Math/data/math/tags/function/quaternion_to_axis_angle.json`
- Create through generator: `Math/data/math/function/quaternion_to_axis_angle/*.mcfunction`
- Create through generator: `Math/data/math/function/.common/_error/invalid_quaternion.mcfunction`
- Create through generator: `Math/data/math/number_provider/quaternion_to_axis_angle/**/*.json`
- Create through generator: `Math/data/math/number_provider/internal/comparison/finite/rotation_{0,1,2,3}.json`
- Create through generator: `Math/data/math/number_provider/internal/comparison/predicate/quaternion_to_axis_angle/**/*.json`
- Create through generator: `Math/data/math/predicate/internal/quaternion_to_axis_angle/*.json`

**Interfaces:**
- Consumes: `storage math: rotation:[x,y,z,w]`, private `FUNCTION_PATHS.acos`, existing square-root and reciprocal internals, and Task 3 structured-output support.
- Produces: public `#math:quaternion_to_axis_angle`, compound `ans`, and `invalid_quaternion` cleanup behavior.

- [ ] **Step 1: Write failing conversion and contract tests**

Create helpers to normalize a reference quaternion and reconstruct it from output:

```js
function reconstruct({ angle, axis }) {
  const half = angle / 2;
  const sine = Math.sin(half);
  return axis.map(component => component * sine).concat(Math.cos(half));
}
```

Assert exact identity contracts for `[0,0,0,1]` and `[0,0,0,-1]`; representative 90-, 180-, and 270-degree rotations; scaled non-unit inputs; and paired `q`/`-q`. For nondegenerate results, verify normalized axis length, angle range, and reconstruction against the normalized input quaternion with tolerance derived from the inverse-cosine interval and binary32 operations. Assert the four components in `rotation` remain unchanged and `ans.angle`/all three `ans.axis` elements carry float tags.

Add scale-safety cases including:

```js
[finiteLimit, finiteLimit, 0, finiteLimit]
[smallestFloat, smallestFloat, 0, smallestFloat]
[smallestFloat, 0, 0, finiteLimit]
```

The last case may round to the scalar endpoint angle, but must not overflow, return NaN, or fail.

- [ ] **Step 2: Write failing invalid-input tests and verify RED**

Test absent `rotation`, lengths `0`, `3`, and `5`, homogeneous nonnumeric lists, each non-finite component position, positive/negative signed zero in all positions, and all-zero mixed numeric types. Every case must return `0`, remove stale scalar or compound `ans`, and set exactly `invalid_quaternion`.

Run: `node --test tests/quaternion.test.mjs tests/function-layout.test.mjs`

Expected: FAIL because the public tag does not exist.

- [ ] **Step 3: Add layout and validation/error generation**

Add `quaternion_to_axis_angle` to `PUBLIC_FUNCTION_NAMES`, `invalidQuaternion` plus focused conversion stages to `FUNCTION_PATHS`, and update exact layout counts/assertions. Emit `rotation[0]` through `rotation[3]` provider inputs and finite checks. The wrapper must:

```text
clear stale error
require rotation[3]
reject rotation[4]
prove all four indexed values numeric with execute store success ... data get
materialize all four as binary32 scratch values
prove all four finite
reject max(abs(component)) == 0
```

All failure branches return through `.common/_error/invalid_quaternion`, which removes `ans`, sets the error string, and returns failure.

- [ ] **Step 4: Implement overflow-safe four-dimensional normalization**

Use generated providers for:

```text
m = max(abs(x), abs(y), abs(z), abs(w))
s_i = q_i / m
length = sqrt(s_x^2 + s_y^2 + s_z^2 + s_w^2)
n_i = s_i / length
```

Reuse the internal reciprocal/square-root calculation paths without copying public inputs into `a` or `b`. At least one `s_i` is `+1` or `-1`; assert via tests that the squared sum stays in `[1,4]`. Clamp only normalized `n_w` to `[-1,1]` before inverse cosine.

- [ ] **Step 5: Implement independent vector normalization and output assembly**

Calculate `vmax=max(abs(s_x),abs(s_y),abs(s_z))`. If `vmax==0`, emit the exact compound template, set `axis=[0,1,0]`, and select angle `0` for positive `w` or `tau` for negative `w`. Otherwise compute:

```text
u_i = s_i / vmax
vlength = sqrt(u_x^2 + u_y^2 + u_z^2)
axis_i = u_i / vlength
angle = 2 * acos(n_w)
```

Initialize the result with:

```mcfunction
data modify storage math: ans set value {angle:0.0f,axis:[0.0f,0.0f,0.0f]}
```

Then write `ans.angle` and `ans.axis[0..2]` through `set compute default` so every leaf is a float. Validate defensive finite results before returning `1`.

- [ ] **Step 6: Regenerate and make quaternion tests GREEN**

Run: `node tools/generate-math-providers.mjs`

Run: `node --test tests/quaternion.test.mjs tests/inverse-trigonometry.test.mjs tests/elastic.test.mjs tests/static.test.mjs tests/function-layout.test.mjs`

Expected: PASS with sign-preserving angles and no regression in Elastic or scalar inverse trigonometry.

- [ ] **Step 7: Add honest command budgets and commit**

Measure repeated harness runs for identity, ordinary 90-degree, non-unit, and invalid-zero paths. Add explicit budgets with headroom and assert the function-call map contains the shared inverse-cosine helper on nondegenerate paths.

Run: `node --test tests/runtime-cost.test.mjs`

Expected: PASS with deterministic counts.

```powershell
git add -- tools/function-layout.mjs tools/generate-math-providers.mjs tools/generated-math-files.json tests/function-layout.test.mjs tests/quaternion.test.mjs tests/runtime-cost.test.mjs tests/static.test.mjs Math/data/math
git commit -m "feat: convert quaternions to axis-angle"
```

---

### Task 5: Document and integration-test the complete API

**Files:**
- Modify: `README.md`
- Modify: `tools/integration-test.ps1`

**Interfaces:**
- Consumes: all five public functions implemented in Tasks 2 and 4.
- Produces: complete user documentation and official-server assertions for values, types, cleanup, and function return codes.

- [ ] **Step 1: Add official-server scalar assertions**

Extend `tools/integration-test.ps1` with exact endpoint cases for `asin`, `asin_degrees`, `acos`, and `acos_degrees`, plus an approximate mid-domain case using `data get ... 1000000`. Add `non_real_result` and `invalid_number` failure cases through `Add-ErrorCase`.

Use exact endpoint examples such as:

```powershell
Add-SuccessCase -Case 'asin_zero' -Function 'asin' -ExpectedAnswer '0.0f' -Setup @(
    'data modify storage math: a set value 0.0f'
)
Add-SuccessCase -Case 'acos_degrees_one' -Function 'acos_degrees' -ExpectedAnswer '0.0f' -Setup @(
    'data modify storage math: a set value 1.0f'
)
```

- [ ] **Step 2: Add official-server structured quaternion assertions**

Add a dedicated success assertion instead of routing compound output through scalar `Add-SuccessCase`. Call `#math:quaternion_to_axis_angle` with `[0.0f,0.70710677f,0.0f,-0.70710677f]`, assert return `1`, absent stale `error`, preserved `rotation`, compound/list shape, float leaf types via exact NBT matching, axis approximately `+Y`, and angle approximately `3*pi/2`. Add all-zero and malformed-list failures expecting `invalid_quaternion` and no `ans`.

- [ ] **Step 3: Update README public contract and examples**

Document:

- the four inverse-trigonometric functions and radian/degree output units;
- input domain `[-1,1]`, exact endpoint behavior, and `non_real_result`;
- `rotation:[x,y,z,w]` and numeric NBT acceptance;
- the compound `ans` exception;
- safe automatic normalization and `invalid_quaternion`;
- sign-preserving `[0,2*pi]` output and the `q`/`-q` distinction;
- fixed `+Y` axis for scalar quaternions;
- inverse-trigonometric accuracy and a runnable conversion example.

Use only `function #math:<name>` in public examples.

- [ ] **Step 4: Run generator and full offline verification**

Run: `node tools/generate-math-providers.mjs --check`

Run: `node --test`

Expected: both commands exit `0`; no generated diff appears and every offline test passes.

- [ ] **Step 5: Run official server integration when the configured runtime is available**

Run:

```powershell
pwsh -NoProfile -File tools/integration-test.ps1 `
  -MinecraftServerJar "C:\Users\nea\AppData\Local\Temp\minecraft-26.3-snapshot-10-server.jar" `
  -JavaExecutable "C:\Program Files (x86)\Minecraft Launcher\runtime\java-runtime-epsilon\windows-x64\java-runtime-epsilon\bin\java.exe"
```

Expected: exit `0` with the `MATH_TEST_PASS` marker. If the external JAR/runtime is absent, report that integration verification as unavailable; do not substitute a different Minecraft version.

- [ ] **Step 6: Inspect the final scoped diff**

Run: `git status --short`

Run: `git diff --check`

Run: `git diff -- README.md tools/integration-test.ps1 tests tools Math/data/math`

Expected: no whitespace errors and only the five-function feature, prerequisite generator ownership, tests, docs, and generated assets are present.

- [ ] **Step 7: Commit documentation and integration coverage**

```powershell
git add -- README.md tools/integration-test.ps1
git commit -m "docs: document inverse trig and axis-angle APIs"
```

