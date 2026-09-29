import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm, symlink, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  git,
  parseStatus,
  changedFiles,
  fileContent,
  snapshot,
  sync,
  safeFile,
  resolveFile,
} from "./git.js";
async function fixture() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "diffs-test-"));
  await git(dir, ["init", "-b", "main"]);
  await git(dir, ["config", "user.email", "tests@example.com"]);
  await git(dir, ["config", "user.name", "Test"]);
  await writeFile(path.join(dir, "hello.ts"), 'const hello = "world";\n');
  await git(dir, ["add", "."]);
  await git(dir, ["commit", "-m", "Initial"]);
  return dir;
}
test("porcelain parser handles spaces, staged renames and conflicts", () => {
  const files = parseStatus(
    " M src/a file.ts\0R  new.ts\0old.ts\0?? fresh.ts\0UU conflict.ts\0",
  );
  assert.equal(files[0].path, "src/a file.ts");
  assert.equal(files[1].oldPath, "old.ts");
  assert.equal(files[1].staged, true);
  assert.equal(files[2].status, "A");
  assert.equal(files[3].conflict, true);
});
test("working changes compare HEAD to disk and root commits are viewable", async () => {
  const dir = await fixture();
  try {
    await writeFile(path.join(dir, "hello.ts"), 'const hello = "changed";\n');
    await writeFile(path.join(dir, "new file.ts"), "export {};\n");
    const files = await changedFiles(dir);
    assert.equal(files.length, 2);
    const content = await fileContent(dir, "hello.ts");
    assert.match(content.old, /world/);
    assert.match(content.current, /changed/);
    const state = await snapshot({ id: "test", name: "test", path: dir });
    assert.equal(state.commits.length, 1);
    assert.equal(state.branch, "main");
    const historical = await fileContent(
      dir,
      "hello.ts",
      state.commits[0].hash,
    );
    assert.equal(historical.old, "");
    assert.match(historical.current, /world/);
    const historicalFiles = await changedFiles(dir, state.commits[0].hash);
    assert.equal(historicalFiles[0].path, "hello.ts");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("file paths cannot escape a repository or access Git internals", async () => {
  const dir = await fixture();
  try {
    await assert.rejects(safeFile(dir, "../private"));
    await assert.rejects(safeFile(dir, ".git/config"));
    await symlink("/etc/passwd", path.join(dir, "link"));
    await assert.rejects(safeFile(dir, "link"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("conflict versions and resolution preserve intended content", async () => {
  const dir = await fixture();
  try {
    await git(dir, ["switch", "-c", "feature"]);
    await writeFile(path.join(dir, "hello.ts"), 'const hello = "incoming";\n');
    await git(dir, ["commit", "-am", "Incoming"]);
    await git(dir, ["switch", "main"]);
    await writeFile(path.join(dir, "hello.ts"), 'const hello = "current";\n');
    await git(dir, ["commit", "-am", "Current"]);
    await assert.rejects(git(dir, ["merge", "feature"]));
    const content = await fileContent(dir, "hello.ts");
    assert.equal(content.conflict, true);
    assert.match(content.ours!, /current/);
    assert.match(content.theirs!, /incoming/);
    await assert.rejects(resolveFile(dir, "hello.ts", content.current));
    await resolveFile(dir, "hello.ts", 'const hello = "resolved";\n');
    assert.equal((await changedFiles(dir))[0].conflict, false);
    assert.match(
      await readFile(path.join(dir, "hello.ts"), "utf8"),
      /resolved/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("sync fetches but never changes a dirty worktree", async () => {
  const dir = await fixture();
  const remote = await mkdtemp(path.join(os.tmpdir(), "diffs-remote-"));
  try {
    await git(remote, ["init", "--bare"]);
    await git(dir, ["remote", "add", "origin", remote]);
    await git(dir, ["push", "-u", "origin", "main"]);
    await writeFile(path.join(dir, "hello.ts"), "local work\n");
    assert.match(await sync(dir), /paused/);
    assert.equal(
      await readFile(path.join(dir, "hello.ts"), "utf8"),
      "local work\n",
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
    await rm(remote, { recursive: true, force: true });
  }
});

test("two selected commits compare exact endpoints, including non-adjacent changes", async () => {
  const dir = await fixture();
  try {
    const base = (await git(dir, ["rev-parse", "HEAD"])).trim();
    await writeFile(path.join(dir, "hello.ts"), "middle\n");
    await writeFile(path.join(dir, "added.ts"), "added\n");
    await git(dir, ["add", "."]);
    await git(dir, ["commit", "-m", "Middle"]);
    await writeFile(path.join(dir, "hello.ts"), "latest\n");
    await git(dir, ["commit", "-am", "Latest"]);
    const target = (await git(dir, ["rev-parse", "HEAD"])).trim();
    const changes = await changedFiles(dir, target, base);
    assert.deepEqual(changes.map((f) => f.path).sort(), [
      "added.ts",
      "hello.ts",
    ]);
    const file = await fileContent(dir, "hello.ts", target, base);
    assert.match(file.old, /world/);
    assert.equal(file.current, "latest\n");
    assert.equal((await fileContent(dir, "added.ts", target, base)).old, "");
    const reverse = await changedFiles(dir, base, target);
    assert.equal(reverse.find((f) => f.path === "added.ts")?.status, "D");
    assert.deepEqual(await changedFiles(dir, target, target), []);
    await assert.rejects(changedFiles(dir, target, "--help"), /Invalid commit/);
    await assert.rejects(changedFiles(dir, undefined, base), /target commit/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("deleted project directories report recovery instructions and do not break other projects", async () => {
  const removed = await fixture();
  const healthy = await fixture();
  await rm(removed, { recursive: true });
  try {
    const missing = { id: "removed", name: "removed", path: removed };
    await assert.rejects(
      snapshot(missing),
      /Project folder is no longer available.*Open its new location/,
    );
    await assert.rejects(
      git(removed, ["status"]),
      /Project folder is no longer available/,
    );
    const state = await snapshot({
      id: "healthy",
      name: "healthy",
      path: healthy,
    });
    assert.equal(state.branch, "main");
    assert.equal(state.commits.length, 1);
  } finally {
    await rm(healthy, { recursive: true, force: true });
  }
});
