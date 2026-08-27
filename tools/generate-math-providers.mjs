import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeGeneratedJson } from "./math-provider-lib.mjs";

const command = "node tools/generate-math-providers.mjs";
const generatedProviders = [];
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function generate(targetRoot) {
  for (const { relativePath, value } of generatedProviders) {
    writeGeneratedJson(targetRoot, relativePath, value);
  }
}

function generatedPaths() {
  return generatedProviders.map(({ relativePath }) => `${relativePath}.json`).sort();
}

function check() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "math-provider-generation-"));
  try {
    generate(tempRoot);
    const manifest = JSON.parse(fs.readFileSync(path.join(root, "tools", "generated-math-files.json"), "utf8"));
    const expectedPaths = generatedPaths();
    if (manifest.command !== command || !Array.isArray(manifest.files)) {
      throw new Error("tools/generated-math-files.json must contain the generator command and a files array");
    }
    if (JSON.stringify(manifest.files) !== JSON.stringify(expectedPaths)) {
      throw new Error("tools/generated-math-files.json does not match the generated provider paths");
    }
    for (const relativePath of expectedPaths) {
      const expected = fs.readFileSync(path.join(tempRoot, ...relativePath.split("/")));
      const actual = fs.readFileSync(path.join(root, ...relativePath.split("/")));
      if (!actual.equals(expected)) {
        throw new Error(`Generated provider differs: ${relativePath}`);
      }
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

try {
  if (process.argv.includes("--check")) {
    check();
  } else {
    generate(root);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
