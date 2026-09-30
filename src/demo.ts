import type { FileContent, Snapshot } from "@/types";
const old = `import { useEffect, useState } from 'react';\nimport { ProjectTabs } from './components/project-tabs';\nimport { DiffViewer } from './components/diff-viewer';\nimport { Sidebar } from './components/sidebar';\nimport { getProject } from './lib/git';\n\nexport function Workspace({ projectId }: { projectId: string }) {\n  const [project, setProject] = useState(null);\n  const [selectedFile, setSelectedFile] = useState<string>();\n\n  useEffect(() => {\n    getProject(projectId).then(setProject);\n  }, [projectId]);\n\n  return (\n    <div className="workspace">\n      <ProjectTabs activeId={projectId} />\n      <div className="workspace-content">\n        <Sidebar project={project} onSelect={setSelectedFile} />\n        <DiffViewer file={selectedFile} />\n      </div>\n    </div>\n  );\n}\n`;
const current = old
  .replace(
    "import { getProject } from './lib/git';",
    "import { getProject, syncProject } from './lib/git';\nimport { useVisibility } from './hooks/use-visibility';",
  )
  .replace(
    "  const [project, setProject] = useState(null);",
    "  const [project, setProject] = useState(null);\n  const [showFullFile, setShowFullFile] = useState(false);\n  const isVisible = useVisibility();",
  )
  .replace(
    "    getProject(projectId).then(setProject);\n  }, [projectId]);",
    "    if (!isVisible) return;\n\n    syncProject(projectId)\n      .then(() => getProject(projectId))\n      .then(setProject);\n  }, [projectId, isVisible]);",
  )
  .replace(
    "        <DiffViewer file={selectedFile} />",
    "        <DiffViewer\n          file={selectedFile}\n          expandUnchanged={showFullFile}\n          onToggleContext={setShowFullFile}\n        />",
  );
export const demoContent: FileContent = {
  path: "src/workspace.tsx",
  old,
  current,
  binary: false,
  conflict: false,
};
export const demo: Snapshot = {
  project: { id: "demo", name: "workbench", path: "Example workspace" },
  branch: "main",
  files: [
    {
      path: "src/workspace.tsx",
      status: "M",
      staged: false,
      conflict: false,
      additions: 16,
      deletions: 4,
    },
    {
      path: "src/components/diff-viewer.tsx",
      status: "M",
      staged: true,
      conflict: false,
      additions: 8,
      deletions: 2,
    },
    {
      path: "src/hooks/use-visibility.ts",
      status: "A",
      staged: false,
      conflict: false,
      additions: 22,
      deletions: 0,
    },
  ],
  branches: [
    { name: "main", current: true, upstream: "origin/main", track: "" },
    { name: "feat/local-sync", current: false, upstream: "", track: "" },
    { name: "fix/file-tree", current: false, upstream: "", track: "" },
  ],
  worktrees: [
    { path: "workbench", branch: "main", head: "", locked: false },
    { path: "local-sync", branch: "feat/local-sync", head: "", locked: false },
  ],
  stashes: [],
  remotes: ["origin"],
  tags: ["v0.1.0"],
  ahead: 0,
  behind: 0,
  commits: [
    "Add project tabs and workspace navigation",
    "Support unified and split diff views",
    "Connect local Git repositories",
    "Set up the workbench",
  ].map((subject, i) => ({
    hash: `example-${i}`,
    short: ["a4e9f21", "b8c320a", "c31d9f4", "d86a3c2"][i],
    parents: i < 3 ? `example-${i + 1}` : "",
    author: "Example author",
    date: new Date(Date.now() - i * 3600000).toISOString(),
    subject,
    refs: i === 0 ? "HEAD -> main, origin/main" : "",
  })),
};
