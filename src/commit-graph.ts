import type { Commit } from "@/types";

type Lane = { hash: string; color: number };
export type GraphEdge = {
  from: number;
  to: number;
  color: number;
  half: "top" | "bottom";
};
export type GraphRow = {
  column: number;
  color: number;
  merge: boolean;
  edges: GraphEdge[];
};

/** Follow pending parents through a topologically ordered commit list. */
export function commitGraph(commits: Pick<Commit, "hash" | "parents">[]) {
  const lanes: (Lane | null)[] = [];
  let nextColor = 0;
  let columns = 1;
  const rows: GraphRow[] = commits.map((commit) => {
    let column = lanes.findIndex((lane) => lane?.hash === commit.hash);
    const edges: GraphEdge[] = [];
    lanes.forEach((lane, index) => {
      if (lane)
        edges.push({ from: index, to: index, color: lane.color, half: "top" });
    });
    if (column < 0) {
      column = lanes.indexOf(null);
      if (column < 0) column = lanes.length;
      lanes[column] = { hash: commit.hash, color: nextColor++ };
    }
    const color = lanes[column]!.color;
    lanes[column] = null;
    lanes.forEach((lane, index) => {
      if (lane)
        edges.push({
          from: index,
          to: index,
          color: lane.color,
          half: "bottom",
        });
    });
    const parents = [...new Set(commit.parents.split(/\s+/).filter(Boolean))];
    parents.forEach((hash, index) => {
      let target = lanes.findIndex((lane) => lane?.hash === hash);
      if (target < 0) {
        target = index === 0 ? column : lanes.indexOf(null);
        if (target < 0) target = lanes.length;
        lanes[target] = { hash, color: index === 0 ? color : nextColor++ };
      }
      edges.push({
        from: column,
        to: target,
        color: lanes[target]!.color,
        half: "bottom",
      });
    });
    columns = Math.max(columns, lanes.length, column + 1);
    while (lanes.length && lanes[lanes.length - 1] === null) lanes.pop();
    return { column, color, merge: parents.length > 1, edges };
  });
  return { rows, columns };
}
