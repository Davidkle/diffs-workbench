import { memo, useEffect, useState, type ComponentProps } from "react";
import { FileDiff, File } from "@pierre/diffs/react";
import type { FileDiffMetadata } from "@pierre/diffs";
import DiffWorker from "@/workers/diff.worker?worker&inline";
import type { FileContent } from "@/types";

type Props = {
  content: FileContent;
  options: ComponentProps<typeof FileDiff>["options"];
  fileMode?: boolean;
};
/** Parsing runs in a disposable worker so switching away cancels expensive work. */
export const PreparedDiff = memo(function PreparedDiff({
  content,
  options,
  fileMode,
}: Props) {
  const [result, setResult] = useState<{
    source: FileContent;
    diff?: FileDiffMetadata;
    error?: string;
  }>();
  useEffect(() => {
    if (fileMode) return;
    const worker = new DiffWorker();
    let stopped = false;
    const timeout = setTimeout(() => {
      stopped = true;
      worker.terminate();
      setResult({
        source: content,
        error:
          "This comparison is taking too long. You can select another file.",
      });
    }, 20000);
    worker.onmessage = ({
      data,
    }: MessageEvent<{ fileDiff?: FileDiffMetadata; error?: string }>) => {
      if (stopped) return;
      clearTimeout(timeout);
      setResult({ source: content, diff: data.fileDiff, error: data.error });
      worker.terminate();
    };
    worker.onerror = () => {
      clearTimeout(timeout);
      setResult({
        source: content,
        error: "Could not prepare this diff. Try selecting the file again.",
      });
      worker.terminate();
    };
    worker.postMessage({
      name: content.path,
      old: content.conflict ? content.ours || "" : content.old,
      current: content.conflict ? content.theirs || "" : content.current,
      key: crypto.randomUUID(),
    });
    return () => {
      stopped = true;
      clearTimeout(timeout);
      worker.terminate();
    };
  }, [content, fileMode]);
  if (fileMode)
    return (
      <File
        file={{ name: content.path, contents: content.current }}
        options={{
          theme: options?.theme,
          themeType: options?.themeType,
          overflow: options?.overflow,
          disableFileHeader: true,
          unsafeCSS: options?.unsafeCSS,
        }}
      />
    );
  if (result?.source !== content)
    return (
      <div className="empty" role="status">
        <span className="spinner" />
        Preparing diff…
      </div>
    );
  if (result.error)
    return (
      <div className="empty" role="alert">
        {result.error}
      </div>
    );
  return result.diff ? (
    <FileDiff fileDiff={result.diff} options={options} />
  ) : null;
});
