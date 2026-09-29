import test from "node:test";
import assert from "node:assert/strict";
import { BooleanPreferences, preferenceKey } from "./preferences.ts";

test("folder, section, and panel states survive remounts and restarts independently per project", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  const prefs = new BooleanPreferences(storage);
  const parent = preferenceKey("a", "files", "src");
  const child = preferenceKey("a", "files", "src/components");
  const panel = preferenceKey("a", "panels", "history");
  const section = preferenceKey("a", "sections", "Tags");
  prefs.set(child, false);
  prefs.set(parent, false);
  prefs.set(panel, false);
  prefs.set(section, false);
  prefs.set(parent, true);
  const restarted = new BooleanPreferences(storage);
  assert.equal(restarted.get(parent, false), true);
  for (const key of [child, panel, section])
    assert.equal(restarted.get(key, true), false);
  assert.equal(
    restarted.get(preferenceKey("b", "files", "src/components"), true),
    true,
  );
  assert.equal(
    restarted.get(preferenceKey("a", "branches", "src/components"), true),
    true,
  );
});

test("preferences notify only matching subscribers and tolerate unavailable storage", () => {
  const prefs = new BooleanPreferences({
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("full");
    },
  });
  let calls = 0;
  const unsubscribe = prefs.subscribe("a", () => calls++);
  prefs.set("b", false);
  assert.equal(calls, 0);
  prefs.set("a", false);
  assert.equal(calls, 1);
  assert.equal(prefs.get("a", true), false);
  unsubscribe();
  prefs.set("a", true);
  assert.equal(calls, 1);
});
