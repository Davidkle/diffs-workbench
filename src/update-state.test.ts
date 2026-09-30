import { test } from "node:test";
import assert from "node:assert/strict";
import { updateButtonState, type UpdateState } from "./update-state.ts";

test("only an installable update activates the blue button", () => {
  const statuses: UpdateState["status"][] = [
    "notChecked",
    "checking",
    "upToDate",
    "available",
    "installing",
    "requiresAdmin",
    "unavailable",
    "failed",
  ];
  for (const status of statuses) {
    const button = updateButtonState({
      status,
      currentVersion: "1.0",
      latestVersion: "1.1",
    });
    assert.equal(button.active, status === "available");
    assert.equal(button.visible, ["available", "installing"].includes(status));
    assert.equal(
      button.disabled,
      ["checking", "installing", "requiresAdmin", "unavailable"].includes(
        status,
      ),
    );
  }
  assert.match(
    updateButtonState({
      status: "available",
      currentVersion: "1",
      latestVersion: "2",
    }).description,
    /Install 2 and restart/,
  );
  assert.match(
    updateButtonState({
      status: "failed",
      currentVersion: "1",
      message: "Invalid signature",
    }).description,
    /Invalid signature/,
  );
});
