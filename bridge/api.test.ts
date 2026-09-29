import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  realpath,
} from "node:fs/promises";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { git } from "./git.js";

test("authenticated bridge supports branch, stash, worktree and remote workflows", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "diffs-api-"));
  const repo = path.join(tmp, "repo");
  const data = path.join(tmp, "data");
  const remote = path.join(tmp, "remote.git");
  await git(tmp, ["init", "-b", "main", repo]);
  await git(repo, ["config", "user.name", "Test"]);
  await git(repo, ["config", "user.email", "test@example.com"]);
  await writeFile(path.join(repo, "file.txt"), "initial\n");
  await git(repo, ["add", "."]);
  await git(repo, ["commit", "-m", "Initial"]);
  await git(tmp, ["init", "--bare", remote]);
  await git(repo, ["remote", "add", "origin", remote]);
  await git(repo, ["push", "-u", "origin", "main"]);
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "bridge/server.ts", repo],
    {
      cwd: process.cwd(),
      env: { ...process.env, DIFFS_PORT: "43128", DIFFS_DATA_DIR: data },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  try {
    await new Promise<void>((resolve, reject) => {
      let output = "";
      const timer = setTimeout(
        () => reject(new Error("Bridge failed to start")),
        10000,
      );
      child.stdout.on("data", (d) => {
        output += d.toString();
        if (output.includes("listening")) {
          clearTimeout(timer);
          resolve();
        }
      });
      child.once("exit", (code) => {
        clearTimeout(timer);
        reject(new Error(`Bridge exited: ${code}`));
      });
    });
    const token = (await readFile(path.join(data, "token"), "utf8")).trim();
    const base = "http://127.0.0.1:43128";
    assert.equal((await fetch(`${base}/projects`)).status, 401);
    assert.equal(
      (
        await fetch(`${base}/projects`, {
          headers: {
            Origin: "https://evil.example",
            Authorization: `Bearer ${token}`,
          },
        })
      ).status,
      403,
    );
    assert.equal((await fetch(`${base}/pair`)).status, 403);
    assert.equal(
      (
        await fetch(`${base}/pair?origin=https://evil.example`, {
          headers: { "Sec-Fetch-Mode": "navigate" },
        })
      ).status,
      403,
    );
    async function api(route: string, body?: unknown) {
      const response = await fetch(base + route, {
        method: body ? "POST" : "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      return result;
    }
    const projects = await api("/projects");
    assert.equal(projects.length, 1);
    const id = projects[0].id;
    const action = (type: string, extra: Record<string, string> = {}) =>
      api(`/projects/${id}/action`, { action: type, ...extra });
    await action("branch-create", { name: "feature" });
    assert.equal((await api(`/projects/${id}`)).branch, "feature");
    await action("branch-rename", { from: "feature", name: "renamed" });
    await action("branch-switch", { name: "main" });
    await action("branch-delete", { name: "renamed" });
    await assert.rejects(action("branch-create", { name: "--orphan" }));
    await writeFile(path.join(repo, "file.txt"), "changed\n");
    await action("stash-create", { name: "Test stash" });
    assert.equal((await api(`/projects/${id}`)).stashes.length, 1);
    assert.equal(
      await readFile(path.join(repo, "file.txt"), "utf8"),
      "initial\n",
    );
    await action("stash-pop", { name: "stash@{0}" });
    assert.equal(
      await readFile(path.join(repo, "file.txt"), "utf8"),
      "changed\n",
    );
    await assert.rejects(
      action("commit", { name: "Nothing staged" }),
      /Stage changes/,
    );
    await action("stage", { path: "file.txt" });
    await writeFile(path.join(repo, "file.txt"), "unstaged follow-up\n");
    const partial = (await api(`/projects/${id}`)).files.find(
      (file: { path: string }) => file.path === "file.txt",
    );
    assert.equal(partial.staged, true);
    assert.equal(partial.unstaged, true);
    const staged = await api(`/projects/${id}/file?path=file.txt&layer=staged`);
    const unstaged = await api(
      `/projects/${id}/file?path=file.txt&layer=unstaged`,
    );
    assert.equal(staged.old, "initial\n");
    assert.equal(staged.current, "changed\n");
    assert.equal(unstaged.old, "changed\n");
    assert.equal(unstaged.current, "unstaged follow-up\n");
    await action("commit", { name: "Only staged changes" });
    assert.equal(await git(repo, ["show", "HEAD:file.txt"]), "changed\n");
    assert.equal(
      await readFile(path.join(repo, "file.txt"), "utf8"),
      "unstaged follow-up\n",
    );
    await mkdir(path.join(repo, "folder"));
    await writeFile(path.join(repo, "folder/a.txt"), "a\n");
    await writeFile(path.join(repo, "folder/b.txt"), "b\n");
    await writeFile(path.join(repo, "folder-sibling.txt"), "sibling\n");
    await action("stage", { path: "folder" });
    assert.deepEqual(
      (await git(repo, ["diff", "--cached", "--name-only"])).trim().split("\n"),
      ["folder/a.txt", "folder/b.txt"],
    );
    await action("unstage", { path: "folder" });
    assert.equal(await git(repo, ["diff", "--cached", "--name-only"]), "");
    assert.equal(
      await readFile(path.join(repo, "folder/a.txt"), "utf8"),
      "a\n",
    );
    await writeFile(path.join(repo, ":(glob)*"), "literal\n");
    await action("stage", { path: ":(glob)*" });
    assert.equal(
      (await git(repo, ["diff", "--cached", "--name-only"])).trim(),
      ":(glob)*",
    );
    await action("unstage", { path: ":(glob)*" });
    await assert.rejects(
      action("stage", { path: "../outside" }),
      /Invalid file/,
    );
    await action("stage", { path: "." });
    await action("commit", { name: "Updated" });
    await action("push");
    await action("pull");
    assert.match((await action("sync")).message, /Up to date/);
    const tree = path.join(tmp, "tree");
    const moved = path.join(tmp, "moved");
    await action("worktree-create", { name: "tree", path: tree });
    assert.equal((await api(`/projects/${id}`)).worktrees.length, 2);
    await action("worktree-move", { from: tree, path: moved });
    const canonicalMoved = await realpath(moved);
    assert.ok(
      (await api(`/projects/${id}`)).worktrees.some(
        (w: { path: string }) => w.path === canonicalMoved,
      ),
    );
    await action("worktree-remove", { from: moved });
    assert.equal((await api(`/projects/${id}`)).worktrees.length, 1);
  } finally {
    child.kill("SIGTERM");
    await new Promise<void>((resolve) => {
      if (child.exitCode !== null) resolve();
      else child.once("exit", () => resolve());
    });
    await rm(tmp, { recursive: true, force: true });
  }
});
