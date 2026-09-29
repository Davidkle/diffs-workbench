import type { ReactNode } from "react";
import { usePersistentBoolean } from "@/use-persistent-boolean";
import { ChevronDown, ChevronRight, Folder } from "lucide-react";
import type { Branch } from "@/types";
type Props = {
  projectId: string;
  filtering?: boolean;
  branches: Branch[];
  renderBranch: (branch: Branch) => ReactNode;
  prefix?: string;
};
export function BranchTree({
  projectId,
  filtering = false,
  branches,
  renderBranch,
  prefix = "",
}: Props) {
  const leaves = branches.filter(
    (branch) => !branch.name.slice(prefix.length).includes("/"),
  );
  const folders = [
    ...new Set(
      branches
        .filter((branch) => branch.name.slice(prefix.length).includes("/"))
        .map((branch) => branch.name.slice(prefix.length).split("/")[0]),
    ),
  ].sort();
  return (
    <>
      {leaves
        .sort(
          (a, b) =>
            Number(b.current) - Number(a.current) ||
            a.name.localeCompare(b.name),
        )
        .map(renderBranch)}
      {folders.map((folder) => (
        <BranchFolder
          key={folder}
          projectId={projectId}
          path={`${prefix}${folder}`}
          name={folder}
          filtering={filtering}
        >
          <BranchTree
            projectId={projectId}
            filtering={filtering}
            branches={branches.filter((branch) =>
              branch.name.startsWith(`${prefix}${folder}/`),
            )}
            prefix={`${prefix}${folder}/`}
            renderBranch={renderBranch}
          />
        </BranchFolder>
      ))}
    </>
  );
}
function BranchFolder({
  projectId,
  path,
  filtering,
  name,
  children,
}: {
  projectId: string;
  path: string;
  filtering: boolean;
  name: string;
  children: ReactNode;
}) {
  const [savedOpen, setOpen] = usePersistentBoolean(
    projectId,
    "branches",
    path,
  );
  const open = filtering || savedOpen;
  return (
    <div className="branch-folder">
      <button
        className="nav-row"
        onClick={() => !filtering && setOpen(!open)}
        aria-expanded={open}
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Folder size={14} />
        <span>{name}</span>
      </button>
      {open && <div className="branch-folder-children">{children}</div>}
    </div>
  );
}
