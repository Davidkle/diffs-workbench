import { test } from "node:test";
import assert from "node:assert/strict";
import { selectRange } from "./selection.js";
const ids = ["a", "b", "c", "d", "e"];
test("commit selection replaces, toggles, extends and unions ranges", () => {
  assert.deepEqual(selectRange(ids, ["a", "c"], "b", "a", false, false), ["b"]);
  assert.deepEqual(selectRange(ids, ["a"], "d", "a", false, true), ["a", "d"]);
  assert.deepEqual(selectRange(ids, ["a", "d"], "a", "d", false, true), ["d"]);
  assert.deepEqual(selectRange(ids, ["d"], "b", "d", true, false), [
    "b",
    "c",
    "d",
  ]);
  assert.deepEqual(selectRange(ids, ["a"], "e", "c", true, true), [
    "a",
    "c",
    "d",
    "e",
  ]);
  assert.deepEqual(selectRange(ids, ["a"], "c", "missing", true, false), ["c"]);
  assert.deepEqual(selectRange(ids, ["a"], "missing", "a", true, false), ["a"]);
});
