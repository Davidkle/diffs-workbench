import {
  memo,
  useEffect,
  useState,
  useRef,
  useImperativeHandle,
  type Ref,
  type ComponentProps,
} from "react";
import { FileDiff, File, useVirtualizer } from "@pierre/diffs/react";
import { VirtualizedFileDiff, type FileDiffMetadata } from "@pierre/diffs";
import { changeTargets } from "@/change-navigation";
import DiffWorker from "@/workers/diff.worker?worker&inline";
import type { FileContent } from "@/types";

type Props = {
  ref?: Ref<ChangeNavigation>;
  onChangesReady?: (count: number) => void;
  content: FileContent;
  options: ComponentProps<typeof FileDiff>["options"];
  fileMode?: boolean;
};
export type ChangeNavigation = { jump: (direction: -1 | 1) => void };
type PreparedResult = {
  source: FileContent;
  diff?: FileDiffMetadata;
  error?: string;
};
// Entries disappear when the bounded file-content cache releases their source.
const prepared = new WeakMap<FileContent, PreparedResult>();
/** Parsing runs in a disposable worker so switching away cancels expensive work. */
export const PreparedDiff = memo(function PreparedDiff({
  content,
  options,
  fileMode,
  ref,
  onChangesReady,
}: Props) {
  const virtualizer = useVirtualizer();
  const instance = useRef<VirtualizedFileDiff | null>(null);
  const cursor = useRef<{
    source: FileContent;
    index: number;
    scrollTop: number;
  } | null>(null);
  const [lastResult, setResult] = useState<PreparedResult>();
  const result = prepared.get(content) ?? lastResult;
  useEffect(() => {
    if (!fileMode && result?.source !== content) return;
    onChangesReady?.(
      !fileMode && result?.source === content && result.diff
        ? changeTargets(result.diff).length
        : 0,
    );
  }, [content, fileMode, result, onChangesReady]);
  useImperativeHandle(
    ref,
    () => ({
      jump(direction) {
        if (
          fileMode ||
          result?.source !== content ||
          !result.diff ||
          !instance.current ||
          !virtualizer
        )
          return;
        const view = instance.current;
        const targets = changeTargets(result.diff);
        if (!targets.length) return;
        const positions = targets.map(
          (target) =>
            (view.top ?? 0) +
            (view.getLinePosition(target.line, target.side)?.top ?? 0),
        );
        const scrollTop = virtualizer.getScrollTop();
        const previous = cursor.current;
        let index: number;
        if (
          previous?.source === content &&
          Math.abs(previous.scrollTop - scrollTop) < 3
        ) {
          index =
            (previous.index + direction + targets.length) % targets.length;
        } else if (direction === 1) {
          index = positions.findIndex((top) => top > scrollTop + 2);
          if (index < 0) index = 0;
        } else {
          index = -1;
          positions.forEach((top, candidate) => {
            if (top < scrollTop - 2) index = candidate;
          });
          if (index < 0) index = targets.length - 1;
        }
        virtualizer.scrollTo({
          top: Math.max(0, positions[index] - 8),
          behavior: "instant",
        });
        cursor.current = {
          source: content,
          index,
          scrollTop: virtualizer.getScrollTop(),
        };
      },
    }),
    [content, result, fileMode, virtualizer],
  );
  useEffect(() => {
    if (fileMode) return;
    const cached = prepared.get(content);
    if (cached) {
      setResult(cached);
      return;
    }
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
      const next = { source: content, diff: data.fileDiff, error: data.error };
      if (data.fileDiff) prepared.set(content, next);
      setResult(next);
      worker.terminate();
    };
    worker.onerror = () => {
      if (stopped) return;
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
  if (!result)
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
    <>
      {result.source !== content && (
        <span className="diff-loading-indicator" role="status">
          Preparing diff…
        </span>
      )}
      <FileDiff
        fileDiff={result.diff}
        options={{
          ...options,
          onPostRender: (_node, rendered) => {
            if (rendered instanceof VirtualizedFileDiff)
              instance.current = rendered;
          },
        }}
      />
    </>
  ) : null;
});
