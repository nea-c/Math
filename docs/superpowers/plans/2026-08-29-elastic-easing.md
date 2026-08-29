# Elastic Easing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add configurable `elastic` and `elastic_decay` Elastic Out interpolation function tags.

**Architecture:** Both public functions validate and preserve `math:` inputs, clamp time to exact endpoints, compute an easing coefficient in `math:internal`, then interpolate `a` to `b`. `elastic` uses a private shared positive-domain inverse-sine solver for its Penner phase; `elastic_decay` uses the existing common exponential and cosine implementations directly.

**Tech Stack:** Minecraft 26.3 datapack functions, number providers, predicates, Node.js `node:test` harness.

**Spec:** `docs/superpowers/specs/2026-08-29-elastic-easing-design.md`

## Global Constraints

- Public calls are function tags named `#math:elastic` and `#math:elastic_decay`.
- Public inputs remain unchanged and results follow the existing `ans` / `error` / function-result contract.
- `t<=0` returns `a`; `t>=max` returns `b`; `max<=0` returns `invalid_duration`.
- Generic private work belongs below `.common/`; function-specific work stays below its owning public function folder.
- Existing dirty-worktree changes must not be overwritten or included in this feature.

---

### Task 1: Lock the public behavior with failing tests

**Files:**
- Create: `tests/elastic.test.mjs`

**Interfaces:**
- Consumes: `runFunction(name, input)` from `tests/mcfunction-test-harness.mjs`.
- Produces: Executable behavioral requirements for both public tags.

- [ ] **Step 1: Write tests for nominal curves**

Add reference calculations for the Penner `amplitude` / `period` curve and the `oscillations` / `damping` curve, then assert representative intermediate results.

- [ ] **Step 2: Write tests for the shared API contract**

Assert exact clamped endpoints, preserved inputs, cleared stale errors, non-positive duration handling, invalid parameter handling, non-finite input handling, and overflowing-result handling.

- [ ] **Step 3: Run the focused tests to verify RED**

Run: `node --test tests/elastic.test.mjs`

Expected: FAIL because the `elastic` and `elastic_decay` public tags do not exist.

### Task 2: Implement `elastic`

**Files:**
- Create: `Math/data/math/tags/function/elastic.json`
- Create: `Math/data/math/function/elastic/0.start.mcfunction`
- Create: `Math/data/math/function/elastic/1.phase.mcfunction`
- Create: `Math/data/math/function/elastic/2.finish.mcfunction`
- Create: `Math/data/math/function/.common/asin_positive/0.start.mcfunction`
- Create: `Math/data/math/function/.common/asin_positive/1.solve.mcfunction`
- Create: `Math/data/math/function/.common/asin_positive/2.step.mcfunction`
- Create: focused number providers and predicates below `number_provider/elastic/`, `number_provider/common/asin_positive/`, `number_provider/internal/comparison/predicate/elastic/`, and `predicate/internal/elastic/`
- Create: `Math/data/math/function/.common/_error/invalid_elastic.mcfunction`

**Interfaces:**
- Consumes: `math:internal x` in `(0,1]` for `.common/asin_positive/0.start`.
- Produces: `math:internal x=asin(original x)` in `[0,pi/2]`; public `#math:elastic` contract from the spec.

- [ ] **Step 1: Add the public tag, validation, endpoint handling, and providers**

Validate `t/max/a/b/amplitude/period`, require `amplitude>=1` and `period>0`, and route invalid parameters to `invalid_elastic`.

- [ ] **Step 2: Implement positive-domain inverse sine**

Use a fixed-count binary search over `[0,pi/2]`; compare `sin(midpoint)` to the saved input and retain the matching half interval.

- [ ] **Step 3: Evaluate the Elastic Out coefficient and interpolate**

Compute `s=period/tau*asin(1/amplitude)`, evaluate the specified decay and sine expression through existing common helpers, and validate the final binary32 result.

- [ ] **Step 4: Run the focused tests to verify the `elastic` cases are GREEN**

Run: `node --test --test-name-pattern=elastic tests/elastic.test.mjs`

Expected: All `elastic` cases pass; `elastic_decay` cases may remain red until Task 3.

### Task 3: Implement `elastic_decay`

**Files:**
- Create: `Math/data/math/tags/function/elastic_decay.json`
- Create: `Math/data/math/function/elastic_decay/0.start.mcfunction`
- Create: `Math/data/math/function/elastic_decay/1.finish.mcfunction`
- Create: focused number providers and predicates below `number_provider/elastic_decay/`, `number_provider/internal/comparison/predicate/elastic_decay/`, and `predicate/internal/elastic_decay/`

**Interfaces:**
- Consumes: `t`, `max`, `a`, `b`, `oscillations`, `damping` in `storage math:`.
- Produces: public `#math:elastic_decay` contract from the spec.

- [ ] **Step 1: Add validation and exact endpoint handling**

Require finite inputs, `max>0`, `oscillations>0`, and `damping>0`, preserving all public fields.

- [ ] **Step 2: Evaluate the damped cosine curve**

Compute `u=t/max`, `exp(-damping*u)`, `cos(tau*oscillations*u)`, `1-exp*cos`, and finally `a+(b-a)*coefficient`.

- [ ] **Step 3: Run the focused tests to verify GREEN**

Run: `node --test tests/elastic.test.mjs`

Expected: PASS.

### Task 4: Document and verify the complete datapack

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: Both implemented public APIs.
- Produces: User-facing field, function, error, formula, and example documentation.

- [ ] **Step 1: Update README**

Document the four new input fields, both interpolation functions, parameter constraints, formulas, endpoint behavior, `invalid_elastic`, and one usage example.

- [ ] **Step 2: Run focused and full verification**

Run: `node --test tests/elastic.test.mjs`

Run: `node --test tests/*.test.mjs`

Expected: Both commands pass without warnings or failures.

- [ ] **Step 3: Inspect the scoped diff**

Run: `git diff -- README.md tests/elastic.test.mjs Math/data/math/tags/function/elastic.json Math/data/math/tags/function/elastic_decay.json Math/data/math/function/elastic Math/data/math/function/elastic_decay Math/data/math/function/.common/asin_positive Math/data/math/function/.common/_error/invalid_elastic.mcfunction Math/data/math/number_provider/elastic Math/data/math/number_provider/elastic_decay Math/data/math/number_provider/common/asin_positive Math/data/math/number_provider/internal/comparison/predicate/elastic Math/data/math/number_provider/internal/comparison/predicate/elastic_decay Math/data/math/predicate/internal/elastic Math/data/math/predicate/internal/elastic_decay docs/superpowers/specs/2026-08-29-elastic-easing-design.md docs/superpowers/plans/2026-08-29-elastic-easing.md`

Expected: Only the intended feature and documentation changes appear.

