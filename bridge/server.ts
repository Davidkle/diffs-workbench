import express from "express";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import {
  mkdir,
  readFile,
  writeFile,
  readdir,
  realpath,
} from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { z } from "zod";
import {
  git,
  validateRepo,
  snapshot,
  changedFiles,
  fileContent,
  sync,
  resolveFile,
  safeFile,
} from "./git.js";
import type { Project } from "../src/types.js";
const app = express();
const port = Number(process.env.DIFFS_PORT || 43127);
const dataDir =
  process.env.DIFFS_DATA_DIR || path.join(os.homedir(), ".diffs-workbench");
await mkdir(dataDir, { recursive: true, mode: 0o700 });
const statePath = path.join(dataDir, "projects.json");
const tokenPath = path.join(dataDir, "token");
let token: string;
try {
  token = (await readFile(tokenPath, "utf8")).trim();
} catch {
  token = randomBytes(32).toString("hex");
  await writeFile(tokenPath, token, { mode: 0o600 });
}
let projects: Project[] = [];
try {
  projects = JSON.parse(await readFile(statePath, "utf8"));
} catch {
  /* first launch */
}
async function save() {
  await writeFile(statePath, JSON.stringify(projects, null, 2), {
    mode: 0o600,
  });
}
async function addProject(input: string) {
  const root = await validateRepo(input);
  let project = projects.find((p) => p.path === root);
  if (!project) {
    project = {
      id: createHash("sha256").update(root).digest("hex").slice(0, 16),
      name: path.basename(root),
      path: root,
    };
    projects.push(project);
    await save();
  }
  return project;
}
const rootIndex = process.argv.indexOf("--root");
if (rootIndex >= 0 && process.argv[rootIndex + 1]) {
  const root = process.argv[rootIndex + 1];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.isDirectory() && !entry.name.startsWith(".")) {
      try {
        await addProject(path.join(root, entry.name));
      } catch {
        /* skip non-repos */
      }
    }
  }
}
for (const input of process.argv.filter(
  (v, i) => i > 1 && path.isAbsolute(v) && i !== rootIndex + 1,
)) {
  try {
    await addProject(input);
  } catch {
    /* non repository */
  }
}
const origins = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  ...(
    process.env.DIFFS_ALLOWED_ORIGINS || "https://diffs-workbench.vercel.app"
  ).split(","),
]);
app.use((req, res, next) => {
  const host = req.headers.host?.split(":")[0];
  if (!["127.0.0.1", "localhost"].includes(host || "")) {
    res.status(403).json({ error: "Invalid host" });
    return;
  }
  const origin = req.headers.origin;
  if (origin && !origins.has(origin)) {
    res.status(403).json({ error: "Origin is not paired with this bridge" });
    return;
  }
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type",
    );
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Private-Network", "true");
  }
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  if (req.path === "/pair") {
    const target =
      typeof req.query.origin === "string"
        ? req.query.origin
        : [...origins].find((o) => o.startsWith("https://"))!;
    if (!origins.has(target) || req.headers["sec-fetch-mode"] !== "navigate") {
      res.status(403).send("Open the pair link in your browser.");
      return;
    }
    res.setHeader("Referrer-Policy", "no-referrer");
    res.redirect(303, `${target}/#token=${token}`);
    return;
  }
  if (req.path === "/health") {
    res.json({ app: "diffs-workbench", version: "0.1.0" });
    return;
  }
  const supplied = Buffer.from(
    req.headers.authorization?.replace(/^Bearer /, "") || "",
  );
  const expected = Buffer.from(token);
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  ) {
    res
      .status(401)
      .json({ error: "Pair this browser with your local bridge to continue." });
    return;
  }
  next();
});
app.use(express.json({ limit: "6mb" }));
const projectFor = (id: string) => {
  const project = projects.find((p) => p.id === id);
  if (!project) throw new Error("Project not found");
  return project;
};
const queues = new Map<string, Promise<unknown>>();
async function serial<T>(id: string, task: () => Promise<T>): Promise<T> {
  const previous = queues.get(id) || Promise.resolve();
  const next = previous.catch(() => undefined).then(task);
  queues.set(id, next);
  try {
    return await next;
  } finally {
    if (queues.get(id) === next) queues.delete(id);
  }
}
app.get("/projects", (_req, res) => res.json(projects));
app.post("/projects", async (req, res) => {
  const { path: input } = z.object({ path: z.string().min(1) }).parse(req.body);
  res.json(await addProject(input));
});
app.delete("/projects/:id", async (req, res) => {
  projects = projects.filter((p) => p.id !== req.params.id);
  await save();
  res.json({ ok: true });
});
app.get("/projects/:id", async (req, res) =>
  res.json(await snapshot(projectFor(req.params.id))),
);
app.get("/projects/:id/files", async (req, res) => {
  const project = projectFor(req.params.id);
  res.json(
    await changedFiles(
      project.path,
      typeof req.query.commit === "string" ? req.query.commit : undefined,
      typeof req.query.base === "string" ? req.query.base : undefined,
    ),
  );
});
app.get("/projects/:id/tree", async (req, res) => {
  const project = projectFor(req.params.id);
  const commit =
    typeof req.query.commit === "string" ? req.query.commit : undefined;
  if (commit && !/^[a-f0-9]{7,40}$/.test(commit))
    throw new Error("Invalid commit");
  const raw = commit
    ? await git(project.path, ["ls-tree", "-r", "--name-only", "-z", commit])
    : await git(project.path, [
        "ls-files",
        "--cached",
        "--others",
        "--exclude-standard",
        "-z",
      ]);
  res.json([...new Set(raw.split("\0").filter(Boolean))].sort());
});
app.get("/projects/:id/file", async (req, res) => {
  const {
    path: name,
    commit,
    base,
    layer,
  } = z
    .object({
      path: z.string(),
      commit: z.string().optional(),
      base: z.string().optional(),
      layer: z.enum(["staged", "unstaged"]).optional(),
    })
    .parse(req.query);
  res.json(
    await fileContent(
      projectFor(req.params.id).path,
      name,
      commit,
      base,
      layer,
    ),
  );
});
const actionSchema = z.object({
  action: z.enum([
    "fetch",
    "pull",
    "push",
    "sync",
    "branch-create",
    "branch-switch",
    "branch-rename",
    "branch-delete",
    "worktree-create",
    "worktree-move",
    "worktree-remove",
    "stash-create",
    "stash-apply",
    "stash-pop",
    "stash-drop",
    "resolve",
    "stage",
    "unstage",
    "commit",
  ]),
  name: z.string().optional(),
  from: z.string().optional(),
  path: z.string().optional(),
  content: z.string().optional(),
});
const required = (value: string | undefined, label: string) => {
  if (!value?.trim() || value.startsWith("-") || value.includes("\0"))
    throw new Error(`${label} is required and cannot begin with a dash`);
  return value;
};
async function checkedBranch(cwd: string, name: string | undefined) {
  const branch = required(name, "Branch name");
  await git(cwd, ["check-ref-format", "--branch", branch]);
  return branch;
}
app.post("/projects/:id/action", async (req, res) => {
  const input = actionSchema.parse(req.body);
  const project = projectFor(req.params.id);
  const cwd = project.path;
  const result = await serial(project.id, async () => {
    let message = "Done";
    switch (input.action) {
      case "fetch":
        message =
          (await git(cwd, ["fetch", "--all", "--prune"])) || "Remotes fetched";
        break;
      case "pull":
        message = await git(cwd, ["pull", "--ff-only"]);
        break;
      case "push": {
        const branch = (
          await git(cwd, ["symbolic-ref", "--short", "HEAD"])
        ).trim();
        message =
          (await git(cwd, ["push", "--set-upstream", "origin", branch])) ||
          "Pushed to origin";
        break;
      }
      case "sync":
        message = await sync(cwd);
        break;
      case "branch-create":
        message = await git(cwd, [
          "switch",
          "-c",
          await checkedBranch(cwd, input.name),
        ]);
        break;
      case "branch-switch":
        message = await git(cwd, [
          "switch",
          await checkedBranch(cwd, input.name),
        ]);
        break;
      case "branch-rename":
        message = await git(cwd, [
          "branch",
          "-m",
          await checkedBranch(cwd, input.from),
          await checkedBranch(cwd, input.name),
        ]);
        break;
      case "branch-delete":
        message = await git(cwd, [
          "branch",
          "-d",
          await checkedBranch(cwd, input.name),
        ]);
        break;
      case "worktree-create":
        message = await git(cwd, [
          "worktree",
          "add",
          "-b",
          await checkedBranch(cwd, input.name),
          path.resolve(required(input.path, "Worktree path")),
        ]);
        break;
      case "worktree-move":
      case "worktree-remove": {
        const source = await realpath(required(input.from, "Worktree path"));
        const state = await snapshot(project);
        const tree = state.worktrees.find((w) => w.path === source);
        if (!tree || source === cwd) throw new Error("Select another worktree");
        if (tree.locked) throw new Error("Worktree is locked");
        if (input.action === "worktree-remove") {
          message = await git(cwd, ["worktree", "remove", source]);
          projects = projects.filter((p) => p.path !== source);
        } else {
          const dest = path.resolve(required(input.path, "New path"));
          message = await git(cwd, ["worktree", "move", source, dest]);
          const canonicalDest = await realpath(dest);
          projects = projects.map((p) =>
            p.path === source
              ? {
                  ...p,
                  path: canonicalDest,
                  name: path.basename(canonicalDest),
                }
              : p,
          );
        }
        await save();
        break;
      }
      case "stash-create":
        message = await git(cwd, [
          "stash",
          "push",
          "--include-untracked",
          "-m",
          input.name || "Stashed from Diffs",
        ]);
        break;
      case "stash-apply":
      case "stash-pop":
      case "stash-drop": {
        if (!/^stash@\{\d+\}$/.test(input.name || ""))
          throw new Error("Invalid stash");
        message = await git(cwd, [
          "stash",
          input.action.split("-")[1],
          input.name!,
        ]);
        break;
      }
      case "resolve":
        await resolveFile(
          cwd,
          required(input.path, "File"),
          input.content ?? "",
        );
        message = "Resolution saved and staged";
        break;
      case "commit": {
        const msg = required(input.name, "Commit message");
        const files = await changedFiles(cwd);
        if (files.some((f) => f.conflict))
          throw new Error("Resolve conflicts first");
        if (!files.some((file) => file.staged))
          throw new Error("Stage changes before committing");
        message = await git(cwd, ["commit", "-m", msg]);
        break;
      }
      case "stage":
      case "unstage": {
        const target = input.path;
        if (!target) throw new Error("Select a file or folder");
        if (target !== ".") await safeFile(cwd, target);
        const files = (await changedFiles(cwd)).filter(
          (file) =>
            (target === "." ||
              file.path === target ||
              file.path.startsWith(`${target}/`)) &&
            (input.action === "stage" ? file.unstaged : file.staged),
        );
        const paths = [
          ...new Set(
            files.flatMap((file) =>
              input.action === "unstage" && file.oldPath
                ? [file.oldPath, file.path]
                : [file.path],
            ),
          ),
        ];
        if (!paths.length) break;
        if (input.action === "stage") {
          await git(cwd, ["--literal-pathspecs", "add", "-A", "--", ...paths]);
        } else {
          const hasHead = await git(cwd, [
            "rev-parse",
            "--verify",
            "HEAD",
          ]).then(
            () => true,
            () => false,
          );
          await git(cwd, [
            "--literal-pathspecs",
            ...(hasHead
              ? ["reset", "-q", "HEAD"]
              : ["rm", "--cached", "--force", "--ignore-unmatch"]),
            "--",
            ...paths,
          ]);
        }
        message = `${input.action === "stage" ? "Staged" : "Unstaged"} ${files.length} file${files.length === 1 ? "" : "s"}`;
        break;
      }
    }
    return { message: message.trim() || "Done" };
  });
  res.json(result);
});
app.use(
  (
    error: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => res.status(400).json({ error: error.message }),
);
app.listen(port, "127.0.0.1", () =>
  console.log(
    `Diffs local bridge listening at http://127.0.0.1:${port}\n${projects.length} repositories available. Pairing key: ${tokenPath}\nAllowed apps: ${[...origins].join(", ")}`,
  ),
);
