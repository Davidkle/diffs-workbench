import { useState } from "react";
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
  files,
  selected,
  onSelect,
  filter,
}: {
  files: ChangedFile[];
  selected: string;
  onSelect: (path: string) => void;
  filter: string;
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
    <div className="file-tree" role="tree" aria-label="Files">
      {[...root.children.values()].sort(sortNodes).map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          depth={0}
          selected={selected}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
function sortNodes(a: Node, b: Node) {
  return Number(!!a.file) - Number(!!b.file) || a.name.localeCompare(b.name);
}
function TreeNode({
  node,
  depth,
  selected,
  onSelect,
}: {
  node: Node;
  depth: number;
  selected: string;
  onSelect: (path: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const isFolder = !node.file;
  return (
    <div
      role="treeitem"
      aria-expanded={isFolder ? open : undefined}
      aria-selected={!isFolder ? selected === node.path : undefined}
    >
      <button
        className={`tree-row ${selected === node.path ? "selected" : ""}`}
        style={{ paddingLeft: 12 + depth * 16 }}
        onClick={() => (isFolder ? setOpen(!open) : onSelect(node.path))}
        title={node.path}
      >
        {isFolder ? (
          <>
            {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}{" "}
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
            <FileCode2 size={14} className="file-icon" />
          </>
        )}
        <span className="truncate">{node.name}</span>
        {node.file?.staged && <span className="staged-dot" title="Staged" />}
      </button>
      {isFolder && open && (
        <div role="group">
          {[...node.children.values()].sort(sortNodes).map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selected={selected}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
