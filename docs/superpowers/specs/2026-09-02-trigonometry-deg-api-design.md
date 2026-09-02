# Trigonometry Simplification and `*_deg` API Design

## Context

The generated public `sin` and `cos` functions currently copy `storage math: a` into scratch storage, special-case zero, call a shared kernel function, copy the kernel result into `storage math: ans`, and finally clear scratch storage. Their degree variants add another scratch computation before taking the same path. This control flow is redundant because Minecraft's native `sine` and `cosine` context float providers can evaluate the public input expression directly.

The public degree-based trigonometry tags also use the verbose and inconsistent `*_degrees` suffix. The API will standardize these names as `*_deg`.

## Goals

- Make public `sin` and `cos` wrappers compute their result directly with native context float providers.
- Make public `sin_deg` and `cos_deg` wrappers directly compute the radian conversion and trigonometric result as one provider expression.
- Rename every degree-based trigonometry API from `*_degrees` to `*_deg`.
- Remove obsolete generated functions, tags, layout entries, documentation references, and tests for the old names.
- Preserve the existing numerical behavior and storage-only calling convention.

## Non-goals

- Do not add compatibility aliases for the old `*_degrees` names.
- Do not replace the shared `.common/sin` and `.common/cos` kernels while other algorithms still consume them.
- Do not redesign the `tan`, inverse-trigonometry, or `atan2` algorithms beyond renaming their degree-based public entry points and internal paths where applicable.
- Do not change input storage keys, output storage keys, or invalid-value behavior.

## Public API Changes

The following function tags are breaking renames:

| Removed tag | Replacement tag |
| --- | --- |
| `#math:sin_degrees` | `#math:sin_deg` |
| `#math:cos_degrees` | `#math:cos_deg` |
| `#math:tan_degrees` | `#math:tan_deg` |
| `#math:asin_degrees` | `#math:asin_deg` |
| `#math:acos_degrees` | `#math:acos_deg` |
| `#math:atan_degrees` | `#math:atan_deg` |
| `#math:atan2_degrees` | `#math:atan2_deg` |

No old-name tag or forwarding function remains. README examples and all generated/runtime tests use only the replacement names.

## Direct `sin` and `cos` Generation

The generator will emit each public radian wrapper as a direct public function whose sole result computation reads `storage math: a`:

- `sin`: native `minecraft:sine` of the public input provider.
- `cos`: native `minecraft:cosine` of the public input provider.

The direct wrapper retains the shared public-entry behavior for clearing stale `ans`, but it does not allocate `storage math: internal`, call a compute function, call a shared kernel, or perform a separate zero check.

The degree wrappers use the same direct form with a nested multiplication by the existing radians-per-degree constant before applying the native trigonometric provider. The conversion is part of the provider expression, so no converted angle is stored in scratch storage.

The native provider owns zero, non-finite, and other provider-result behavior, matching the library's policy of following vanilla `data ... set compute` semantics.

## Remaining Shared Kernels

The `.common/sin` and `.common/cos` functions remain generated because `tan` and other composite algorithms use their intermediate results. Their existence does not require the public `sin` and `cos` wrappers to route through them.

`tan` and `tan_deg` retain their current compute flow because tangent needs both sine and cosine values before division. Inverse-trigonometry and `atan2` degree variants retain their algorithms and change only their public/internal naming from `Degrees`/`_degrees` to `Deg`/`_deg`.

## Generator and Generated-File Cleanup

The generator's public-function list and function-layout constants will use the new names. The specialized trigonometric wrapper generator will be narrowed to the composite tangent flow; `sin` and `cos` will use direct wrapper generation.

Regeneration removes old `*_degrees` directories and tags through the generated-file manifest cleanup, then creates the new `*_deg` equivalents. Internal layout identifiers will use `Deg` rather than `Degrees` when those identifiers still exist. Removed `sin`/`cos` compute paths must not remain as dead layout entries or empty generated directories.

## Tests and Verification

Implementation follows red-green-refactor:

1. Update or add static generator tests that initially fail until all seven `*_deg` tags exist and no `*_degrees` tag, path, manifest entry, README reference, or test invocation remains.
2. Add generated-output assertions that `sin`, `cos`, `sin_deg`, and `cos_deg` use direct native provider expressions and do not reference scratch storage or secondary compute functions.
3. Preserve numerical coverage for radians, degrees, signed zero, representative quadrants, and invalid/non-finite provider inputs under vanilla semantics.
4. Preserve tangent and inverse-trigonometry numerical tests under their renamed degree APIs.
5. Regenerate the pack and run focused trigonometry/static tests, the complete test suite, generator `--check`, and `git diff --check`.

## Acceptance Criteria

- All seven degree APIs are available only as `*_deg` tags.
- The repository contains no functional or documented `*_degrees` reference.
- Public `sin`, `cos`, `sin_deg`, and `cos_deg` contain no redundant scratch staging, zero branch, shared-kernel call, or secondary compute function.
- Shared sine and cosine kernels remain available to composite internal consumers.
- Generated-file checks and the full automated test suite pass without weakening numerical tolerances.
