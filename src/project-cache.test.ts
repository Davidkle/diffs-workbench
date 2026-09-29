import test from "node:test";
import assert from "node:assert/strict";
import { ProjectCache } from "./project-cache.ts";

test("concurrent refreshes share a read while another project loads independently", async () => {
  const cache = new ProjectCache<string>();
  let finish!: (value: string) => void;
  let reads = 0;
  const read = () => {
    reads++;
    return new Promise<string>((resolve) => {
      finish = resolve;
    });
  };
  const first = cache.load("large", read);
  const second = cache.load("large", read);
  assert.equal(first, second);
  assert.equal(reads, 1);
  assert.equal(await cache.load("small", async () => "ready"), "ready");
  finish("large ready");
  await first;
  assert.equal(cache.get("large"), "large ready");
  const updated = await cache.load("large", async () => "updated");
  assert.equal(updated, "updated");
});

test("failed reads can retry and cache memory is bounded", async () => {
  const cache = new ProjectCache<number>(2);
  await assert.rejects(
    cache.load("a", async () => {
      throw new Error("offline");
    }),
  );
  await cache.load("a", async () => 1);
  await cache.load("b", async () => 2);
  await cache.load("c", async () => 3);
  assert.equal(cache.get("a"), undefined);
  assert.equal(cache.get("b"), 2);
  assert.equal(cache.get("c"), 3);
});
