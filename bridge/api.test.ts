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
import { createServer } from "node:net";
import { git } from "./git.js";

test("authenticated bridge supports branch, stash, worktree and remote workflows", async () => {
  const listener = createServer();
  await new Promise<void>((resolve) =>
    listener.listen(0, "127.0.0.1", resolve),
  );
  const address = listener.address();
  assert.ok(address && typeof address !== "string");
  const port = address.port;
  await new Promise<void>((resolve, reject) =>
    listener.close((error) => (error ? reject(error) : resolve())),
  );
  const tmp = await mkdtemp(path.join(os.tmpdir(), "donkey-diff-api-"));
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
  const savedTree = path.join(tmp, "saved-worktree");
  await git(repo, ["worktree", "add", "-b", "saved", savedTree]);
  await mkdir(data);
  // Existing installations saved both repositories and worktrees without metadata.
  await writeFile(
    path.join(data, "projects.json"),
    JSON.stringify([
      { id: "1111111111111111", name: "repo", path: await realpath(repo) },
      {
        id: "2222222222222222",
        name: "saved-worktree",
        path: await realpath(savedTree),
      },
    ]),
  );
  const agent = path.join(tmp, "fake-claude");
  await writeFile(
    agent,
    `#!/usr/bin/env node
process.stdout.write(JSON.stringify({type:'system',subtype:'init',session_id:'fixture'})+'\\n');
setInterval(() => {}, 1000);
`,
    { mode: 0o755 },
  );
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "bridge/server.ts", repo],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DONKEY_DIFF_PORT: String(port),
        DONKEY_DIFF_DATA_DIR: data,
        DONKEY_DIFF_CLAUDE_BIN: agent,
      },
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
    const base = `http://127.0.0.1:${port}`;
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
    assert.equal(projects.length, 2);
    assert.equal(projects[0].isWorktree, false);
    assert.equal(projects[1].isWorktree, true);
    const id = projects[0].id;
    await api(`/projects/${id}/action`, {
      action: "worktree-remove",
      from: savedTree,
    });
    assert.equal((await fetch(`${base}/projects/${id}/chat`)).status, 401);
    assert.deepEqual(await api(`/projects/${id}/chat`), {
      sessions: [],
      skills: [],
    });
    await assert.rejects(
      api(`/projects/${id}/chat/send`, {
        provider: "codex",
        model: "",
        effort: "",
        text: "",
      }),
    );
    await assert.rejects(
      api(`/projects/${id}/chat/stop`, { sessionId: "../outside" }),
    );
    await assert.rejects(
      api("/projects/0000000000000000/chat"),
      /Project not found/,
    );
    const navigation = await api(`/projects/${id}/navigation`);
    assert.equal(navigation.branch, "main");
    assert.equal(navigation.files.length, 0);
    assert.equal(
      (await api(`/projects/${id}/history?ref=refs%2Fheads%2Fmain`))[0].subject,
      "Initial",
    );
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
    // Manual Pull allows both fast-forwards and merges, even with restrictive
    // user preferences. All repository mutations here use disposable fixtures.
    const peer = path.join(tmp, "peer");
    await git(tmp, ["clone", "-b", "main", remote, peer]);
    await git(peer, ["config", "user.name", "Test"]);
    await git(peer, ["config", "user.email", "test@example.com"]);
    await git(repo, ["config", "pull.ff", "only"]);
    await git(repo, ["config", "pull.rebase", "true"]);
    await git(repo, ["config", "branch.main.rebase", "true"]);
    await writeFile(path.join(peer, "remote.txt"), "remote one\n");
    await git(peer, ["add", "."]);
    await git(peer, ["commit", "-m", "Remote fast-forward"]);
    await git(peer, ["push"]);
    const fastForwardTip = (await git(peer, ["rev-parse", "HEAD"])).trim();
    await action("pull");
    assert.equal(
      (await git(repo, ["rev-parse", "HEAD"])).trim(),
      fastForwardTip,
    );

    await writeFile(path.join(repo, "local.txt"), "local commit\n");
    await git(repo, ["add", "."]);
    await git(repo, ["commit", "-m", "Local divergence"]);
    const localTip = (await git(repo, ["rev-parse", "HEAD"])).trim();
    await writeFile(path.join(peer, "remote.txt"), "remote two\n");
    await git(peer, ["commit", "-am", "Remote divergence"]);
    await git(peer, ["push"]);
    const remoteTip = (await git(peer, ["rev-parse", "HEAD"])).trim();
    assert.match((await action("sync")).message, /diverged/);
    assert.equal((await git(repo, ["rev-parse", "HEAD"])).trim(), localTip);
    await action("pull");
    assert.deepEqual(
      (await git(repo, ["show", "-s", "--format=%P", "HEAD"]))
        .trim()
        .split(" "),
      [localTip, remoteTip],
    );
    assert.equal(
      await readFile(path.join(repo, "local.txt"), "utf8"),
      "local commit\n",
    );
    assert.equal(
      await readFile(path.join(repo, "remote.txt"), "utf8"),
      "remote two\n",
    );
    const mergedTip = (await git(repo, ["rev-parse", "HEAD"])).trim();
    await action("pull");
    assert.equal((await git(repo, ["rev-parse", "HEAD"])).trim(), mergedTip);

    await writeFile(path.join(peer, "remote.txt"), "remote three\n");
    await git(peer, ["commit", "-am", "Remote follow-up"]);
    await git(peer, ["push"]);
    await writeFile(
      path.join(repo, "remote.txt"),
      "keep my uncommitted work\n",
    );
    await assert.rejects(action("pull"), /local changes.*overwritten/s);
    assert.equal(
      await readFile(path.join(repo, "remote.txt"), "utf8"),
      "keep my uncommitted work\n",
    );
    assert.equal((await git(repo, ["rev-parse", "HEAD"])).trim(), mergedTip);
    await writeFile(path.join(repo, "remote.txt"), "remote two\n");
    const tree = path.join(tmp, "tree");
    const moved = path.join(tmp, "moved");
    await action("worktree-create", { name: "tree", path: tree });
    assert.equal((await api(`/projects/${id}`)).worktrees.length, 2);
    const linked = await api("/projects", { path: tree });
    assert.equal(linked.isWorktree, true);
    const linkedAction = (action: string, input: Record<string, string>) =>
      api(`/projects/${linked.id}/action`, { action, ...input });
    const checkChatGuard = async (source: string, destination: string) => {
      const { sessionId } = await api(`/projects/${linked.id}/chat/send`, {
        provider: "claude",
        model: "",
        effort: "",
        text: "wait",
      });
      await assert.rejects(
        action("worktree-move", { from: source, path: destination }),
        /chat to finish/,
      );
      await assert.rejects(
        action("worktree-remove", { from: source }),
        /chat to finish/,
      );
      assert.equal(
        await readFile(path.join(source, "file.txt"), "utf8"),
        await readFile(path.join(repo, "file.txt"), "utf8"),
      );
      await api(`/projects/${linked.id}/chat/stop`, { sessionId });
    };
    await checkChatGuard(tree, moved);
    await linkedAction("worktree-move", { from: tree, path: moved });
    const canonicalMoved = await realpath(moved);
    assert.ok(
      (await api(`/projects/${id}`)).worktrees.some(
        (w: { path: string }) => w.path === canonicalMoved,
      ),
    );
    assert.equal(
      (await api(`/projects/${linked.id}`)).project.path,
      canonicalMoved,
    );
    // Moving a registered checkout preserves its ID; guard that ID as well.
    await checkChatGuard(moved, tree);
    await writeFile(path.join(moved, "untracked.txt"), "keep me");
    await assert.rejects(
      linkedAction("worktree-remove", { from: moved }),
      /untracked|modified/,
    );
    await rm(path.join(moved, "untracked.txt"));
    await git(repo, ["worktree", "lock", moved]);
    await assert.rejects(
      linkedAction("worktree-remove", { from: moved }),
      /locked/i,
    );
    await git(repo, ["worktree", "unlock", moved]);
    await linkedAction("worktree-remove", { from: moved });
    assert.equal(
      (await api("/projects")).some((p: { id: string }) => p.id === linked.id),
      false,
    );
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
