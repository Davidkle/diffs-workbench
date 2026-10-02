import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm, truncate } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileContent, git } from "./git.js";

const decode = (url: string) => Buffer.from(url.split(",")[1], "base64");

test("large .bin files are reported as binary without the text viewing limit", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "donkey-binary-"));
  try {
    await git(dir, ["init", "-b", "main"]);
    await writeFile(path.join(dir, "weights.BIN"), "");
    await truncate(path.join(dir, "weights.BIN"), 6 * 1024 * 1024);
    const content = await fileContent(dir, "weights.BIN");
    assert.equal(content.binary, true);
    assert.equal(content.old, "");
    assert.equal(content.current, "");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("media preserves bytes across commits, index, working tree, renames and deletions", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "donkey-media-"));
  const name = "poster #1.JPG";
  const original = Buffer.from([0xff, 0xd8, 0xff, 0, 0xfe, 0x80]);
  const stagedBytes = Buffer.from([0xff, 0xd8, 0xff, 0, 0x81]);
  const workingBytes = Buffer.from([0xff, 0xd8, 0xff, 0, 0x82]);
  try {
    await git(dir, ["init", "-b", "main"]);
    await git(dir, ["config", "user.email", "tests@example.com"]);
    await git(dir, ["config", "user.name", "Test"]);
    await writeFile(path.join(dir, name), original);
    assert.equal((await fileContent(dir, name)).old, "");
    await git(dir, ["add", "."]);
    await git(dir, ["commit", "-m", "Initial media"]);
    const root = (await git(dir, ["rev-parse", "HEAD"])).trim();
    const initial = await fileContent(dir, name, root);
    assert.equal(initial.binary, true);
    assert.equal(initial.mediaType, "image/jpeg");
    assert.equal(initial.old, "");
    assert.deepEqual(decode(initial.current), original);

    await writeFile(path.join(dir, name), stagedBytes);
    await git(dir, ["add", "."]);
    await writeFile(path.join(dir, name), workingBytes);
    const staged = await fileContent(dir, name, undefined, undefined, "staged");
    assert.deepEqual(decode(staged.old), original);
    assert.deepEqual(decode(staged.current), stagedBytes);
    const unstaged = await fileContent(
      dir,
      name,
      undefined,
      undefined,
      "unstaged",
    );
    assert.deepEqual(decode(unstaged.old), stagedBytes);
    assert.deepEqual(decode(unstaged.current), workingBytes);
    await git(dir, ["commit", "-m", "Staged media"]);
    const next = (await git(dir, ["rev-parse", "HEAD"])).trim();
    const comparison = await fileContent(dir, name, next, root);
    assert.deepEqual(decode(comparison.old), original);
    assert.deepEqual(decode(comparison.current), stagedBytes);

    await git(dir, ["restore", "--", name]);
    await git(dir, ["mv", name, "renamed.jpg"]);
    const renamed = await fileContent(
      dir,
      "renamed.jpg",
      undefined,
      undefined,
      "staged",
    );
    assert.deepEqual(decode(renamed.old), stagedBytes);
    assert.equal(renamed.old, renamed.current);
    await git(dir, ["commit", "-m", "Rename media"]);
    await git(dir, ["rm", "renamed.jpg"]);
    const deleted = await fileContent(dir, "renamed.jpg");
    assert.deepEqual(decode(deleted.old), stagedBytes);
    assert.equal(deleted.current, "");
    await git(dir, ["commit", "-m", "Delete media"]);
    const deletion = (await git(dir, ["rev-parse", "HEAD"])).trim();
    assert.equal(
      (await fileContent(dir, "renamed.jpg", deletion)).old,
      deleted.old,
    );

    await writeFile(path.join(dir, "sound.mp3"), workingBytes);
    assert.equal((await fileContent(dir, "sound.mp3")).mediaType, "audio/mpeg");
    await writeFile(path.join(dir, "unknown.bin"), workingBytes);
    assert.equal((await fileContent(dir, "unknown.bin")).mediaType, undefined);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("videos above the text limit load, media limits and cancellation remain enforced", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "donkey-video-"));
  try {
    await git(dir, ["init", "-b", "main"]);
    await git(dir, ["config", "user.email", "tests@example.com"]);
    await git(dir, ["config", "user.name", "Test"]);
    const target = path.join(dir, "demo.mp4");
    const bytes = Buffer.alloc(6 * 1024 * 1024, 0x80);
    await writeFile(target, bytes);
    const video = await fileContent(dir, "demo.mp4");
    assert.equal(video.mediaType, "video/mp4");
    assert.deepEqual(decode(video.current), bytes);
    await git(dir, ["add", "."]);
    await git(dir, ["commit", "-m", "Video"]);
    const commit = (await git(dir, ["rev-parse", "HEAD"])).trim();
    assert.deepEqual(
      decode((await fileContent(dir, "demo.mp4", commit)).current),
      bytes,
    );
    await truncate(target, 20 * 1024 * 1024 + 1);
    await assert.rejects(fileContent(dir, "demo.mp4"), /20 MB preview limit/);
    await git(dir, ["add", "."]);
    await assert.rejects(
      fileContent(dir, "demo.mp4", undefined, undefined, "staged"),
      /20 MB preview limit/,
    );
    await assert.rejects(fileContent(dir, "../demo.mp4"), /Invalid file path/);
    await assert.rejects(
      fileContent(dir, "demo.mp4", "--help"),
      /Invalid commit/,
    );
    await assert.rejects(
      fileContent(
        dir,
        "demo.mp4",
        commit,
        undefined,
        undefined,
        AbortSignal.abort(),
      ),
      /abort/i,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
