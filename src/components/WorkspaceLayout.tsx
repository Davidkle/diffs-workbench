import { useMemo, useSyncExternalStore, type ReactNode } from "react";
import { useDefaultLayout } from "react-resizable-panels";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

const mobileQuery = window.matchMedia("(max-width: 800px)");
const subscribe = (notify: () => void) => {
  mobileQuery.addEventListener("change", notify);
  return () => mobileQuery.removeEventListener("change", notify);
};
const getMobile = () => mobileQuery.matches;

type Props = {
  projectId: string;
  children: ReactNode;
  leading: ReactNode;
  kind: "repository" | "history" | "files";
};

export function WorkspaceLayout(props: Props) {
  // Panel geometry belongs to the workspace chrome, not a repository. Keep
  // every panel mounted when a tab/worktree changes to preserve DOM and focus.
  return <SavedWorkspaceLayout {...props} projectId="shared" />;
}
function SavedWorkspaceLayout({ children, leading, kind, projectId }: Props) {
  const mobile = useSyncExternalStore(subscribe, getMobile);
  // Keep existing panel widths as the initial layout for each project.
  const storage = useMemo(
    () => ({
      getItem(key: string) {
        try {
          return (
            localStorage.getItem(key) ??
            localStorage.getItem(
              key.replace(
                `donkey-diff-layout-${projectId}-`,
                "donkey-diff-layout-",
              ),
            )
          );
        } catch {
          return null;
        }
      },
      setItem(key: string, value: string) {
        try {
          localStorage.setItem(key, value);
        } catch {
          /* Resizing remains usable. */
        }
      },
    }),
    [projectId],
  );
  const leadingId = `${kind}-leading`;
  const contentId = `${kind}-content`;
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: `donkey-diff-layout-${projectId}-${kind}-${mobile ? "compact" : "desktop"}`,
    storage,
    panelIds: leading ? [leadingId, contentId] : [contentId],
    onlySaveAfterUserInteractions: true,
  });
  if (kind === "repository" && mobile) {
    return (
      <>
        {leading}
        {children}
      </>
    );
  }
  const vertical = kind === "history";
  const label = {
    repository: "Resize repository sidebar",
    history: "Resize commit history",
    files: "Resize file tree",
  }[kind];
  return (
    <ResizablePanelGroup
      key={`${mobile}-${!!leading}`}
      orientation={vertical ? "vertical" : "horizontal"}
      className={`layout-group layout-${kind}`}
      defaultLayout={defaultLayout}
      onLayoutChanged={onLayoutChanged}
    >
      {leading && (
        <>
          <ResizablePanel
            id={leadingId}
            className="layout-panel"
            defaultSize={
              vertical
                ? mobile
                  ? 140
                  : 178
                : kind === "repository"
                  ? 226
                  : mobile
                    ? "35%"
                    : 270
            }
            minSize={
              vertical ? 78 : kind === "repository" ? 180 : mobile ? 100 : 150
            }
            maxSize={vertical ? "60%" : kind === "repository" ? "35%" : "50%"}
          >
            {leading}
          </ResizablePanel>
          <ResizableHandle
            aria-label={label}
            className="workspace-resize-handle"
          />
        </>
      )}
      <ResizablePanel
        id={contentId}
        className="layout-panel"
        minSize={vertical ? "35%" : kind === "repository" ? 480 : "40%"}
      >
        {children}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
