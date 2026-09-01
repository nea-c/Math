# Task 2 report: Remove obsolete public error cleanup

## RED

Command:

```powershell
node --test --test-name-pattern="public entries" tests/static.test.mjs
```

Result: failed as expected. The first public entry (`abs/0.start`) contained the retired cleanup, producing `true !== false` for `abs/0.start must not touch retired error state`.

## GREEN

Commands:

```powershell
node tools/generate-math-providers.mjs
node --test --test-name-pattern="public entries" tests/static.test.mjs
node tools/generate-math-providers.mjs --check
```

Result: all commands succeeded. The focused test passed and generator check exited 0.

## Generated changes

- Removed `data remove storage math: error` from the shared `publicPreamble`.
- Extended the public-entry static test to inspect `PUBLIC_FUNCTION_PATHS`, reject any retired error cleanup, and require stale `ans` cleanup.
- Regenerated function outputs; public entries retain `data remove storage math: ans` and `data remove storage math: internal`.
- Regeneration updated `tools/generated-math-files.json` and function outputs alongside the existing Task 1 optimizer-generated changes. No optimizer interface changes were made.

## Tests

- Focused public-entry test: PASS.
- Generator check: PASS.
- Full `node --test tests/static.test.mjs`: 21 passed, 3 failed in pre-existing/Task 1 generated-resource validation: inline provider JSON is reported as invalid by the graph validator, and several optimized provider files are absent from the working tree while regeneration metadata marks them removed. These failures are outside Task 2's requested public cleanup.

## Files

- `tests/static.test.mjs`
- `tools/generate-math-providers.mjs`
- `tools/generated-math-files.json`
- regenerated `Math/data/math/function/**/*.mcfunction`

## Self-review

The generator has one shared preamble used by both direct and controlled public emitters. The obsolete `error` cleanup is removed there only; stale `ans` and scratch `internal` cleanup remain. The test iterates every public path and checks both invariants.

## Concerns

The full static suite still has the three Task 1-related failures described above. They should be resolved or integrated with the Task 1 generated-resource changes before treating the entire branch as green.

## Integration follow-up

### RED

Added a validator fixture with inline numeric and nested inline JSON providers. Before the validator change:

```powershell
node --test --test-name-pattern="controlled dangling|generator-owned" tests/static.test.mjs
```

The controlled dangling test failed because inline `1.25` and the nested object were reported as invalid provider IDs; the ownership test passed.

### GREEN and verification

The validator now preserves quoted JSON tokens, accepts inline numeric/object providers, and traverses nested named references. The ownership test verifies the quaternion input is represented in the generated compute consumer rather than requiring an optimized-away provider file.

Commands and results:

```powershell
node --test tests/static.test.mjs
# 24 passed, 0 failed
node tools/generate-math-providers.mjs --check
# exit 0
git diff --check
# exit 0
```

### Files and generated outputs

- Modified `tests/static.test.mjs` with inline-provider validator coverage and optimizer-aware quaternion ownership assertions.
- Regenerated and committed all current context-float-provider, predicate, function, function-tag, and manifest outputs, including Task 1 optimizer changes.
- No generator or optimizer interface changes.

### Self-review and concerns

The parser only attempts JSON decoding for provider arguments; unresolved resource IDs continue through the existing registry-reference path. Inline objects are traversed by the existing provider walker, preserving nested dependency checks. The full static suite, generator check, and whitespace check are green. Git line-ending warnings remain environmental only.
