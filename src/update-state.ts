export type UpdateState = {
  status:
    | "notChecked"
    | "checking"
    | "upToDate"
    | "available"
    | "installing"
    | "requiresAdmin"
    | "unavailable"
    | "failed";
  currentVersion: string;
  latestVersion?: string;
  message?: string;
};

export function updateButtonState(state: UpdateState) {
  const active = state.status === "available";
  const pending = state.status === "checking" || state.status === "installing";
  return {
    visible: active || state.status === "installing",
    active,
    pending,
    disabled:
      pending ||
      state.status === "requiresAdmin" ||
      state.status === "unavailable",
    label:
      state.status === "checking"
        ? "Checking…"
        : state.status === "installing"
          ? "Updating…"
          : "Update",
    description: active
      ? `Install ${state.latestVersion || "update"} and restart Donkey Diff`
      : state.status === "upToDate"
        ? `Donkey Diff ${state.currentVersion} is up to date`
        : state.message || "Check for updates",
  };
}
