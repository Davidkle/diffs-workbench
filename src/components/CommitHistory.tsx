import { useMemo, useRef, type KeyboardEvent, type MouseEvent } from "react";
import { Check, GitBranch } from "lucide-react";
import type { Commit } from "@/types";
import { selectRange } from "@/selection";
import { commitGraph } from "@/commit-graph";

const graphColors = [
  "#ff9d00",
  "#f0cf58",
  "#6fc5a4",
  "#79b6ed",
  "#c39bef",
  "#ed97b5",
];
const laneX = (column: number) => 9 + column * 12;

type Props = {
  commits: Commit[];
  branch: string;
  selected: string[];
  onSelect: (ids: string[]) => void;
};

export function CommitHistory({ commits, branch, selected, onSelect }: Props) {
  const anchor = useRef<string | undefined>(undefined);
  const list = useRef<HTMLDivElement>(null);
  const ids = commits.map((commit) => commit.hash);
  const graph = useMemo(() => commitGraph(commits), [commits]);
  const graphWidth = graph.columns * 12 + 6;
  const choose = (id: string, event: MouseEvent | KeyboardEvent) => {
    const additive = event.metaKey || event.ctrlKey;
    const next = selectRange(
      ids,
      selected,
      id,
      anchor.current,
      event.shiftKey,
      additive,
    );
    if (!event.shiftKey || !anchor.current) anchor.current = id;
    onSelect(next);
  };
  const onKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
      event.preventDefault();
      anchor.current ??= ids[index];
      onSelect(ids);
    } else if (event.key === "Escape") {
      event.preventDefault();
      anchor.current = undefined;
      onSelect([]);
    } else if (["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? ids.length - 1
            : Math.max(
                0,
                Math.min(
                  ids.length - 1,
                  index + (event.key === "ArrowDown" ? 1 : -1),
                ),
              );
      const rows =
        list.current?.querySelectorAll<HTMLButtonElement>('[role="option"]');
      rows?.[next]?.focus({ preventScroll: true });
      rows?.[next]?.scrollIntoView({ block: "nearest", inline: "nearest" });
      if (!event.metaKey && !event.ctrlKey) choose(ids[next], event);
    } else if (event.key === " ") {
      event.preventDefault();
      choose(ids[index], event);
    }
  };
  return (
    <div
      ref={list}
      className="commit-list"
      role="listbox"
      aria-label="Commit history"
      aria-multiselectable="true"
    >
      {commits.map((commit, index) => (
        <button
          key={commit.hash}
          role="option"
          aria-selected={selected.includes(commit.hash)}
          tabIndex={commit.hash === (selected[0] || ids[0]) ? 0 : -1}
          className={`commit-row ${selected.includes(commit.hash) ? "selected" : ""}`}
          onClick={(event) => choose(commit.hash, event)}
          onKeyDown={(event) => onKey(event, index)}
        >
          <svg
            className="commit-graph"
            width={graphWidth}
            viewBox={`0 0 ${graphWidth} 28`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {graph.rows[index].edges.map((edge, edgeIndex) => {
              const x1 = laneX(edge.from);
              const x2 = laneX(edge.to);
              const y1 = edge.half === "top" ? 0 : 14;
              const y2 = edge.half === "top" ? 14 : 28;
              return (
                <path
                  key={edgeIndex}
                  d={`M ${x1} ${y1} C ${x1} ${(y1 + y2) / 2} ${x2} ${(y1 + y2) / 2} ${x2} ${y2}`}
                  stroke={graphColors[edge.color % graphColors.length]}
                  strokeWidth={1.5}
                  fill="none"
                />
              );
            })}
            <circle
              cx={laneX(graph.rows[index].column)}
              cy={14}
              r={graph.rows[index].merge ? 4 : 2.5}
              fill={
                graph.rows[index].merge
                  ? "var(--workspace-surface)"
                  : graphColors[graph.rows[index].color % graphColors.length]
              }
              stroke={graphColors[graph.rows[index].color % graphColors.length]}
              strokeWidth={1.5}
            />
          </svg>
          <span className="commit-subject">
            {commit.refs && (
              <span className="branch-label" title={commit.refs}>
                {commit.refs.includes("HEAD") ? (
                  <Check size={12} />
                ) : (
                  <GitBranch size={10} />
                )}
                {commit.refs.includes("HEAD")
                  ? branch
                  : commit.refs.split(",")[0]}
              </span>
            )}
            {commit.subject}
          </span>
          <span className="commit-author">
            <span className="avatar">
              {commit.author
                .split(" ")
                .map((name) => name[0])
                .slice(0, 2)
                .join("")}
            </span>
            {commit.author}
          </span>
          <code>{commit.short}</code>
          <time title={commit.date}>
            {new Date(commit.date).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </time>
        </button>
      ))}
      {!commits.length && (
        <div className="history-empty">
          No commits yet. Your local changes appear below.
        </div>
      )}
    </div>
  );
}
