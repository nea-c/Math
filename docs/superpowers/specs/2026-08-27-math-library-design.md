# Minecraft 26.3 Math Library Design

## Goal

Expand the existing Minecraft Java Edition 26.3 data pack from a division prototype into a reusable float-based math library. The library provides common arithmetic, rounding, power, logarithmic, trigonometric, angle-conversion, comparison, and interpolation functions through a consistent storage API.

## Platform

- Target: Minecraft Java Edition 26.3 Snapshot 10.
- Data pack format: `118`.
- Calculation primitive: `minecraft:number_provider`, evaluated through the 26.3 `compute` command and `data ... set compute` source.
- Numeric model: Java 32-bit `float`, matching `NumberProvider#getFloat` and float-mode aggregate evaluation.
- Generated providers must not require a runtime mod or server plugin.

## Public API

Callers place inputs in `storage math:` and invoke a public function in the `math` namespace.

### Public storage fields

| Field | Purpose |
|---|---|
| `a` | Primary input or left operand |
| `b` | Secondary input or right operand |
| `min` | Lower bound for `clamp` |
| `max` | Upper bound for `clamp` |
| `t` | Interpolation amount for `lerp` |
| `ans` | Successful result |
| `error` | Error identifier when evaluation fails |

Unary functions consume `a`. Binary functions consume `a` and `b`. `clamp` consumes `a`, `min`, and `max`. `lerp` consumes `a`, `b`, and `t`.

Public input fields are never modified. A successful call removes a stale `error`, writes a float to `ans`, and returns function result `1`. A failed call removes a stale `ans`, writes an error identifier to `error`, and returns function result `0`.

### Internal storage

All scratch state lives in the separate `storage math:internal` storage. Reusable providers consume conventional scratch fields:

| Field | Purpose |
|---|---|
| `x` | Primary provider input |
| `y` | Secondary provider input, scale, or period |
| `z` | Intermediate result |
| `w` | Additional intermediate result |

Scratch fields may remain after a call. They are internal and have no stability guarantee.

## Public functions

### Arithmetic

- `add`
- `subtract`
- `multiply`
- `divide`
- `reciprocal`
- `remainder`
- `modulo`

`remainder(a, b) = a - truncate(a / b) * b`.

`modulo(a, b) = a - floor(a / b) * b`.

### Comparison and limiting

- `absolute`
- `sign`
- `minimum`
- `maximum`
- `clamp`

`clamp` fails when `min > max`.

### Rounding

- `floor`
- `ceil`
- `round`
- `truncate`

All rounding functions store an integer-valued float in `ans`. `round(a)` is defined as `floor(a + 0.5)`, matching Java `Math.round(float)`: `1.5` becomes `2`, and `-1.5` becomes `-1`.

### Powers, roots, exponentials, and logarithms

- `square`
- `cube`
- `square_root`
- `power`
- `exp`
- `log`

`power(a, b)` supports real exponents for positive `a` using `exp(b * log(a))`. A negative `a` is supported only when `b` is an integer. `power(0, 0)` returns `1`; zero raised to a positive exponent returns `0`; zero raised to a negative exponent fails.

### Trigonometry

- `sin`
- `cos`
- `tan`
- `sin_degrees`
- `cos_degrees`
- `tan_degrees`

The unqualified functions consume radians. The `_degrees` variants consume degrees. Inputs are reduced by their mathematical period before polynomial evaluation. The reduction folds the approximation domain to approximately `[-pi/2, pi/2]`. Values near exact quadrant boundaries are snapped to the corresponding exact values where doing so is mathematically safe.

### Angle conversion

- `rad`: degrees to radians
- `deg`: radians to degrees

### Constants

- `pi`
- `tau`
- `e`

Each constant function ignores input and writes its named float constant to `ans`.

### Interpolation

- `lerp`: `a + (b - a) * t`

## Error behavior

The initial error identifiers are:

- `division_by_zero`
- `negative_square_root`
- `undefined_tangent`
- `non_real_result`
- `zero_to_negative_power`
- `invalid_clamp_range`
- `invalid_number`
- `result_out_of_range`

`divide`, `reciprocal`, `remainder`, and `modulo` reject a zero divisor. `square_root` rejects negative input. `tan` and `tan_degrees` report `undefined_tangent` when the absolute cosine of the reduced angle is at most `0.00001`. Non-finite inputs report `invalid_number`. A result that cannot be represented as a finite float reports `result_out_of_range`.

## Accuracy targets

- Exact/provider-native operations use normal float semantics.
- The corrected reciprocal supports positive and negative finite inputs whenever the mathematical reciprocal is representable as a finite float.
- `sin` and `cos` have absolute error at most `0.00001` for radian inputs in `[-100, 100]` and degree inputs in `[-5000, 5000]`.
- Larger trigonometric inputs are accepted, but precision degrades as the float input loses phase information.
- `square_root`, `log`, and `exp` target relative error at most `0.00001` over their documented finite result ranges.
- `power` targets relative error at most `0.00005` when its mathematical result is finite and real.
- `tan` is not assigned an error bound near its poles; the undefined threshold above applies instead.

The generator and tests define the exact sampled domains used to verify these bounds. Boundary values, adjacent float values around decision points, signed values, zero, subnormal values, and randomized normal float values are included.

## Provider architecture

Public `.mcfunction` files are thin wrappers responsible for copying public inputs to `storage math:internal`, clearing stale outputs, checking errors, evaluating providers, and returning success or failure. Intermediate values and multi-stage evaluation are allowed. Arithmetic itself remains expressed through reusable number providers.

Shared mathematical components live below `number_provider/common/`. Function-specific approximations live below their function name. Large generated graphs are split into subdirectories by responsibility and then into numerically named files. Filename suffix groupings such as `reduce_01.json` are not used.

Representative layout:

```text
data/math/number_provider/
|-- common/
|   |-- constant/
|   |   |-- pi.json
|   |   |-- tau.json
|   |   `-- e.json
|   |-- normalize/
|   |   |-- period/
|   |   `-- power_of_two/
|   |-- absolute/
|   `-- reciprocal/
|       |-- 00.json
|       |-- normalize/
|       `-- approximate/
|-- sin/
|   |-- 00.json
|   `-- polynomial/
|-- cos/
|   `-- 00.json
`-- log/
    |-- 00.json
    `-- polynomial/
```

`00.json` is the entry point for a multi-file provider. References use paths such as `math:common/reciprocal/00` and `math:sin/polynomial/00`.

Common providers use `storage math:internal` as their argument convention. Period normalization receives the value in `x` and the period in `y`, permitting reuse by radian and degree trigonometric functions. Power-of-two normalization is shared where its numerical behavior and accuracy contract are identical. Function-specific polynomial coefficients are not generalized merely because their generated JSON has a similar shape.

## Reciprocal migration

The existing reciprocal provider is accurate for positive divisors of at least approximately `0.0001`, but it does not correctly support negative or sufficiently small divisors and maps zero to a finite value. Its provider graph will move from `math:reciprocal/*` to `math:common/reciprocal/*` and retain useful approximation stages.

The revised wrapper and graph add:

- explicit zero rejection;
- sign extraction and restoration;
- magnitude normalization or scaling for small finite values;
- finite-result detection;
- preservation of public `a` and `b`.

## Generation and repository contents

Large provider graphs are deterministic generated artifacts. A dependency-free generator checked into the repository owns constants, polynomial coefficients, range partitions, file splitting, and provider references. Generated files state that they are generated and identify the generator command.

The repository contains:

- the data pack;
- the provider generator;
- lightweight static and numerical tests;
- API and accuracy documentation.

The repository does not contain a Minecraft server JAR, EULA file, test world, generated server logs, or other server runtime state.

## Verification

Verification has three layers:

1. Static validation checks JSON syntax, all provider and function references, generated-file consistency, and data pack format `118`.
2. Numerical validation evaluates the provider graph with float rounding after every aggregate operation and compares boundary and randomized cases against reference math functions. It reports maximum absolute or relative error and fails when a documented bound is exceeded.
3. Integration validation launches the official 26.3 Snapshot 10 server in an operating-system temporary directory, loads the data pack into a temporary world, exercises public functions, and checks function return values plus `ans` and `error`. All server runtime files are deleted after validation and never written into the repository.

## Documentation

The README documents installation, the public storage contract, every public function, error identifiers, input domains, precision guarantees, scratch-storage behavior, examples, provider generation, and verification commands.

## Out of scope

The first release does not include inverse trigonometric functions, complex numbers, arbitrary-precision arithmetic, or accuracy guarantees for trigonometric inputs beyond the documented ranges.
