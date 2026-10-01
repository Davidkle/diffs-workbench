import { test } from "node:test";
import assert from "node:assert/strict";
import { tabShortcutIndex } from "./tab-shortcuts.js";

const event = (key: string, modifiers: Partial<KeyboardEvent> = {}) => ({
  key,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  isComposing: false,
  ...modifiers,
});

test("tab cycling wraps in both directions with Chrome shortcuts", () => {
  for (const isMac of [false, true]) {
    assert.equal(
      tabShortcutIndex(event("Tab", { ctrlKey: true }), isMac, 2, 3),
      0,
    );
    assert.equal(
      tabShortcutIndex(
        event("Tab", { ctrlKey: true, shiftKey: true }),
        isMac,
        0,
        3,
      ),
      2,
    );
  }
  assert.equal(
    tabShortcutIndex(
      event("ArrowRight", { metaKey: true, altKey: true }),
      true,
      2,
      3,
    ),
    0,
  );
  assert.equal(
    tabShortcutIndex(
      event("ArrowLeft", { metaKey: true, altKey: true }),
      true,
      0,
      3,
    ),
    2,
  );
  assert.equal(
    tabShortcutIndex(event("PageDown", { ctrlKey: true }), false, 0, 3),
    1,
  );
  assert.equal(
    tabShortcutIndex(event("PageUp", { ctrlKey: true }), false, 0, 3),
    2,
  );
});

test("number shortcuts select positions 1–8 and 9 selects the last tab", () => {
  for (const isMac of [false, true]) {
    const modifiers = isMac ? { metaKey: true } : { ctrlKey: true };
    assert.equal(tabShortcutIndex(event("1", modifiers), isMac, 2, 12), 0);
    assert.equal(tabShortcutIndex(event("8", modifiers), isMac, 0, 12), 7);
    assert.equal(tabShortcutIndex(event("9", modifiers), isMac, 0, 12), 11);
    assert.equal(
      tabShortcutIndex(event("8", modifiers), isMac, 0, 3),
      undefined,
    );
  }
});

test("unrelated keys, extra modifiers, composition, and empty tabs are ignored", () => {
  for (const input of [
    event("Tab"),
    event("ArrowLeft", { metaKey: true }),
    event("1", { metaKey: true, shiftKey: true }),
    event("Tab", { ctrlKey: true, altKey: true }),
    event("Tab", { ctrlKey: true, isComposing: true }),
  ])
    assert.equal(tabShortcutIndex(input, true, 0, 3), undefined);
  assert.equal(
    tabShortcutIndex(event("Tab", { ctrlKey: true }), true, 0, 0),
    undefined,
  );
  assert.equal(
    tabShortcutIndex(event("Tab", { ctrlKey: true }), true, 0, 1),
    0,
  );
});
