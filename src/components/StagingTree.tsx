import { FileTree } from "@/components/FileTree";
import { Button } from "@/components/ui/button";
import type { ChangedFile } from "@/types";

export type StageLayer = "unstaged" | "staged";
type Props = {
  projectId: string;
  files: ChangedFile[];
  selected: string;
  layer: StageLayer;
  filter: string;
  busy: boolean;
  onSelect: (path: string, layer: StageLayer) => void;
  onStage: (path: string, layer: StageLayer) => void;
};
export function StagingTree({
  projectId,
  files,
  selected,
  layer,
  filter,
  busy,
  onSelect,
  onStage,
}: Props) {
  return (
    <div className="staging-tree">
      {(["unstaged", "staged"] as const).map((section) => {
        const changes = files.filter((file) =>
          section === "staged" ? file.staged : (file.unstaged ?? !file.staged),
        );
        return (
          <section className="staging-section" key={section}>
            <header>
              <span>
                {section === "staged" ? "Staged" : "Unstaged"}{" "}
                <small>{changes.length}</small>
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy || !changes.length}
                onClick={() => onStage(".", section)}
              >
                {section === "staged" ? "Unstage all" : "Stage all"}
              </Button>
            </header>
            <div className="files-scroll">
              <FileTree
                projectId={projectId}
                files={changes}
                selected={layer === section ? selected : ""}
                onSelect={(path) => onSelect(path, section)}
                onDoubleClick={
                  busy ? undefined : (path) => onStage(path, section)
                }
                filter={filter}
              />
              {!changes.length && (
                <div className="files-empty">
                  {section === "staged"
                    ? "No staged changes"
                    : "No unstaged changes"}
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
