import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { updateButtonState, type UpdateState } from "@/update-state";

type Props = { busy: boolean };
export function UpdateButton({ busy }: Props) {
  const [state, setState] = useState<UpdateState>({
    status: "notChecked",
    currentVersion: "",
  });
  const desktop = window.donkeyDiffDesktop;
  useEffect(() => {
    if (!desktop) return;
    let alive = true;
    let receivedEvent = false;
    const unsubscribe = desktop.onUpdateState((next) => {
      receivedEvent = true;
      if (alive) setState(next);
    });
    void desktop
      .getUpdateState()
      .then((next) => {
        if (alive && !receivedEvent) setState(next);
      })
      .catch((error: Error) => {
        if (alive)
          setState({
            status: "failed",
            currentVersion: "",
            message: error.message,
          });
      });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [desktop]);
  if (!desktop) return null;
  const button = updateButtonState(state);
  if (!button.visible) return null;
  return (
    <button
      className={`app-update ${button.active ? "update-available" : ""}`}
      disabled={busy || button.disabled}
      title={
        busy
          ? "Wait for the current Git operation to finish"
          : button.description
      }
      aria-label={button.description}
      onClick={() => {
        void desktop.activateUpdate().catch((error: Error) => {
          setState((previous) => ({
            ...previous,
            status: "failed",
            message: error.message,
          }));
        });
      }}
    >
      {button.pending ? (
        <Loader2 size={13} className="animate-spin" />
      ) : (
        <Download size={13} />
      )}
      <span aria-live="polite">{button.label}</span>
    </button>
  );
}
