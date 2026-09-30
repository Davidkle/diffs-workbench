import { test } from "node:test";
import assert from "node:assert/strict";
import { commitGraph } from "./commit-graph.js";

const commit = (hash: string, ...parents: string[]) => ({
  hash,
  parents: parents.join(" "),
});

test("linear history has one continuous lane ending at the root", () => {
  const { rows, columns } = commitGraph([
    commit("tip", "middle"),
    commit("middle", "root"),
    commit("root"),
  ]);
  assert.equal(columns, 1);
  assert.equal(rows[0].edges.filter((e) => e.half === "top").length, 0);
  assert.equal(rows[1].edges.length, 2);
  assert.equal(rows[2].edges.filter((e) => e.half === "bottom").length, 0);
  assert.ok(rows.every((row) => row.column === 0 && !row.merge));
});

for (const sideFirst of [true, false]) {
  test(`merge keeps both parents connected with side branch ${sideFirst ? "first" : "last"}`, () => {
    const { rows, columns } = commitGraph([
      commit("merge", "main", "side"),
      ...(sideFirst
        ? [commit("side", "root"), commit("main", "root")]
        : [commit("main", "root"), commit("side", "root")]),
      commit("root"),
    ]);
    assert.equal(columns, 2);
    assert.equal(rows[0].merge, true);
    assert.deepEqual(
      rows[0].edges.map((e) => [e.from, e.to]),
      [
        [0, 0],
        [0, 1],
      ],
    );
    assert.equal(rows[1].column, sideFirst ? 1 : 0);
    assert.equal(rows[2].column, sideFirst ? 0 : 1);
    assert.ok(
      rows[2].edges.some((e) => e.half === "bottom" && e.from !== e.to),
    );
    assert.equal(rows[3].edges.length, 1);
    assert.equal(rows[3].edges[0].half, "top");
  });
}

test("nested and octopus merges preserve every parent and reuse finished lanes", () => {
  const commits = [
    commit("tip", "main", "side", "other"),
    commit("side", "nested", "other"),
    commit("nested", "root"),
    commit("main", "root"),
    commit("other", "root"),
    commit("root"),
    commit("unrelated", "unloaded"),
  ];
  const { rows, columns } = commitGraph(commits);
  assert.equal(columns, 3);
  // Follow every parent edge until it reaches that parent's node; intervening
  // commits must never interrupt a lane belonging to another branch.
  commits.slice(0, 6).forEach((entry, index) => {
    const parentEdges = rows[index].edges.filter(
      (e) => e.half === "bottom" && e.from === rows[index].column,
    );
    const reached = parentEdges.map((edge) => {
      const column = edge.to;
      for (let next = index + 1; next < rows.length; next++) {
        assert.ok(
          rows[next].edges.some((e) => e.half === "top" && e.from === column),
        );
        if (rows[next].column === column) return commits[next].hash;
        assert.ok(
          rows[next].edges.some(
            (e) => e.half === "bottom" && e.from === column && e.to === column,
          ),
        );
      }
      return "missing";
    });
    assert.deepEqual(
      reached.sort(),
      entry.parents.split(" ").filter(Boolean).sort(),
    );
  });
  assert.equal(rows[6].column, 0);
  assert.deepEqual(
    rows[6].edges.map((e) => e.half),
    ["bottom"],
  );
});

test("empty and truncated histories do not invent parents or cut pending lanes", () => {
  assert.deepEqual(commitGraph([]), { rows: [], columns: 1 });
  const { rows, columns } = commitGraph([
    commit("merge", "outside-main", "outside-side"),
  ]);
  assert.equal(columns, 2);
  assert.deepEqual(
    rows[0].edges.map((e) => e.half),
    ["bottom", "bottom"],
  );
});
