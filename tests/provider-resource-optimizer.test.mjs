import test from "node:test";
import assert from "node:assert/strict";
import { optimizeProviderResources } from "../tools/provider-resource-optimizer.mjs";

test("small providers with one JSON consumer are inlined without removing function roots", () => {
  const storage = {
    type: "minecraft:storage",
    storage: "math:internal",
    path: "x",
  };
  const files = [
    {
      kind: "json",
      relativePath: "Math/data/math/context_float_provider/leaf.json",
      value: storage,
    },
    {
      kind: "json",
      relativePath: "Math/data/math/context_float_provider/root.json",
      value: { type: "minecraft:abs", input: "math:leaf" },
    },
    {
      kind: "function",
      relativePath: "Math/data/math/function/example.mcfunction",
      text: "data modify storage math: ans set compute default float math:root\n",
    },
  ];

  const optimized = optimizeProviderResources(files, { maxInlineBytes: 128 });

  assert.deepEqual(optimized, [
    {
      kind: "json",
      relativePath: "Math/data/math/context_float_provider/root.json",
      value: { type: "minecraft:abs", input: storage },
    },
    files[2],
  ]);
});
