import { useState } from "react";
import { Button } from "@/components/ui/button";
type Props = {
  count: number;
  busy: boolean;
  onCommit: (message: string) => Promise<void>;
};
export function CommitForm({ count, busy, onCommit }: Props) {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  return (
    <form
      className="commit-form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy || !count || !subject.trim()) return;
        try {
          await onCommit(
            `${subject.trim()}${description.trim() ? `\n\n${description.trim()}` : ""}`,
          );
          setSubject("");
          setDescription("");
        } catch {
          /* The action reports errors; keep the draft for retry. */
        }
      }}
    >
      <input
        aria-label="Commit subject"
        placeholder="Commit subject"
        value={subject}
        onChange={(event) => setSubject(event.target.value)}
        disabled={busy}
      />
      <textarea
        aria-label="Commit description"
        placeholder="Description (optional)"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
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
        >
          Commit
        </Button>
      </div>
    </form>
  );
}
