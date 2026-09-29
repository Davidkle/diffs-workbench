import { useRef, type KeyboardEvent, type MouseEvent } from "react";
import { GitBranch } from "lucide-react";
import type { Commit } from "@/types";
import { selectRange } from "@/selection";

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
      rows?.[next]?.focus();
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
          <span className={`graph-node graph-${index % 3}`}>
            <span />
          </span>
          <span className="commit-subject">
            {commit.refs && (
              <span className="branch-label" title={commit.refs}>
                <GitBranch size={10} />
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
