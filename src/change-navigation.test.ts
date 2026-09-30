import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDiffFromFile } from "@pierre/diffs";
import { changeTargets } from "./change-navigation.js";

const targets = (old: string, current: string) =>
  changeTargets(
    parseDiffFromFile(
      { name: "file.ts", contents: old },
      { name: "file.ts", contents: current },
    ),
  );

test("change navigation locates replacements, additions and pure deletions across hunks", () => {
  const old = Array.from({ length: 80 }, (_, i) => `line ${i + 1}\n`);
  const current = [...old];
  current[4] = "replacement\n";
  current.splice(39, 0, "added\n");
  current.splice(60, 1);
  assert.deepEqual(targets(old.join(""), current.join("")), [
    { line: 5, side: "deletions" },
    { line: 40, side: "additions" },
    { line: 60, side: "deletions" },
  ]);
});

test("separate changes in one hunk are separate navigation stops", () => {
  assert.deepEqual(targets("a\nb\nc\nd\ne\n", "a\nB\nc\nD\ne\n"), [
    { line: 2, side: "deletions" },
    { line: 4, side: "deletions" },
  ]);
  assert.deepEqual(targets("same\n", "same\n"), []);
  assert.deepEqual(targets("", "new\n"), [{ line: 1, side: "additions" }]);
  assert.deepEqual(targets("old\n", ""), [{ line: 1, side: "deletions" }]);
});
