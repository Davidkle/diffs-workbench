import { useState } from "react";
import { Button } from "@/components/ui/button";
type Props = {
  count: number;
  projectId: string;
  loading: boolean;
  busy: boolean;
  onCommit: (message: string) => Promise<void>;
};
export function CommitForm({
  count,
  busy,
  loading,
  projectId,
  onCommit,
}: Props) {
  const [drafts, setDrafts] = useState<
    Record<string, { subject: string; description: string }>
  >({});
  const { subject = "", description = "" } = drafts[projectId] || {};
  const updateDraft = (
    patch: Partial<{ subject: string; description: string }>,
  ) =>
    setDrafts((previous) => ({
      ...previous,
      [projectId]: {
        ...(previous[projectId] || { subject: "", description: "" }),
        ...patch,
      },
    }));
  if (!count) return null;
  return (
    <form
      className="commit-form"
      aria-busy={loading}
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy || loading || !count || !subject.trim()) return;
        try {
          await onCommit(
            `${subject.trim()}${description.trim() ? `\n\n${description.trim()}` : ""}`,
          );
          updateDraft({ subject: "", description: "" });
        } catch {
          /* The action reports errors; keep the draft for retry. */
        }
      }}
    >
      <input
        aria-label="Commit subject"
        placeholder="Commit subject"
        value={subject}
        onChange={(event) => updateDraft({ subject: event.target.value })}
        disabled={busy}
      />
      <textarea
        aria-label="Commit description"
        placeholder="Description (optional)"
        value={description}
        onChange={(event) => updateDraft({ description: event.target.value })}
        rows={2}
        disabled={busy}
      />
      <div>
        <span>
          {count} staged {count === 1 ? "file" : "files"}
        </span>
        <Button
          type="submit"
          size="sm"
          disabled={busy || !count || !subject.trim()}
          aria-disabled={loading || busy || !count || !subject.trim()}
        >
          Commit
        </Button>
      </div>
    </form>
  );
}
