import { ContextMenu, type ContextAction } from "@/components/ui/context-menu";
import { usePersistentBoolean } from "@/use-persistent-boolean";
import {
  ChevronDown,
  ChevronRight,
  FileCode2,
  Folder,
  FolderOpen,
} from "lucide-react";
import type { ChangedFile } from "@/types";
type Node = {
  name: string;
  path: string;
  children: Map<string, Node>;
  file?: ChangedFile;
};
export function FileTree({
  projectId,
  files,
  selected,
  onSelect,
  filter,
  onDoubleClick,
  contextActions,
}: {
  projectId: string;
  files: ChangedFile[];
  selected: string;
  onSelect: (path: string) => void;
  filter: string;
  onDoubleClick?: (path: string) => void;
  contextActions?: (path: string) => ContextAction[];
}) {
  const root: Node = { name: "", path: "", children: new Map() };
  for (const file of files.filter((f) =>
    f.path.toLowerCase().includes(filter.toLowerCase()),
  )) {
    let node = root;
    const parts = file.path.split("/");
    parts.forEach((name, i) => {
      if (!node.children.has(name))
        node.children.set(name, {
          name,
          path: parts.slice(0, i + 1).join("/"),
          children: new Map(),
        });
      node = node.children.get(name)!;
      if (i === parts.length - 1) node.file = file;
    });
  }
  return (
    <div
      className="file-tree"
      role="tree"
      aria-label="Files"
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

        const items = [
          ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
            ".tree-item-select",
          ),
        ];
        if (!items.length) return;
        const focused = event.target
          .closest(".tree-row")
          ?.querySelector(".tree-item-select");
        const current = items.findIndex((item) =>
          focused ? item === focused : item.dataset.path === selected,
        );
        const index =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? items.length - 1
              : current < 0
                ? event.key === "ArrowUp"
                  ? items.length - 1
                  : 0
                : Math.max(
                    0,
                    Math.min(
                      items.length - 1,
                      current + (event.key === "ArrowDown" ? 1 : -1),
                    ),
                  );
        const next = items[index];
        event.preventDefault();
        event.stopPropagation();
        onSelect(next.dataset.path!);
        next.focus({ preventScroll: true });
        next.scrollIntoView({ block: "nearest", inline: "nearest" });
      }}
    >
      {[...root.children.values()].sort(sortNodes).map((node) => (
        <TreeNode
          key={node.path}
          projectId={projectId}
          filtering={!!filter.trim()}
          node={node}
          depth={0}
          selected={selected}
          onSelect={onSelect}
          onDoubleClick={onDoubleClick}
          contextActions={contextActions}
        />
      ))}
    </div>
  );
}
function sortNodes(a: Node, b: Node) {
  return Number(!!a.file) - Number(!!b.file) || a.name.localeCompare(b.name);
}
function TreeNode({
  projectId,
  filtering,
  node,
  depth,
  selected,
  onSelect,
  onDoubleClick,
  contextActions,
}: {
  projectId: string;
  filtering: boolean;
  node: Node;
  depth: number;
  selected: string;
  onSelect: (path: string) => void;
  onDoubleClick?: (path: string) => void;
  contextActions?: (path: string) => ContextAction[];
}) {
  const [savedOpen, setOpen] = usePersistentBoolean(
    projectId,
    "files",
    node.path,
  );
  const open = filtering || savedOpen;
  const isFolder = !node.file;
  const row = (
    <div
      className={`tree-row ${selected === node.path ? "selected" : ""}`}
      style={{ paddingLeft: isFolder ? 0 : 12 + depth * 16 }}
      onKeyDown={(event) => {
        if (
          event.defaultPrevented ||
          event.altKey ||
          event.ctrlKey ||
          event.metaKey ||
          event.shiftKey ||
          !isFolder ||
          (event.key !== "ArrowLeft" && event.key !== "ArrowRight")
        )
          return;

        event.preventDefault();
        event.stopPropagation();
        if (!filtering) setOpen(event.key === "ArrowRight");
      }}
    >
      {isFolder && (
        <button
          type="button"
          className="tree-chevron"
          style={{
            width: 36 + depth * 16,
            paddingLeft: 18 + depth * 16,
            marginLeft: -6,
          }}
          aria-label={`${open ? "Collapse" : "Expand"} ${node.name}`}
          aria-expanded={open}
          onClick={(event) => {
            event.stopPropagation();
            if (!filtering) setOpen(!open);
          }}
          onDoubleClick={(event) => event.stopPropagation()}
        >
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
      )}
      <button
        type="button"
        className="tree-item-select"
        data-path={node.path}
        onClick={() => onSelect(node.path)}
        title={node.file?.directory ? `${node.path} (directory)` : node.path}
        onDoubleClick={() => onDoubleClick?.(node.path)}
      >
        {isFolder ? (
          <>
            {open ? (
              <FolderOpen className="folder" size={15} />
            ) : (
              <Folder className="folder" size={15} />
            )}
          </>
        ) : (
          <>
            <span className={`status-badge status-${node.file?.status || "N"}`}>
              {node.file?.status || "·"}
            </span>
            {node.file?.directory ? (
              <Folder size={15} className="folder" />
            ) : (
              <FileCode2 size={14} className="file-icon" />
            )}
          </>
        )}
        <span className="truncate">{node.name}</span>
        {node.file?.staged && <span className="staged-dot" title="Staged" />}
      </button>
    </div>
  );
  return (
    <div
      role="treeitem"
      aria-expanded={isFolder ? open : undefined}
      aria-selected={selected === node.path}
    >
      {contextActions ? (
        <ContextMenu
          items={contextActions(node.path)}
          onOpen={() => onSelect(node.path)}
        >
          {row}
        </ContextMenu>
      ) : (
        row
      )}
      {isFolder && open && (
        <div role="group">
          {[...node.children.values()].sort(sortNodes).map((child) => (
            <TreeNode
              key={child.path}
              projectId={projectId}
              filtering={filtering}
              node={child}
              depth={depth + 1}
              selected={selected}
              onSelect={onSelect}
              onDoubleClick={onDoubleClick}
              contextActions={contextActions}
            />
          ))}
        </div>
      )}
    </div>
  );
}
