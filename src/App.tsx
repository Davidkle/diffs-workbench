import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  Archive,
  Check,
  ChevronDown,
  ChevronRight,
  FileDiff,
  Folder,
  FolderOpen,
  GitBranch,
  GitCommitHorizontal,
  History,
  Link2,
  Loader2,
  Menu,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Tag,
  X,
  Github,
  ExternalLink,
} from "lucide-react";
import * as Switch from "@radix-ui/react-switch";
import { Toaster, toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Dropdown } from "@/components/ui/dropdown-menu";
import { CommitHistory } from "@/components/CommitHistory";
import { BranchTree } from "@/components/BranchTree";
import { FileTree } from "@/components/FileTree";
import { StagingTree, type StageLayer } from "@/components/StagingTree";
import { CommitForm } from "@/components/CommitForm";
import { WorkspaceLayout } from "@/components/WorkspaceLayout";
import { DiffPane } from "@/components/DiffPane";
import {
  bridge,
  getToken,
  setToken,
  capturePairingToken,
} from "@/api-clients/bridge";
import { usePersistentBoolean } from "@/use-persistent-boolean";
import { ProjectCache } from "@/project-cache";
import { demo, demoContent } from "@/demo";
import type {
  Action,
  ChangedFile,
  FileContent,
  Project,
  Snapshot,
} from "@/types";
type Modal = {
  kind: "connect" | "open" | "action";
  title: string;
  description: string;
  action?: Action;
  fields?: {
    key: string;
    label: string;
    placeholder?: string;
    value?: string;
  }[];
  input?: Record<string, string>;
  danger?: boolean;
};
const initials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");
function Section({
  projectId,
  title,
  icon,
  children,
  action,
  filtering = false,
  hidden = false,
}: {
  projectId: string;
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
  filtering?: boolean;
  hidden?: boolean;
}) {
  const [savedOpen, setOpen] = usePersistentBoolean(
    projectId,
    "sections",
    title,
  );
  const open = filtering || savedOpen;
  if (hidden) return null;
  return (
    <section className="nav-section">
      <div className="section-header">
        <button
          aria-expanded={open}
          onClick={() => !filtering && setOpen(!open)}
        >
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />} {icon}
          <span>{title}</span>
        </button>
        {action}
      </div>
      {open && children}
    </section>
  );
}
export function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [active, setActive] = useState(
    () => localStorage.getItem("diffs-active") || "",
  );
  const [loadingProject, setLoadingProject] = useState("");
  const [projectError, setProjectError] = useState<{
    id: string;
    message: string;
  } | null>(null);
  const snapshots = useRef(new ProjectCache<Snapshot>());
  const selectedFiles = useRef(new Map<string, string>());
  const [openIds, setOpenIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("diffs-tabs") || "[]");
    } catch {
      return [];
    }
  });
  const [state, setState] = useState<Snapshot>(demo);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState("");
  const [syncText, setSyncText] = useState("Example workspace");
  const [selectedCommits, setSelectedCommits] = useState<string[]>([]);
  const historySelection = state.commits.filter((c) =>
    selectedCommits.includes(c.hash),
  );
  const commit = historySelection[0]?.hash;
  const comparisonBase =
    historySelection.length === 2 ? historySelection[1].hash : undefined;
  const manyCommits = historySelection.length > 2;
  const [files, setFiles] = useState<ChangedFile[]>(demo.files);
  const [selected, setSelected] = useState("src/workspace.tsx");
  const [content, setContent] = useState<FileContent | null>(demoContent);
  const [fileLoading, setFileLoading] = useState(false);
  const [full, setFull] = useState(false);
  const [split, setSplit] = useState(false);
  const [stageLayer, setStageLayer] = useState<StageLayer>("unstaged");
  const [filter, setFilter] = useState("");
  const [navFilter, setNavFilter] = useState("");
  const navQuery = navFilter.trim().toLowerCase();
  const matchingProjects = projects.filter((p) =>
    `${p.name} ${p.path}`.toLowerCase().includes(navQuery),
  );
  const matchingWorktrees = state.worktrees.filter((w) =>
    `${w.path} ${w.branch}`.toLowerCase().includes(navQuery),
  );
  const matchingBranches = state.branches.filter((b) =>
    b.name.toLowerCase().includes(navQuery),
  );
  const matchingRemotes = state.remotes.filter((name) =>
    name.toLowerCase().includes(navQuery),
  );
  const matchingTags = state.tags.filter((name) =>
    name.toLowerCase().includes(navQuery),
  );
  const matchingStashes = state.stashes.filter((stash) =>
    `${stash.ref} ${stash.subject}`.toLowerCase().includes(navQuery),
  );
  const [mode, setMode] = useState<"changes" | "tree" | "commit">("changes");
  const [view, setView] = useState<"changes" | "history">("changes");
  const localChanges = view === "changes" && !commit;
  useEffect(() => {
    if (!localChanges) return;
    const file = files.find((file) => file.path === selected);
    if (!file) return;
    if (stageLayer === "staged" && !file.staged) setStageLayer("unstaged");
    else if (
      stageLayer === "unstaged" &&
      !(file.unstaged ?? !file.staged) &&
      file.staged
    )
      setStageLayer("staged");
  }, [files, selected, stageLayer, localChanges]);
  const [autoSync, setAutoSync] = useState(
    () => localStorage.getItem("diffs-auto-sync") !== "false",
  );
  const [mobileNav, setMobileNav] = useState(false);
  const [showHistory, setShowHistory] = usePersistentBoolean(
    active || "preview",
    "panels",
    "history",
  );
  const [modal, setModal] = useState<Modal | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [modalError, setModalError] = useState("");
  const [revision, setRevision] = useState(0);
  const contentRef = useRef(content);
  contentRef.current = content;
  const activeRef = useRef(active);
  activeRef.current = active;
  const syncBusy = useRef(new Set<string>());
  const showModal = (value: Modal) => {
    setValues(
      Object.fromEntries(
        (value.fields || []).map((f) => [f.key, f.value || ""]),
      ),
    );
    setModalError("");
    setModal(value);
  };
  const connect = useCallback(async () => {
    setSyncText("Connecting to local bridge…");
    const list = await bridge.projects();
    setProjects(list);
    setConnected(true);
    setOpenIds((previous) => {
      const valid = previous.filter((id) => list.some((p) => p.id === id));
      return valid.length ? valid : list.slice(0, 3).map((p) => p.id);
    });
    setActive((previous) =>
      list.some((p) => p.id === previous) ? previous : list[0]?.id || "",
    );
    setSyncText(window.diffsDesktop ? "Ready" : "Connected to local bridge");
    if (!list.length) {
      setState({
        ...demo,
        project: { id: "", name: "No project", path: "" },
        files: [],
        commits: [],
        branches: [],
        worktrees: [],
        stashes: [],
        remotes: [],
        tags: [],
      });
      setFiles([]);
      setContent(null);
      setSelected("");
    }
    setModal(null);
  }, []);
  useEffect(() => {
    const pair = () => {
      capturePairingToken();
      if (getToken())
        connect().catch((error) => {
          setSyncText(error.message);
          toast.error(error.message);
        });
    };
    pair();
    window.addEventListener("hashchange", pair);
    window.addEventListener("pageshow", pair);
    return () => {
      window.removeEventListener("hashchange", pair);
      window.removeEventListener("pageshow", pair);
    };
  }, [connect]);
  useEffect(
    () => localStorage.setItem("diffs-tabs", JSON.stringify(openIds)),
    [openIds],
  );
  useEffect(
    () => localStorage.setItem("diffs-auto-sync", String(autoSync)),
    [autoSync],
  );
  useEffect(() => {
    if (connected && !active) {
      setState({
        ...demo,
        project: { id: "", name: "Open a repository", path: "" },
        branch: "—",
        files: [],
        branches: [],
        worktrees: [],
        commits: [],
        stashes: [],
        tags: [],
        remotes: [],
      });
      setSelectedCommits([]);
      setFiles([]);
      setSelected("");
      setContent(null);
    }
  }, [active, connected]);
  const refresh = useCallback(async (id: string) => {
    try {
      const next = await snapshots.current.load(id, () => bridge.snapshot(id));
      if (activeRef.current === id) {
        setProjectError(null);
        setState(next);
        setRevision((n) => n + 1);
      }
    } catch (error) {
      if (activeRef.current === id) {
        setProjectError({ id, message: (error as Error).message });
        setContent(null);
        setFiles([]);
      }
      throw error;
    }
  }, []);
  const doSync = useCallback(
    async (id: string) => {
      if (syncBusy.current.has(id)) return;
      syncBusy.current.add(id);
      try {
        const result = await bridge.action(id, "sync");
        if (activeRef.current === id) {
          setSyncText(result.message);
          await refresh(id);
        }
      } catch (error) {
        if (activeRef.current === id) setSyncText((error as Error).message);
      } finally {
        syncBusy.current.delete(id);
      }
    },
    [refresh],
  );
  useEffect(() => {
    if (!connected || !active) return;
    setProjectError(null);
    localStorage.setItem("diffs-active", active);
    setSelectedCommits([]);
    setView("changes");
    setMode("changes");
    setFilter("");
    setContent(null);
    const cached = snapshots.current.get(active);
    setSelected(selectedFiles.current.get(active) || "");
    setFiles(cached?.files || []);
    if (cached) setState(cached);
    else {
      const project = projects.find((p) => p.id === active);
      setState({
        ...demo,
        project: project || { id: active, name: "Loading…", path: "" },
        files: [],
        commits: [],
        branches: [],
        worktrees: [],
        stashes: [],
        remotes: [],
        tags: [],
        ahead: 0,
        behind: 0,
      });
    }
    setLoadingProject(active);
    refresh(active)
      .catch(() => undefined)
      .finally(() => setLoadingProject((id) => (id === active ? "" : id)));
    // Project metadata changes must not reset the current tab's selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, connected, refresh]);
  useEffect(() => {
    if (connected && active && autoSync) void doSync(active);
  }, [active, connected, autoSync, doSync]);
  useEffect(() => {
    if (!connected || !active) return;
    const onFocus = () => {
      if (document.visibilityState === "visible") {
        void refresh(active).catch(() => setSyncText("Local bridge offline"));
        if (autoSync) void doSync(active);
      }
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible")
        void refresh(active).catch(() => setSyncText("Local bridge offline"));
    }, 10000);
    const syncTimer = setInterval(() => {
      if (autoSync && document.visibilityState === "visible")
        void doSync(active);
    }, 60000);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      clearInterval(timer);
      clearInterval(syncTimer);
    };
  }, [connected, active, autoSync, refresh, doSync]);
  useEffect(() => {
    if (
      !connected ||
      !active ||
      state.project.id !== active ||
      projectError?.id === active ||
      manyCommits
    )
      return;
    let ignore = false;
    async function load() {
      const changed = commit
        ? await bridge.files(active, commit, comparisonBase)
        : state.files;
      const list =
        mode === "tree"
          ? (await bridge.tree(active, commit)).map(
              (path) =>
                changed.find((f) => f.path === path) || {
                  path,
                  status: "",
                  staged: false,
                  conflict: false,
                  additions: 0,
                  deletions: 0,
                },
            )
          : changed;
      if (ignore) return;
      setFiles(list);
      setSelected((previous) =>
        list.some((f) => f.path === previous) ? previous : list[0]?.path || "",
      );
    }
    load().catch((e) => {
      if (!ignore && activeRef.current === active) toast.error(e.message);
    });
    return () => {
      ignore = true;
    };
  }, [
    connected,
    active,
    state,
    commit,
    comparisonBase,
    manyCommits,
    mode,
    projectError,
  ]);
  useEffect(() => {
    if (
      !connected ||
      !active ||
      state.project.id !== active ||
      projectError?.id === active
    )
      return;
    let ignore = false;
    if (!selected || manyCommits) {
      setFileLoading(false);
      setContent(null);
      return;
    }
    if (!contentRef.current || contentRef.current.path !== selected)
      setFileLoading(true);
    bridge
      .file(
        active,
        selected,
        commit,
        comparisonBase,
        localChanges ? stageLayer : undefined,
      )
      .then((next) => {
        if (!ignore)
          setContent((previous) =>
            previous &&
            previous.path === next.path &&
            previous.old === next.old &&
            previous.current === next.current &&
            previous.binary === next.binary &&
            previous.conflict === next.conflict &&
            previous.ours === next.ours &&
            previous.theirs === next.theirs
              ? previous
              : next,
          );
      })
      .catch((e) => {
        if (!ignore && activeRef.current === active) {
          setContent(null);
          toast.error(e.message);
        }
      })
      .finally(() => {
        if (!ignore) setFileLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [
    connected,
    active,
    selected,
    stageLayer,
    localChanges,
    commit,
    comparisonBase,
    manyCommits,
    revision,
    state.project.id,
    projectError,
  ]);
  useEffect(() => {
    if (
      connected &&
      active === state.project.id &&
      selected &&
      view === "changes"
    )
      selectedFiles.current.set(active, selected);
  }, [connected, active, state.project.id, selected, view]);
  const requireConnection = () => {
    if (connected) return true;
    showModal({
      kind: "connect",
      title: "Connect your local repositories",
      description:
        "Your code stays on your computer. A small local bridge lets this browser use Git.",
    });
    return false;
  };
  const action = async (type: Action, input: Record<string, string> = {}) => {
    if (!requireConnection() || !active) return;
    const id = active;
    setBusy(type);
    try {
      const result = await bridge.action(id, type, input);
      toast.success(result.message.split("\n").slice(0, 3).join("\n"));
      setSyncText(type === "sync" ? result.message : "Updated just now");
      await refresh(id);
      setProjects(await bridge.projects());
    } catch (error) {
      toast.error((error as Error).message);
      throw error;
    } finally {
      setBusy("");
    }
  };
  const run = (type: Action, input: Record<string, string> = {}) =>
    void action(type, input).catch(() => undefined);
  const actionModal = (
    title: string,
    actionType: Action,
    fields: Modal["fields"] = [],
    input: Record<string, string> = {},
    description = "",
    danger = false,
  ) => {
    if (requireConnection())
      showModal({
        kind: "action",
        title,
        action: actionType,
        fields,
        input,
        description,
        danger,
      });
  };
  const openProject = (id: string) => {
    setOpenIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    if (id !== active) {
      activeRef.current = id;
      setContent(null);
      setSelected("");
      setFiles([]);
      setSelectedCommits([]);
      setActive(id);
    }
    setMobileNav(false);
  };
  const selectCommits = (ids: string[]) => {
    setSelectedCommits(ids);
    setMode("changes");
    setSelected("");
    setContent(null);
    setFiles(!connected && !ids.length ? demo.files : []);
    if (!connected && !ids.length) {
      setSelected(demoContent.path);
      setContent(demoContent);
    }
  };
  const selectCommit = (hash?: string) => selectCommits(hash ? [hash] : []);
  const selectFile = (path: string) => {
    if (!connected) {
      setSelected(path);
      setContent(
        path === demoContent.path
          ? demoContent
          : {
              path,
              old: "// Before\n",
              current:
                "// Connect your local repositories to view this file.\n",
              binary: false,
              conflict: false,
            },
      );
    } else setSelected(path);
  };
  const submitModal = async () => {
    setModalError("");
    try {
      if (modal?.kind === "connect") {
        if (values.token) {
          setToken(values.token.trim());
          await connect();
        } else {
          window.location.href = `http://127.0.0.1:43127/pair?origin=${encodeURIComponent(location.origin)}`;
          return;
        }
      } else if (modal?.kind === "open") {
        setBusy("Opening project");
        const project = await bridge.add(values.path);
        setProjects(await bridge.projects());
        openProject(project.id);
      } else if (modal?.action) {
        await action(modal.action, { ...modal.input, ...values });
      }
      setModal(null);
    } catch (error) {
      setModalError((error as Error).message);
    } finally {
      setBusy("");
    }
  };
  const currentCommit =
    historySelection.length === 1 ? historySelection[0] : undefined;
  const changedCount = state.files.length;
  const additions = files.reduce((sum, f) => sum + f.additions, 0);
  const deletions = files.reduce((sum, f) => sum + f.deletions, 0);
  const openDialog = () => {
    if (window.diffsDesktop) {
      void window.diffsDesktop
        .chooseProject()
        .then(async (path) => {
          if (!path) return;
          const project = await bridge.add(path);
          setProjects(await bridge.projects());
          openProject(project.id);
        })
        .catch((error) => toast.error(error.message));
      return;
    }
    if (requireConnection())
      showModal({
        kind: "open",
        title: "Open a local repository",
        description:
          "Enter the absolute path to a Git repository on this computer.",
        fields: [
          {
            key: "path",
            label: "Repository path",
            placeholder: "/Users/you/projects/my-project",
          },
        ],
      });
  };
  const openProjectMenuRef = useRef(openDialog);
  useEffect(() => {
    openProjectMenuRef.current = openDialog;
  });
  useEffect(
    () =>
      window.diffsDesktop?.onOpenProject?.(() => openProjectMenuRef.current()),
    [],
  );
  const autoSyncControl = (
    <label className="auto-sync" title={syncText}>
      <Switch.Root
        checked={autoSync}
        onCheckedChange={setAutoSync}
        className="switch"
        aria-label="Auto sync"
      >
        <Switch.Thumb className="switch-thumb" />
      </Switch.Root>
      Auto sync
    </label>
  );
  return (
    <div className="app-shell">
      <Toaster theme="dark" position="bottom-right" richColors closeButton />
      <WorkspaceLayout
        projectId={active || "preview"}
        kind="repository"
        leading={
          <aside className={`sidebar ${mobileNav ? "mobile-open" : ""}`}>
            <div className="project-heading">
              <span>{state.project.name}</span>
              <Button
                variant="ghost"
                size="icon"
                className="mobile-close"
                onClick={() => setMobileNav(false)}
                aria-label="Close navigation"
              >
                <X size={16} />
              </Button>
            </div>
            <nav className="primary-nav">
              <button
                className={view === "changes" ? "active" : ""}
                onClick={() => {
                  setView("changes");
                  selectCommit();
                }}
              >
                <FileDiff size={16} />
                <span>Local Changes</span>
                <span className="count">{changedCount}</span>
              </button>
              <button
                className={view === "history" ? "active" : ""}
                onClick={() => {
                  setView("history");
                  if (state.commits[0]) selectCommit(state.commits[0].hash);
                }}
              >
                <History size={16} />
                <span>All Commits</span>
              </button>
            </nav>
            <div className="sidebar-filter">
              <Search size={13} />
              <input
                aria-label="Search sidebar"
                placeholder="Search"
                value={navFilter}
                onChange={(e) => setNavFilter(e.target.value)}
              />
            </div>
            <div className="sidebar-scroll">
              {navQuery && matchingProjects.length > 0 && (
                <Section
                  projectId={active || "preview"}
                  title="Projects"
                  filtering
                >
                  {matchingProjects.map((project) => (
                    <button
                      key={project.id}
                      className="nav-row"
                      title={project.path}
                      onClick={() => {
                        openProject(project.id);
                        setNavFilter("");
                      }}
                    >
                      <Folder size={14} />
                      <span>{project.name}</span>
                      {project.id === active && (
                        <span className="current-dot" />
                      )}
                    </button>
                  ))}
                </Section>
              )}
              {navQuery &&
                !matchingProjects.length &&
                !matchingWorktrees.length &&
                !matchingBranches.length &&
                !matchingRemotes.length &&
                !matchingTags.length &&
                !matchingStashes.length && (
                  <div className="nav-empty" role="status">
                    No matches found
                  </div>
                )}
              <Section
                projectId={active || "preview"}
                title="Worktrees"
                filtering={!!navQuery}
                hidden={!!navQuery && !matchingWorktrees.length}
                action={
                  <button
                    className="section-add"
                    aria-label="Create worktree"
                    onClick={() =>
                      actionModal(
                        "Create worktree",
                        "worktree-create",
                        [
                          {
                            key: "name",
                            label: "New branch",
                            placeholder: "feat/my-feature",
                          },
                          {
                            key: "path",
                            label: "New directory",
                            placeholder: "/Users/you/projects/my-feature",
                          },
                        ],
                        {},
                        "Create a separate checkout on a new branch.",
                      )
                    }
                  >
                    <Plus size={13} />
                  </button>
                }
              >
                {matchingWorktrees.map((w) => (
                  <div className="nav-row-group" key={w.path}>
                    <button
                      className="nav-row"
                      title={w.path}
                      onClick={() => {
                        if (!requireConnection()) return;
                        bridge
                          .add(w.path)
                          .then(async (p) => {
                            setProjects(await bridge.projects());
                            openProject(p.id);
                          })
                          .catch((e) => toast.error(e.message));
                      }}
                    >
                      <Folder size={14} />
                      <span>{w.path.split("/").pop()}</span>
                      {w.path === state.project.path && (
                        <span className="current-dot" />
                      )}
                    </button>
                    <Dropdown
                      trigger={
                        <button
                          className="row-menu"
                          aria-label={`Manage worktree ${w.path.split("/").pop()}`}
                        >
                          <MoreHorizontal size={13} />
                        </button>
                      }
                      items={[
                        {
                          label: "Move worktree…",
                          disabled: w.path === state.project.path,
                          onSelect: () =>
                            actionModal(
                              "Move worktree",
                              "worktree-move",
                              [{ key: "path", label: "New path" }],
                              { from: w.path },
                              "The worktree will be moved to the new directory.",
                            ),
                        },
                        {
                          label: "Remove worktree…",
                          danger: true,
                          disabled: w.path === state.project.path,
                          onSelect: () =>
                            actionModal(
                              "Remove worktree?",
                              "worktree-remove",
                              [],
                              { from: w.path },
                              "Remove this checkout. Git will refuse if it contains unsaved changes.",
                              true,
                            ),
                        },
                      ]}
                    />
                  </div>
                ))}
              </Section>
              <Section
                projectId={active || "preview"}
                title="Branches"
                filtering={!!navQuery}
                hidden={!!navQuery && !matchingBranches.length}
                action={
                  <button
                    className="section-add"
                    aria-label="Create branch"
                    onClick={() =>
                      actionModal(
                        "Create branch",
                        "branch-create",
                        [
                          {
                            key: "name",
                            label: "Branch name",
                            placeholder: "feat/my-feature",
                          },
                        ],
                        {},
                        "Create and switch to a branch from the current HEAD.",
                      )
                    }
                  >
                    <Plus size={13} />
                  </button>
                }
              >
                <BranchTree
                  projectId={active || "preview"}
                  filtering={!!navQuery}
                  branches={matchingBranches}
                  renderBranch={(b) => (
                    <div className="nav-row-group" key={b.name}>
                      <button
                        className={`nav-row ${b.current ? "current" : ""}`}
                        onClick={() => run("branch-switch", { name: b.name })}
                      >
                        {b.current ? (
                          <Check size={14} />
                        ) : (
                          <GitBranch size={14} />
                        )}
                        <span title={b.name}>{b.name.split("/").pop()}</span>
                        {b.current && state.ahead > 0 && (
                          <small>{state.ahead}↑</small>
                        )}
                      </button>
                      <Dropdown
                        trigger={
                          <button
                            className="row-menu"
                            aria-label={`Manage branch ${b.name}`}
                          >
                            <MoreHorizontal size={13} />
                          </button>
                        }
                        items={[
                          {
                            label: "Checkout branch",
                            disabled: b.current,
                            onSelect: () =>
                              run("branch-switch", { name: b.name }),
                          },
                          {
                            label: "Rename…",
                            onSelect: () =>
                              actionModal(
                                "Rename branch",
                                "branch-rename",
                                [
                                  {
                                    key: "name",
                                    label: "New name",
                                    value: b.name,
                                  },
                                ],
                                { from: b.name },
                              ),
                          },
                          {
                            label: "Delete branch…",
                            danger: true,
                            disabled: b.current,
                            onSelect: () =>
                              actionModal(
                                "Delete branch?",
                                "branch-delete",
                                [],
                                { name: b.name },
                                `Delete ${b.name}. Unmerged branches are protected.`,
                                true,
                              ),
                          },
                        ]}
                      />
                    </div>
                  )}
                />
              </Section>
              <Section
                projectId={active || "preview"}
                title="Remotes"
                filtering={!!navQuery}
                hidden={!!navQuery && !matchingRemotes.length}
              >
                {matchingRemotes.map((r) => (
                  <button
                    className="nav-row"
                    key={r}
                    onClick={() => run("fetch")}
                  >
                    <ChevronRight size={11} />
                    <Github size={14} />
                    <span>{r}</span>
                  </button>
                ))}
                {!state.remotes.length && (
                  <div className="nav-empty">No remotes configured</div>
                )}
              </Section>
              <Section
                projectId={active || "preview"}
                title="Tags"
                filtering={!!navQuery}
                hidden={!!navQuery && !matchingTags.length}
              >
                {matchingTags.length ? (
                  matchingTags.map((t) => (
                    <div className="nav-row" key={t}>
                      <Tag size={13} />
                      <span>{t}</span>
                    </div>
                  ))
                ) : (
                  <div className="nav-empty">No tags yet</div>
                )}
              </Section>
              <Section
                projectId={active || "preview"}
                title="Stashes"
                filtering={!!navQuery}
                hidden={!!navQuery && !matchingStashes.length}
                action={
                  <button
                    className="section-add"
                    aria-label="Create stash"
                    onClick={() =>
                      actionModal(
                        "Stash local changes",
                        "stash-create",
                        [
                          {
                            key: "name",
                            label: "Message",
                            placeholder: "Work in progress",
                          },
                        ],
                        {},
                        "Save tracked and untracked changes, then clean the working tree.",
                      )
                    }
                  >
                    <Plus size={13} />
                  </button>
                }
              >
                {matchingStashes.length ? (
                  matchingStashes.map((stash) => (
                    <div className="nav-row-group" key={stash.ref}>
                      <span className="nav-row" title={stash.subject}>
                        <Archive size={13} />
                        <span>{stash.subject}</span>
                      </span>
                      <Dropdown
                        trigger={
                          <button
                            className="row-menu"
                            aria-label={`Manage ${stash.ref}`}
                          >
                            <MoreHorizontal size={14} />
                          </button>
                        }
                        items={[
                          {
                            label: "Apply (keep stash)",
                            onSelect: () =>
                              run("stash-apply", { name: stash.ref }),
                          },
                          {
                            label: "Pop (apply & remove)",
                            onSelect: () =>
                              run("stash-pop", { name: stash.ref }),
                          },
                          {
                            label: "Delete stash…",
                            danger: true,
                            onSelect: () =>
                              actionModal(
                                "Delete stash?",
                                "stash-drop",
                                [],
                                { name: stash.ref },
                                "This permanently removes the saved stash.",
                                true,
                              ),
                          },
                        ]}
                      />
                    </div>
                  ))
                ) : (
                  <div className="nav-empty">No stashed changes</div>
                )}
              </Section>
            </div>
          </aside>
        }
      >
        <main className="main">
          <div className="project-tabs">
            {(connected
              ? projects.filter((p) => openIds.includes(p.id))
              : [demo.project]
            ).map((p) => (
              <div
                key={p.id}
                className={`project-tab ${p.id === active || !connected ? "active" : ""}`}
              >
                <button onClick={() => openProject(p.id)}>
                  <>
                    {loadingProject === p.id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Folder size={13} />
                    )}
                  </>
                  {p.name}
                </button>
                <button
                  className="tab-close"
                  aria-label={`Close ${p.name} tab`}
                  onClick={() => {
                    const remaining = openIds.filter((id) => id !== p.id);
                    setOpenIds(remaining);
                    if (active === p.id) {
                      if (remaining[0]) setActive(remaining[0]);
                      else {
                        setActive("");
                        setFiles([]);
                        setContent(null);
                      }
                    }
                  }}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            <Dropdown
              trigger={
                <button className="add-tab" aria-label="Open project tab">
                  <Plus size={17} />
                </button>
              }
              items={[
                ...projects.map((p) => ({
                  label: p.name,
                  onSelect: () => openProject(p.id),
                })),
                { label: "Open repository…", onSelect: openDialog },
              ]}
            />
          </div>
          <header className="toolbar">
            <Button
              variant="ghost"
              size="icon"
              className="mobile-menu"
              onClick={() => setMobileNav(true)}
              aria-label="Open navigation"
            >
              <Menu size={18} />
            </Button>
            <div className="toolbar-actions">
              {!window.diffsDesktop && (
                <Dropdown
                  trigger={<button className="tool">File</button>}
                  items={[{ label: "Open project…", onSelect: openDialog }]}
                />
              )}
              <Tool
                icon={<RefreshCw />}
                label="Fetch"
                onClick={() => run("fetch")}
                disabled={!!busy}
              />
              <Tool
                icon={<ArrowDown />}
                label="Pull"
                onClick={() => run("pull")}
                disabled={!!busy}
              />
              <Tool
                icon={<ArrowUp />}
                label="Push"
                badge={state.ahead}
                onClick={() => run("push")}
                disabled={!!busy}
              />
              <Tool
                icon={<Archive />}
                label="Stash"
                onClick={() =>
                  actionModal(
                    "Stash local changes",
                    "stash-create",
                    [
                      {
                        key: "name",
                        label: "Message",
                        placeholder: "Work in progress",
                      },
                    ],
                    {},
                    "Includes untracked files. Your changes can be restored from the sidebar.",
                  )
                }
                disabled={!!busy}
              />
            </div>
            <div className="toolbar-right">
              <Tool
                icon={<GitBranch />}
                label="Branch"
                onClick={() =>
                  actionModal("Create branch", "branch-create", [
                    {
                      key: "name",
                      label: "Branch name",
                      placeholder: "feat/my-feature",
                    },
                  ])
                }
              />
            </div>
          </header>
          {!connected && (
            <div className="demo-banner">
              <div>
                <span className="example-dot" />
                Preview workspace{" "}
                <span className="demo-description">
                  Connect your computer to start reviewing local code.
                </span>
              </div>
              <button onClick={() => requireConnection()}>
                Connect local bridge <ArrowUp size={12} className="rotate-45" />
              </button>
            </div>
          )}
          {projectError?.id === active ? (
            <div className="welcome-project" role="alert">
              <FolderOpen size={32} />
              <h2>Project unavailable</h2>
              <p className="project-error-message">{projectError.message}</p>
              <div className="project-error-actions">
                <Button onClick={openDialog}>Open folder…</Button>
                <Button
                  variant="outline"
                  onClick={() => void refresh(active).catch(() => undefined)}
                >
                  Try again
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    const remaining = openIds.filter((id) => id !== active);
                    setOpenIds(remaining);
                    setActive(remaining[0] || "");
                  }}
                >
                  Close tab
                </Button>
              </div>
            </div>
          ) : (
            <WorkspaceLayout
              projectId={active || "preview"}
              kind="history"
              leading={
                showHistory && view === "history" ? (
                  <section className="history">
                    <div className="history-heading">
                      <span>
                        <GitCommitHorizontal size={14} />
                        Commit history{" "}
                        <span className="muted">
                          {state.commits.length}
                          {state.commits.length === 150 ? "+" : ""}
                        </span>
                      </span>
                      <button
                        aria-label="Collapse commit history"
                        onClick={() => setShowHistory(false)}
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>
                    <CommitHistory
                      key={state.project.id}
                      commits={state.commits}
                      branch={state.branch}
                      selected={selectedCommits}
                      onSelect={selectCommits}
                    />
                  </section>
                ) : null
              }
            >
              {view === "history" && (
                <div className="workspace-tabs">
                  <div>
                    {(["commit", "changes", "tree"] as const).map((tab) => (
                      <button
                        key={tab}
                        className={mode === tab ? "selected" : ""}
                        onClick={() => setMode(tab)}
                      >
                        {tab === "commit"
                          ? "Commit"
                          : tab === "changes"
                            ? "Changes"
                            : "File Tree"}
                        {tab === "changes" && <span>{files.length}</span>}
                      </button>
                    ))}
                  </div>
                  <div className="workspace-options">
                    {!showHistory && view === "history" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowHistory(true)}
                      >
                        <History size={14} />
                        History
                      </Button>
                    )}
                    <span className="diff-stat add">+{additions}</span>
                    <span className="diff-stat remove">−{deletions}</span>
                    <span className="separator" />
                    {autoSyncControl}
                  </div>
                </div>
              )}
              <div className="change-summary">
                {historySelection.length > 1 ? (
                  <>
                    <GitCommitHorizontal size={16} />
                    <strong>{historySelection.length} commits selected</strong>
                    <span className="summary-message">
                      {comparisonBase
                        ? `${comparisonBase.slice(0, 7)} → ${commit?.slice(0, 7)}`
                        : "Select two commits to compare"}
                    </span>
                  </>
                ) : currentCommit ? (
                  <>
                    <span className="avatar">
                      {initials(currentCommit.author)}
                    </span>
                    <strong>{currentCommit.author}</strong>
                    <code>{currentCommit.short}</code>
                    <span className="summary-message">
                      {currentCommit.subject}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="working-dot" />
                    <strong>
                      {active
                        ? "Working directory"
                        : "Choose a project to get started"}
                    </strong>
                    <span className="summary-message">
                      {changedCount
                        ? `${changedCount} changed file${changedCount !== 1 ? "s" : ""}`
                        : "No uncommitted changes"}
                    </span>
                  </>
                )}
                {view === "changes" ? (
                  <div className="local-change-options">
                    <span className="diff-stat add">+{additions}</span>
                    <span className="diff-stat remove">−{deletions}</span>
                    {autoSyncControl}
                  </div>
                ) : (
                  <span className="summary-right">Committed changes</span>
                )}
              </div>
              {manyCommits || (!connected && !!commit) ? (
                <div className="commit-selection-empty">
                  <GitCommitHorizontal size={40} />
                  <h2>
                    {historySelection.length}{" "}
                    {historySelection.length === 1 ? "commit" : "commits"}{" "}
                    selected
                  </h2>
                  <p>
                    {connected
                      ? "Select two commits to see the difference between them."
                      : "Connect a project to compare real commits."}
                  </p>
                  <p className="selection-hint">
                    Shift-click for a range · ⌘ / Ctrl-click to add or remove
                  </p>
                </div>
              ) : mode === "commit" && comparisonBase ? (
                <div className="commit-selection-empty">
                  <h2>Comparing two commits</h2>
                  <p>
                    {comparisonBase.slice(0, 7)} → {commit?.slice(0, 7)}
                  </p>
                  <Button variant="outline" onClick={() => setMode("changes")}>
                    View changed files
                  </Button>
                </div>
              ) : mode === "commit" ? (
                <div className="commit-details">
                  <GitCommitHorizontal size={32} />
                  <h2>{currentCommit?.subject || "Commit your changes"}</h2>
                  {currentCommit ? (
                    <>
                      <p>
                        {currentCommit.author} ·{" "}
                        {new Date(currentCommit.date).toLocaleString()}
                      </p>
                      <code>{currentCommit.hash}</code>
                      <Button
                        variant="outline"
                        onClick={() => setMode("changes")}
                      >
                        View changed files
                      </Button>
                    </>
                  ) : (
                    <>
                      <p>
                        Commit staged changes on <strong>{state.branch}</strong>
                        .
                      </p>
                      <Button
                        disabled={!files.some((file) => file.staged) || !!busy}
                        onClick={() =>
                          actionModal(
                            "Commit staged changes",
                            "commit",
                            [
                              {
                                key: "name",
                                label: "Commit message",
                                placeholder: "Describe your changes",
                              },
                            ],
                            {},
                            "Only staged changes will be included in this commit.",
                          )
                        }
                      >
                        Commit changes…
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                <WorkspaceLayout
                  projectId={active || "preview"}
                  kind="files"
                  leading={
                    <aside className="files-pane">
                      <div className="file-filter">
                        <Search size={13} />
                        <input
                          placeholder="Filter files…"
                          aria-label="Filter files"
                          value={filter}
                          onChange={(e) => setFilter(e.target.value)}
                        />
                        <span>{files.length}</span>
                      </div>
                      {localChanges ? (
                        <StagingTree
                          projectId={active || "preview"}
                          files={files}
                          selected={selected}
                          layer={stageLayer}
                          filter={filter}
                          busy={!!busy || !connected}
                          onSelect={(path, layer) => {
                            setStageLayer(layer);
                            selectFile(path);
                          }}
                          onStage={(path, layer) =>
                            run(layer === "staged" ? "unstage" : "stage", {
                              path,
                            })
                          }
                        />
                      ) : (
                        <div className="files-scroll">
                          <FileTree
                            projectId={active || "preview"}
                            files={files}
                            selected={selected}
                            onSelect={selectFile}
                            filter={filter}
                          />
                          {!files.length && (
                            <div className="files-empty">
                              {connected
                                ? "No changed files"
                                : "Connect a repository"}
                            </div>
                          )}
                        </div>
                      )}
                      <div className="files-footer">
                        <Folder size={12} />
                        {mode === "tree" ? "All files" : "Changed files"}
                        <span>
                          {files.filter((f) => f.staged).length} staged
                        </span>
                      </div>
                    </aside>
                  }
                >
                  {connected && !active ? (
                    <div className="welcome-project">
                      <FolderOpen size={32} />
                      <h2>Open a project</h2>
                      <p>Choose a folder on your Mac to review its changes.</p>
                      <Button onClick={openDialog}>Choose folder</Button>
                    </div>
                  ) : (
                    <div className="diff-workspace">
                      <DiffPane
                        content={content}
                        loading={fileLoading}
                        full={full}
                        setFull={setFull}
                        split={split}
                        setSplit={setSplit}
                        fileMode={mode === "tree"}
                        onResolve={(value) =>
                          actionModal(
                            "Save conflict resolution",
                            "resolve",
                            [],
                            { path: selected, content: value },
                            "Write your resolution to disk and stage this file.",
                          )
                        }
                      />
                      {localChanges && (
                        <CommitForm
                          key={active}
                          count={files.filter((file) => file.staged).length}
                          busy={!!busy || !connected}
                          onCommit={(message) =>
                            action("commit", { name: message })
                          }
                        />
                      )}
                    </div>
                  )}
                </WorkspaceLayout>
              )}
            </WorkspaceLayout>
          )}
        </main>
      </WorkspaceLayout>
      <Dialog
        open={!!modal}
        onOpenChange={(open) => {
          if (!open) setModal(null);
        }}
        title={modal?.title || ""}
        description={modal?.description}
      >
        {modal?.kind === "connect" ? (
          <div className="connect-content">
            <a
              className="desktop-download"
              href="https://github.com/Davidkle/diffs-workbench/releases/latest"
              target="_blank"
              rel="noreferrer"
            >
              <strong>Get the Mac app</strong>
              <span>Open the app, choose a folder, and start reviewing.</span>
            </a>
            <details className="advanced-setup">
              <summary>Advanced: use this browser with a local service</summary>
              <div className="connect-step">
                <span>1</span>
                <div>
                  <strong>Start the local bridge</strong>
                  <p>In the project folder, run:</p>
                  <code>
                    npm install
                    <br />
                    npm run bridge -- /path/to/repository
                  </code>
                  <a
                    href="https://github.com/Davidkle/diffs-workbench#local-bridge"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Installation & source <ExternalLink size={12} />
                  </a>
                </div>
              </div>
              <div className="connect-step">
                <span>2</span>
                <div>
                  <strong>Pair this browser</strong>
                  <p>
                    Use the button below. Allow local network access if your
                    browser asks.
                  </p>
                </div>
              </div>
              <details>
                <summary>Pair with a key instead</summary>
                <label htmlFor="pair-key">
                  Key from ~/.diffs-workbench/token
                </label>
                <input
                  id="pair-key"
                  type="password"
                  placeholder="Paste your local pairing key"
                  value={values.token || ""}
                  onChange={(e) => setValues({ token: e.target.value })}
                />
              </details>
              <Button className="w-full" onClick={() => void submitModal()}>
                <Link2 size={15} />
                {values.token ? "Connect with key" : "Pair with local bridge"}
              </Button>
            </details>
            {connected && (
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setToken("");
                  setConnected(false);
                  setState(demo);
                  setFiles(demo.files);
                  setContent(demoContent);
                  setSelected(demoContent.path);
                  setActive("");
                  setModal(null);
                  setSyncText("Disconnected");
                }}
              >
                Disconnect this browser
              </Button>
            )}
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submitModal();
            }}
            className="modal-form"
          >
            {modal?.fields?.map((field) => (
              <label key={field.key}>
                {field.label}
                <input
                  required
                  value={values[field.key] || ""}
                  placeholder={field.placeholder}
                  onChange={(e) =>
                    setValues((prev) => ({
                      ...prev,
                      [field.key]: e.target.value,
                    }))
                  }
                />
              </label>
            ))}
            <div className="modal-buttons">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setModal(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!!busy}
                variant={modal?.danger ? "destructive" : "default"}
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : null}
                {modal?.danger
                  ? "Confirm deletion"
                  : modal?.kind === "open"
                    ? "Open repository"
                    : "Continue"}
              </Button>
            </div>
          </form>
        )}
        {modalError && (
          <p className="modal-error" role="alert">
            {modalError}
          </p>
        )}
      </Dialog>
    </div>
  );
}
function Tool({
  icon,
  label,
  onClick,
  badge,
  disabled,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  badge?: number;
  disabled?: boolean;
}) {
  return (
    <button
      className="tool"
      onClick={onClick}
      disabled={disabled}
      title={label}
    >
      <span>
        {icon}
        {!!badge && <i>{badge}</i>}
      </span>
      <small>{label}</small>
    </button>
  );
}
