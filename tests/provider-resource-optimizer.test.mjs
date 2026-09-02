import test from "node:test";
import assert from "node:assert/strict";
import { optimizeProviderResources } from "../tools/provider-resource-optimizer.mjs";

test("small providers with one JSON consumer remain external through command roots", () => {
  const files = [
    {
      kind: "json",
      relativePath: "Math/data/math/context_float_provider/leaf.json",
      value: { type: "minecraft:constant", value: 1 },
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
    files[0],
    {
      ...files[2],
      text: `data modify storage math: ans set compute default float ${JSON.stringify({ type: "minecraft:abs", input: "math:leaf" })}\n`,
    },
  ]);
});

test("small providers with a JSON consumer remain external", () => {
  const provider = {
    kind: "json",
    relativePath: "Math/data/math/context_float_provider/leaf.json",
    value: { type: "minecraft:constant", value: 1 },
  };
  const jsonConsumer = {
    kind: "json",
    relativePath: "Math/data/math/context_float_provider/root.json",
    value: { type: "minecraft:abs", input: "math:leaf" },
  };
  const command = {
    kind: "function",
    relativePath: "Math/data/math/function/example.mcfunction",
    text: "data modify storage math: ans set compute default float math:root\n",
  };

  assert.deepEqual(optimizeProviderResources([provider, jsonConsumer, command], { maxInlineBytes: 128 }), [provider, {
    ...command,
    text: `data modify storage math: ans set compute default float ${JSON.stringify({ type: "minecraft:abs", input: "math:leaf" })}\n`,
  }]);
});

test("guarded compute-command consumers are recognized", () => {
  const provider = {
    kind: "json",
    relativePath: "Math/data/math/context_float_provider/leaf.json",
    value: { type: "minecraft:constant", value: 1 },
  };
  const command = {
    kind: "function",
    relativePath: "Math/data/math/function/example.mcfunction",
    text: "execute as @s at @s run data modify storage math: ans set compute default float math:leaf\n",
  };

  assert.deepEqual(optimizeProviderResources([provider, command], { maxInlineBytes: 256 }), [{
    ...command,
    text: "execute as @s at @s run data modify storage math: ans set compute default float {\"type\":\"minecraft:constant\",\"value\":1}\n",
  }]);
});

test("small provider with one compute-command consumer is inlined", () => {
  const provider = {
    kind: "json",
    relativePath: "Math/data/math/context_float_provider/quotient.json",
    value: { type: "minecraft:constant", value: 1 },
  };
  const command = {
    kind: "function",
    relativePath: "Math/data/math/function/div/0.start.mcfunction",
    text: "data modify storage math: ans set compute default float math:quotient\n",
  };

  assert.deepEqual(optimizeProviderResources([provider, command], { maxInlineBytes: 256 }), [{
    ...command,
    text: "data modify storage math: ans set compute default float {\"type\":\"minecraft:constant\",\"value\":1}\n",
  }]);
});

test("providers with disqualified command references remain unchanged", () => {
  const cases = [
    {
      name: "two compute commands",
      texts: [
        "data modify storage math: x set compute default float math:leaf\n",
        "data modify storage math: y set compute default float math:leaf\n",
      ],
    },
    {
      name: "unsupported text position",
      texts: ["say math:leaf\n"],
    },
  ];

  for (const { name, texts } of cases) {
    const provider = {
      kind: "json",
      relativePath: "Math/data/math/context_float_provider/leaf.json",
      value: { type: "minecraft:constant", value: 1 },
    };
    const commands = texts.map((text, index) => ({
      kind: "function",
      relativePath: `Math/data/math/function/${name.replaceAll(" ", "-")}-${index}.mcfunction`,
      text,
    }));
    assert.deepEqual(optimizeProviderResources([provider, ...commands], { maxInlineBytes: 256 }), [provider, ...commands], name);
  }
});

test("JSON consumer and oversized providers remain unchanged", () => {
  const provider = {
    kind: "json",
    relativePath: "Math/data/math/context_float_provider/leaf.json",
    value: { type: "minecraft:constant", value: 123456789 },
  };
  const jsonConsumer = {
    kind: "json",
    relativePath: "Math/data/math/context_float_provider/root.json",
    value: { input: "math:leaf" },
  };
  const command = {
    kind: "function",
    relativePath: "Math/data/math/function/example.mcfunction",
    text: "data modify storage math: ans set compute default float math:root\n",
  };

  assert.deepEqual(optimizeProviderResources([provider, jsonConsumer, command], { maxInlineBytes: 8 }), [provider, jsonConsumer, command]);
});

test("provider over 128 bytes stays external despite larger requested limit", () => {
  const provider = {
    kind: "json",
    relativePath: "Math/data/math/context_float_provider/large.json",
    value: { type: "minecraft:constant", value: "this value makes the serialized provider exceed one hundred twenty-eight bytes by a comfortable margin for the regression" },
  };
  const command = {
    kind: "function",
    relativePath: "Math/data/math/function/example.mcfunction",
    text: "data modify storage math: ans set compute default float math:large\n",
  };

  assert.ok(Buffer.byteLength(JSON.stringify(provider.value)) > 128);
  assert.deepEqual(optimizeProviderResources([provider, command], { maxInlineBytes: 256 }), [provider, command]);
});

test("provider-like IDs in guarded prefixes disqualify command inlining", () => {
  const prefixProvider = {
    kind: "json",
    relativePath: "Math/data/math/context_float_provider/prefix.json",
    value: { type: "minecraft:constant", value: 1 },
  };
  const commandProvider = {
    kind: "json",
    relativePath: "Math/data/math/context_float_provider/command.json",
    value: { type: "minecraft:constant", value: 2 },
  };
  const command = {
    kind: "function",
    relativePath: "Math/data/math/function/example.mcfunction",
    text: "execute if score @s math:prefix run data modify storage math: ans set compute default float math:command\n",
  };

  assert.deepEqual(optimizeProviderResources([prefixProvider, commandProvider, command], { maxInlineBytes: 256 }), [prefixProvider, commandProvider, command]);
});
