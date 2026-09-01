# Provider Inline Cleanup Design

## Context

The generated pack still emits small provider resources such as `math:.common/div` even when a single `data modify ... set compute` command is their only consumer. Some of those commands first copy public values into `storage math: internal.*` solely so the provider can read them. Public entry functions also remove `storage math: error`, although the unchecked storage-only API no longer writes or reads that field.

These patterns add registry resources and commands without preserving any required state or control flow.

## Goals

- Inline every small provider whose only consumer is one generated mcfunction `set compute` command.
- Remove public-to-scratch copies when the inlined provider can safely read the public storage value directly.
- Retain scratch values that are reused, observed by control flow, or required to freeze a value before later mutation.
- Remove obsolete `data remove storage math: error` commands from every public entry.
- Apply the rules across the generated pack rather than special-casing `math:.common/div`.
- Preserve the public storage-only API, binary32 behavior, valid-input contract, and official 26.3 Pre-Release 1 compatibility.

## Non-goals

- Do not inline providers without a size bound.
- Do not inline providers referenced by predicates, provider JSON, multiple commands, or non-`set compute` text.
- Do not remove scratch merely because a public value has the same current value; removal requires local data-flow proof.
- Do not change public function tags, input names, output shape, or invalid-input semantics.

## Chosen Approach

Extend the existing provider-resource optimizer with a conservative command-consumer pass. The current optimizer already inlines small providers with exactly one JSON consumer. The new pass will additionally recognize exactly one generated mcfunction consumer when the reference occupies the provider argument of a `data modify ... set compute default float` command.

The optimizer will serialize the provider object as a compact inline provider argument, replace that one reference, and remove the provider JSON. It will not perform an unrestricted textual substitution: the complete compute-command shape must match, and any other text or JSON reference disqualifies the provider.

Provider size will continue to use the existing `maxInlineBytes` budget. Iteration continues to a fixed point so inlining one provider may expose another eligible single-use provider, while the size ceiling prevents unbounded command growth.

## Scratch Bypass

Scratch bypass is a separate, conservative generator/data-flow cleanup:

1. Identify a direct copy from a public storage path to `storage math: internal.<slot>`.
2. Require that the slot is read only by the immediately following provider computation in the same generated function segment.
3. Require no predicate, function call, return condition, second consumer, or intervening write to depend on the slot.
4. Replace the provider's storage read with the original public storage read.
5. Remove the now-unused copy.

For the division path this changes the result computation to an inline native `minecraft:div` provider reading `storage math: a` and `storage math: b` directly. The denominator-zero control-flow check may read `b` directly; it must not stage `b` in `internal.x` merely for that check.

If a candidate cannot satisfy these rules mechanically or through an explicit generator construction, its scratch staging remains. Correct evaluation order takes priority over command reduction.

## Public Entry Cleanup

The shared public preamble will remove only stale `ans`. `error` is no longer part of the runtime contract and no generated resource consumes or writes it, so public entries will not remove it.

Scratch cleanup at the end of controlled public functions remains unchanged.

## Tests and Verification

Implementation follows red-green-refactor:

1. Add a failing optimizer test proving a small provider with exactly one compute-command consumer is inlined and removed.
2. Add failing negative cases proving multiple consumers, JSON consumers, unsupported command shapes, and oversized providers remain resources.
3. Add failing generated-pack assertions proving:
   - `.common/div.json` is absent;
   - `div` computes with an inline `minecraft:div` provider reading public `a` and `b`;
   - division has no redundant `internal.x/y` staging;
   - no public entry removes `storage math: error`;
   - every remaining small provider with a command-only single consumer has a documented reason not to inline;
   - public-to-scratch copies are absent where the copied value has a single immediate provider consumer.
4. Preserve existing counterexamples that require scratch reuse or control-flow observation.
5. Regenerate the pack and update exact runtime-cost expectations only where commands are genuinely removed.
6. Run focused optimizer, arithmetic, static, graph, and cost suites; the complete `node --test` suite; generator `--check`; `git diff --check`; and the official Minecraft 26.3 Pre-Release 1 integration harness.

## Acceptance Criteria

- The public `div` path contains neither a `math:.common/div` reference nor redundant public-to-`internal.x/y` copies.
- `.common/div.json` is not generated or listed in the manifest.
- No public entry contains `data remove storage math: error`.
- The generalized single-command-consumer optimizer is covered by positive and negative regression tests.
- No eligible equivalent redundancy remains in generated resources under the conservative rules above.
- All offline and official-server verification passes without weakening numerical tolerances or storage-cleanup assertions.
