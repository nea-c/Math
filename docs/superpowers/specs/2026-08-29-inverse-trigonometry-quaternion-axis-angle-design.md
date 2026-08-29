# Inverse Trigonometry and Quaternion-to-Axis-Angle Design

## Goal

Extend the Minecraft Java Edition 26.3 math data pack with public inverse sine and inverse cosine functions and a quaternion-to-axis-angle conversion suitable for display entity transformations.

The conversion accepts a quaternion list, safely normalizes any nonzero finite quaternion, preserves its sign, and returns Minecraft's axis-angle compound shape. Preserving the sign means the returned angle covers `[0, 2*pi]` instead of canonicalizing every rotation to its shortest `[0, pi]` representation.

## Public API

Add these public function tags:

- `#math:asin`
- `#math:asin_degrees`
- `#math:acos`
- `#math:acos_degrees`
- `#math:quaternion_to_axis_angle`

### Inverse trigonometric functions

All four inverse trigonometric functions read a finite numeric value from `storage math: a` without modifying it.

- `asin` returns the inverse sine in radians in `storage math: ans`.
- `asin_degrees` returns the inverse sine in degrees in `storage math: ans`.
- `acos` returns the inverse cosine in radians in `storage math: ans`.
- `acos_degrees` returns the inverse cosine in degrees in `storage math: ans`.

Their input domain is `[-1, 1]`. Inputs outside that domain fail with the existing `non_real_result` error. Missing, nonnumeric, or non-finite inputs fail with `invalid_number` under the existing public validation convention.

On success, each function removes a stale `error`, writes a float `ans`, and returns function result `1`. On failure, it removes a stale `ans`, writes the error ID, and returns function result `0`.

### Quaternion conversion

`quaternion_to_axis_angle` reads this public input:

```snbt
rotation:[x,y,z,w]
```

Each component may use any numeric NBT type and is converted to binary32 for calculation. The input list must contain exactly four finite numeric elements. The function does not modify `rotation`.

On success it writes:

```snbt
ans:{angle:<float>,axis:[<float>,<float>,<float>]}
```

`angle` is in radians and lies in `[0, 2*pi]`. `axis` is a normalized three-component float list. This extends the public storage contract so `ans` is normally a float but is an axis-angle compound for `quaternion_to_axis_angle`.

Malformed lists, nonnumeric components, non-finite components, and the all-zero quaternion fail with the new `invalid_quaternion` error. Failure follows the standard cleanup and function-result contract.

## Numerical Design

### Inverse sine and cosine

Generalize the existing internal positive-domain inverse-sine solver, which currently supports Elastic interpolation, into a shared internal component. The solver continues to use 20 bisection steps over `[0, pi/2]` and reuses the existing sine implementation for comparisons.

Public `asin` handles `[-1, 1]` using odd symmetry. Public `acos` shares the same magnitude solver and uses the appropriate quadrant identity so its result covers `[0, pi]`. Exact inputs `-1`, `0`, and `1` return exact stored constants for their mathematical results: endpoints, zero, `pi/2`, or `pi` as applicable.

The degree variants reuse the radian calculation and convert only the final result. They do not duplicate the approximation graph.

The documented inverse-trigonometric accuracy guarantee is an angular interval no wider than `(pi/2) * 2^-20` radians before the final binary32 rounding and, for degree variants, the corresponding converted interval.

### Safe quaternion normalization

Let the input quaternion be `q = [x, y, z, w]`. Directly summing component squares can overflow for large finite floats or underflow for small finite floats. The conversion therefore computes:

1. `m = max(abs(x), abs(y), abs(z), abs(w))`.
2. Reject the quaternion when `m == 0`.
3. Scale each component by `m`.
4. Compute the scaled four-dimensional length and divide the scaled components by it.

At least one scaled component has magnitude `1`, so the length calculation remains in a safe numeric range. Clamp the normalized `w` to `[-1, 1]` only to absorb binary32 rounding at the boundary.

### Axis and angle extraction

For normalized `w`, calculate:

```text
angle = 2 * acos(w)
```

Do not negate quaternions whose `w` is negative. Consequently, `q` and `-q` describe the same spatial orientation but intentionally produce complementary axis-angle representations in `[0, 2*pi]`.

Normalize the vector part independently and safely. Compute the maximum absolute value of the scaled `x`, `y`, and `z`, scale the vector by that maximum, and normalize the result. This second scaling prevents underflow when the vector part is tiny compared with `w`.

If the vector part is exactly zero, its axis is mathematically undefined. Return the deterministic axis `[0.0f, 1.0f, 0.0f]`. A positive scalar quaternion returns angle `0`; a negative scalar quaternion returns angle `2*pi`.

Representative sign-preserving behavior is:

```text
[0,  0.7071, 0,  0.7071] -> axis [0,  1, 0], angle pi/2
[0, -0.7071, 0, -0.7071] -> axis [0, -1, 0], angle 3*pi/2
```

## Implementation Structure

Keep public `.mcfunction` files as validation and storage-contract wrappers. Move reusable inverse-sine magnitude solving and inverse-cosine composition under the internal/common provider and function hierarchy. The quaternion wrapper invokes those internal components directly rather than calling the public `#math:acos` tag, avoiding public scratch-value mutation and unnecessary dispatch.

The deterministic generator owns all new generated number providers, predicates, functions, tags, and its manifest entries. Generated assets are not edited independently of the generator.

Update the README with:

- the five new public functions;
- the `rotation` input field;
- the compound `ans` exception;
- inverse-trigonometric domains and units;
- sign-preserving quaternion behavior;
- `invalid_quaternion` conditions;
- accuracy guarantees and examples.

No external runtime or package dependency is added.

## Error Behavior

The new functions preserve the library's existing stale-output cleanup rules.

- `invalid_number`: a scalar inverse-trigonometric input is missing, nonnumeric, or non-finite.
- `non_real_result`: an inverse-trigonometric scalar input is outside `[-1, 1]`.
- `invalid_quaternion`: `rotation` is not an exact four-element numeric list, contains a non-finite component, or all four components are zero.
- `result_out_of_range`: retained as a defensive failure if an intermediate contract unexpectedly produces a non-finite public result.

## Verification

### Static and generated-asset tests

- Confirm all five public function tags resolve to valid functions.
- Confirm provider, predicate, and function references are complete.
- Confirm generator output and the generated-file manifest are deterministic.
- Confirm public wrappers follow input-preservation, stale-output cleanup, and return-value conventions.
- Track representative command cost to catch accidental dispatch or graph regressions.

### Offline numerical tests

For `asin` and `acos`, cover `-1`, `-0.5`, signed zero, `0.5`, `1`, adjacent binary32 boundary values, out-of-domain values, and randomized samples. Compare radian and degree variants with host reference functions and enforce the documented bisection accuracy.

For quaternion conversion, cover:

- identity and negative identity;
- 90-, 180-, and 270-degree rotations;
- non-unit quaternions;
- paired `q` and `-q` inputs;
- arbitrary numeric NBT element types;
- finite components near binary32 minimum and maximum magnitudes;
- malformed list lengths, nonnumeric elements, non-finite elements, and all-zero input;
- stale `ans` and `error` cleanup.

Reconstruct a quaternion from each nondegenerate axis-angle result and verify that it matches the normalized input quaternion within the documented binary32 tolerance. Degenerate scalar quaternions are checked against their explicit fixed-axis contract.

### Official server integration

Extend the temporary-world integration assertions with representative success and failure cases for every new public function. Verify the exact NBT output shape and numeric element types of the axis-angle compound, as well as function return values and storage cleanup.

## Out of Scope

- Quaternion-to-Euler conversion.
- Axis-angle-to-quaternion conversion.
- Quaternion multiplication, interpolation, or a general public vector API.
- Canonicalization to the shortest `[0, pi]` rotation.
- Changing display entities directly; callers remain responsible for copying entity transformation NBT into and out of `storage math:`.
