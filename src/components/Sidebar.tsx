import type { ReactNode } from "react";

const rowSelector =
  ".primary-nav > button, .sidebar-filter input, .section-header > button:first-child, .nav-row";

export function Sidebar({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <aside
      className={`sidebar ${className}`}
      onKeyDown={(event) => {
        if (
          event.defaultPrevented ||
          event.altKey ||
          event.ctrlKey ||
          event.metaKey ||
          event.shiftKey ||
          !["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key) ||
          !(event.target instanceof HTMLElement) ||
          !event.currentTarget.contains(event.target)
        )
          return;
        // Keep text editing and portaled menu navigation owned by those controls.
        if (
          event.target.matches("input, textarea, [contenteditable=true]") &&
          !["ArrowUp", "ArrowDown"].includes(event.key)
        )
          return;
        const rows = [
          ...event.currentTarget.querySelectorAll<HTMLElement>(rowSelector),
        ].filter(
          (row) =>
            !row.matches(":disabled, [aria-disabled=true]") &&
            row.getClientRects().length > 0,
        );
        const current = rows.findIndex((row) =>
          row.contains(event.target as HTMLElement),
        );
        if (current < 0) return;
        const index =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? rows.length - 1
              : Math.max(
                  0,
                  Math.min(
                    rows.length - 1,
                    current + (event.key === "ArrowDown" ? 1 : -1),
                  ),
                );
        const next = rows[index];
        event.preventDefault();
        event.stopPropagation();
        next.focus({ preventScroll: true });
        next.scrollIntoView({ block: "nearest", inline: "nearest" });
        // View selection is safe; repository actions still require Enter/Space.
        if (
          index !== current &&
          next.matches(
            ".primary-nav > button, [data-browse-ref], [data-browse-worktree]",
          )
        )
          next.click();
      }}
    >
      {children}
    </aside>
  );
}
