const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  mkdtemp,
  mkdir,
  writeFile,
  symlink,
  rm,
  realpath,
} = require("node:fs/promises");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { resolveProjectFile } = require("./file-actions.cjs");
test("desktop file actions are restricted to the registered project", async () => {
  const temp = await mkdtemp(path.join(tmpdir(), "donkey-diff-file-action-"));
  try {
    const root = path.join(temp, "repo");
    await mkdir(root);
    await writeFile(path.join(root, "file.txt"), "contents");
    await symlink(temp, path.join(root, "escape"));
    const projects = [{ id: "repo", path: root }];
    assert.equal(
      await resolveProjectFile(projects, "repo", "file.txt"),
      await realpath(path.join(root, "file.txt")),
    );
    for (const relative of [
      "../outside",
      "/etc/passwd",
      ".git/config",
      "escape",
      "missing.txt",
    ])
      await assert.rejects(resolveProjectFile(projects, "repo", relative));
    await assert.rejects(resolveProjectFile(projects, "unknown", "file.txt"));
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
