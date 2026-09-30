import type { Project, Snapshot } from "./types";

/** Reuse repository-wide navigation without showing another checkout's changes. */
export function worktreeNavigation(
  previous: Snapshot,
  project: Project,
): Snapshot | undefined {
  const tree = previous.worktrees.find((item) => item.path === project.path);
  if (!tree) return;
  return {
    ...previous,
    project,
    branch: tree.branch,
    branches: previous.branches.map((branch) => ({
      ...branch,
      current: !branch.remote && branch.name === tree.branch,
    })),
    files: [],
    commits: [],
    ahead: 0,
    behind: 0,
  };
}
