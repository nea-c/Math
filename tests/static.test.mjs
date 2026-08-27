import test from "node:test";
import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";

test("pack targets data pack format 118", () => {
  const meta = JSON.parse(fs.readFileSync("Math/pack.mcmeta", "utf8"));
  assert.equal(meta.pack.min_format, 118);
  assert.equal(meta.pack.max_format, 118);
});

test("generated providers are current", () => {
  childProcess.execFileSync(process.execPath, ["tools/generate-math-providers.mjs", "--check"], {
    encoding: "utf8",
  });
});

test("normalization dispatchers are chunked with inline non-overlapping value checks", () => {
  assert.equal(fs.existsSync("Math/data/math/number_provider/reciprocal"), false);
  assert.equal(fs.existsSync("Math/data/math/number_provider/divide.json"), false);

  for (const responsibility of ["scale", "exponent"]) {
    const chunkRoot = path.join("Math/data/math/number_provider/common/normalize/power_of_two", responsibility);
    const chunkFiles = fs.readdirSync(chunkRoot).filter((name) => name.endsWith(".json")).sort();
    assert.ok(chunkFiles.length > 0, `${responsibility} must have dispatcher chunks`);
    let previousMaximum = -Infinity;
    for (const chunkFile of chunkFiles) {
      const dispatcher = JSON.parse(fs.readFileSync(path.join(chunkRoot, chunkFile), "utf8"));
      assert.equal(dispatcher.type, "minecraft:number_dispatcher");
      assert.ok(dispatcher.cases.length <= 32, `${responsibility}/${chunkFile} exceeds 32 cases`);
      assert.equal(dispatcher.default, 0);
      for (const dispatcherCase of dispatcher.cases) {
        assert.equal(dispatcherCase.condition.condition, "minecraft:value_check");
        assert.ok(dispatcherCase.condition.range.min > previousMaximum, `${responsibility} cases overlap`);
        previousMaximum = dispatcherCase.condition.range.max;
      }
    }
  }

  for (const provider of [
    "common/reciprocal/normalize/absolute/00.json",
    "common/reciprocal/normalize/mantissa/00.json",
    "common/reciprocal/normalize/factor/00.json",
    "common/reciprocal/normalize/sign/00.json",
    "common/reciprocal/approximate/00.json",
    "common/reciprocal/newton/00/00.json",
    "common/reciprocal/newton/01/00.json",
    "common/reciprocal/newton/02/00.json",
  ]) {
    assert.ok(fs.existsSync(path.join("Math/data/math/number_provider", provider)), `missing ${provider}`);
  }
});
