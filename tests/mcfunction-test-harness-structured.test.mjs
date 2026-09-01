import test from "node:test";
import assert from "node:assert/strict";
import {
  copyTypedPath,
  evaluateGeneratedProvider,
  getPath,
  parseGeneratedSnbt,
  removeTypedPath,
  runFunctionFromSnbt,
  setPath,
  setTypedPath,
  storageFieldKey,
} from "./mcfunction-test-harness.mjs";

test("generated providers read scratch through nested internal storage", () => {
  const result = evaluateGeneratedProvider("math:.common/add", {}, { x: 1.25, y: 2.5 });
  assert.equal(result, 3.75);
});

test("typed public SNBT inputs retain numeric tag types while functions execute", () => {
  const result = runFunctionFromSnbt("sign", "{a:1.0d}");
  assert.equal(result.returned, undefined);
  assert.equal(result.numericTags.get(storageFieldKey("math:", "a")), "double");
  assert.equal(result.numericTags.get(storageFieldKey("math:", "ans")), "float");
});

test("parseGeneratedSnbt parses the generated axis-angle literal and numeric tags", () => {
  const parsed = parseGeneratedSnbt("{angle:0.0f,axis:[0.0f,0.0f,0.0f]}");
  assert.deepEqual(parsed.value, { angle: 0, axis: [0, 0, 0] });
  assert.deepEqual([...parsed.numericTags.entries()], [
    ["angle", "float"],
    ["axis[0]", "float"],
    ["axis[1]", "float"],
    ["axis[2]", "float"],
  ]);
});

test("parseGeneratedSnbt supports generated nested strings and rejects trailing literals", () => {
  assert.deepEqual(
    parseGeneratedSnbt(' { label : "axis" , values : [ 1b , -2.5d ] } ').value,
    { label: "axis", values: [1, -2.5] },
  );
  assert.throws(
    () => parseGeneratedSnbt("{angle:0.0f} trailing"),
    /\{angle:0\.0f\} trailing/,
  );
});

test("parseGeneratedSnbt preserves every numeric NBT tag type", () => {
  const parsed = parseGeneratedSnbt("{values:[1b,1s,1,1l,1.0f,1.0d]}");
  assert.deepEqual(parsed.value.values, [1, 1, 1, 1, 1, 1]);
  assert.deepEqual([...parsed.numericTags.values()], ["byte", "short", "int", "long", "float", "double"]);
});

test("bracket-aware paths read and write nested list values", () => {
  const storage = { ans: { axis: [0, 0, 0] } };
  setPath(storage, "ans.axis[1]", 7);
  assert.equal(getPath(storage, "ans.axis[1]"), 7);
});

test("typed paths install structured numeric tags and clear descendants on overwrite or removal", () => {
  const storage = {};
  const numericTags = new Map();
  const axisAngle = parseGeneratedSnbt("{angle:0.0f,axis:[0.0f,0.0f,0.0f]}");

  setTypedPath(storage, numericTags, "math:", "ans", axisAngle);
  assert.equal(numericTags.get("math:|ans.axis[1]"), "float");

  setTypedPath(storage, numericTags, "math:", "ans.axis[1]", parseGeneratedSnbt("1b"));
  assert.equal(getPath(storage, "ans.axis[1]"), 1);
  assert.equal(numericTags.get("math:|ans.axis[1]"), "byte");
  assert.equal(numericTags.get("math:|ans.angle"), "float");
  assert.equal(numericTags.get("math:|ans.axis[0]"), "float");
  assert.equal(numericTags.get("math:|ans.axis[2]"), "float");

  setTypedPath(storage, numericTags, "math:", "ans", parseGeneratedSnbt('"replaced"'));
  assert.equal(numericTags.has("math:|ans.axis[0]"), false);
  assert.equal(numericTags.has("math:|ans.axis[1]"), false);

  setTypedPath(storage, numericTags, "math:", "ans", axisAngle);
  removeTypedPath(storage, numericTags, "math:", "ans");
  assert.equal(numericTags.has("math:|ans.angle"), false);
  assert.equal(numericTags.has("math:|ans.axis[2]"), false);
});

test("typed paths keep bracket notation when installing root-list numeric tags", () => {
  const storage = {};
  const numericTags = new Map();
  setTypedPath(storage, numericTags, "math:", "curve", parseGeneratedSnbt("[0.0f,1.0f]"));
  assert.equal(numericTags.get("math:|curve[0]"), "float");
  assert.equal(numericTags.get("math:|curve[1]"), "float");
});

test("structured set from storage retains list-child numeric tag paths", () => {
  const storage = {};
  const numericTags = new Map();
  setTypedPath(storage, numericTags, "math:", "ans", parseGeneratedSnbt("{axis:[0.0f,1.0f]}"));

  copyTypedPath(storage, numericTags, "math:", "destination", "math:", "ans.axis", getPath(storage, "ans.axis"));

  assert.deepEqual(storage.destination, [0, 1]);
  assert.equal(numericTags.get("math:|destination[0]"), "float");
  assert.equal(numericTags.get("math:|destination[1]"), "float");
});

test("removing an indexed list path splices values and reindexes numeric tags", () => {
  const storage = {};
  const numericTags = new Map();
  setTypedPath(storage, numericTags, "math:", "ans", parseGeneratedSnbt("{axis:[{value:0.0f},{value:1.0f},{value:2.0f}]}"));

  removeTypedPath(storage, numericTags, "math:", "ans.axis[1]");

  assert.deepEqual(storage.ans.axis, [{ value: 0 }, { value: 2 }]);
  assert.equal(numericTags.get("math:|ans.axis[0].value"), "float");
  assert.equal(numericTags.get("math:|ans.axis[1].value"), "float");
  assert.equal(numericTags.has("math:|ans.axis[2].value"), false);
});
