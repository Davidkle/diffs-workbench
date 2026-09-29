import { useEffect, useMemo, useState } from "react";
import { Virtualizer } from "@pierre/diffs/react";
import { PreparedDiff } from "@/components/PreparedDiff";
import {
  FileCode2,
  PanelLeft,
  Columns2,
  AlignJustify,
  WrapText,
  ChevronDown,
  ChevronUp,
  Check,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FileContent } from "@/types";
type Props = {
  content: FileContent | null;
  loading: boolean;
  full: boolean;
  setFull: (v: boolean) => void;
  split: boolean;
  setSplit: (v: boolean) => void;
  onResolve: (content: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  hasPrevious: boolean;
  hasNext: boolean;
  fileMode: boolean;
};
export function DiffPane({
  content,
  loading,
  full,
  setFull,
  split,
  setSplit,
  onResolve,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
  fileMode,
}: Props) {
  const [wrap, setWrap] = useState(true);
  const [resolution, setResolution] = useState("");
  useEffect(() => setResolution(content?.current || ""), [content]);
  const options = useMemo(
    () => ({
      theme: "pierre-dark" as const,
      themeType: "dark" as const,
      diffStyle: split ? ("split" as const) : ("unified" as const),
      expandUnchanged: full,
      disableFileHeader: true,
      overflow: wrap ? ("wrap" as const) : ("scroll" as const),
      lineDiffType: "word" as const,
      diffIndicators: "classic" as const,
      hunkSeparators: "line-info" as const,
      unsafeCSS:
        ':host { --diffs-font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace; --diffs-font-size: 14px; --diffs-line-height: 23px; } [data-code] { background: #222225; }',
    }),
    [split, full, wrap],
  );
  return (
    <section className="diff-pane">
      <div className="diff-toolbar">
        <div className="file-name">
          <FileCode2 size={14} />
          <span>{content?.path || "No file selected"}</span>
        </div>
        <div className="diff-controls">
          <Button
            title="Previous file"
            aria-label="Previous file"
            variant="ghost"
            size="icon"
            disabled={!hasPrevious}
            onClick={onPrevious}
          >
            <ChevronUp size={15} />
          </Button>
          <Button
            title="Next file"
            aria-label="Next file"
            variant="ghost"
            size="icon"
            disabled={!hasNext}
            onClick={onNext}
          >
            <ChevronDown size={15} />
          </Button>
          <span className="separator" />
          <Button
            title="Show unchanged lines"
            variant="ghost"
            size="sm"
            className={full ? "active-control" : ""}
            onClick={() => setFull(!full)}
            aria-pressed={full}
          >
            <PanelLeft size={14} />
            <span>Full file</span>
          </Button>
          <Button
            title="Toggle split diff"
            aria-label="Toggle split diff"
            variant="ghost"
            size="icon"
            className={split ? "active-control" : ""}
            onClick={() => setSplit(!split)}
            aria-pressed={split}
          >
            {split ? <Columns2 size={15} /> : <AlignJustify size={15} />}
          </Button>
          <Button
            title="Wrap lines"
            aria-label="Wrap lines"
            variant="ghost"
            size="icon"
            className={wrap ? "active-control" : ""}
            onClick={() => setWrap(!wrap)}
            aria-pressed={wrap}
          >
            <WrapText size={15} />
          </Button>
        </div>
      </div>
      <Virtualizer className="diff-content" config={{ overscrollSize: 500 }}>
        {loading ? (
          <div className="empty">
            <span className="spinner" />
            Loading file…
          </div>
        ) : !content ? (
          <div className="empty">
            <Check size={32} />
            <h3>All clear</h3>
            <p>Select a commit or open a file to explore your code.</p>
          </div>
        ) : content.binary ? (
          <div className="empty">
            <FileCode2 size={32} />
            <h3>Binary file</h3>
            <p>This file cannot be displayed as text.</p>
          </div>
        ) : content.conflict ? (
          <>
            <div className="conflict-banner">
              <AlertTriangle size={16} />
              <div>
                <strong>Merge conflict</strong>
                <p>
                  Compare both versions, then edit and save the resolved file.
                </p>
              </div>
            </div>
            <div className="conflict-actions">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setResolution(content.ours || "")}
              >
                Use entire current version
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setResolution(content.theirs || "")}
              >
                Use entire incoming version
              </Button>
            </div>
            <PreparedDiff
              content={content}
              options={{
                ...options,
                diffStyle: "split",
                expandUnchanged: true,
              }}
            />
            <div className="resolution">
              <label htmlFor="resolution">Resolved file</label>
              <textarea
                id="resolution"
                spellCheck={false}
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
              />
              <Button onClick={() => onResolve(resolution)}>
                <Check size={14} />
                Save resolution & stage
              </Button>
            </div>
          </>
        ) : (
          <PreparedDiff
            content={content}
            options={options}
            fileMode={fileMode}
          />
        )}
      </Virtualizer>
    </section>
  );
}
