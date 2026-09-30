import { useEffect, useMemo, useState, useRef } from "react";
import { Virtualizer } from "@pierre/diffs/react";
import { PreparedDiff, type ChangeNavigation } from "@/components/PreparedDiff";
import { DIFF_THEME } from "@/diff-theme";
import {
  FileCode2,
  Columns2,
  WrapText,
  ChevronDown,
  ChevronUp,
  Check,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SvgPreview } from "@/components/SvgPreview";
import { usePersistentBoolean } from "@/use-persistent-boolean";
import { Image, ImageOff } from "lucide-react";
import type { FileContent } from "@/types";
type Props = {
  content: FileContent | null;
  loading: boolean;
  full: boolean;
  setFull: (v: boolean) => void;
  split: boolean;
  setSplit: (v: boolean) => void;
  onResolve: (content: string) => void;
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
  fileMode,
}: Props) {
  const [wrap, setWrap] = useState(true);
  const [resolution, setResolution] = useState("");
  const navigation = useRef<ChangeNavigation>(null);
  const [changeCount, setChangeCount] = useState(0);
  const [showSvg, setShowSvg] = usePersistentBoolean(
    "global",
    "viewer",
    "svg-preview",
    true,
  );
  const isSvg =
    !!content?.path.toLowerCase().endsWith(".svg") &&
    !content.binary &&
    !content.conflict;
  useEffect(() => setResolution(content?.current || ""), [content]);
  const options = useMemo(
    () => ({
      theme: DIFF_THEME,
      themeType: "dark" as const,
      diffStyle: split ? ("split" as const) : ("unified" as const),
      expandUnchanged: full,
      disableFileHeader: true,
      overflow: wrap ? ("wrap" as const) : ("scroll" as const),
      lineDiffType: "word" as const,
      diffIndicators: "classic" as const,
      hunkSeparators: "line-info" as const,
      unsafeCSS:
        ':host { --diffs-bg: var(--editor-background); --diffs-font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace; --diffs-font-size: 12px; --diffs-line-height: 19px; } [data-line-type="change-addition"], [data-line-type="change-deletion"] { --mix-dark: 0%; --mix-light: 0%; }',
    }),
    [split, full, wrap],
  );
  return (
    <section className="diff-pane" aria-busy={loading}>
      <div className="diff-toolbar">
        <div className="file-name">
          <FileCode2 size={14} />
          <span>{content?.path || "No file selected"}</span>
        </div>
        <div className="diff-controls">
          {isSvg && (
            <Button
              title="SVG previews (all projects)"
              aria-label="Show SVG previews"
              variant="ghost"
              size="icon"
              className={showSvg ? "active-control" : ""}
              aria-pressed={showSvg}
              onClick={() => setShowSvg(!showSvg)}
            >
              {showSvg ? <Image size={15} /> : <ImageOff size={15} />}
            </Button>
          )}
          <Button
            title="Previous change"
            aria-label="Previous change"
            variant="ghost"
            size="icon"
            disabled={fileMode || !content || content.binary || !changeCount}
            onClick={() => navigation.current?.jump(-1)}
          >
            <ChevronUp size={15} />
          </Button>
          <Button
            title="Next change"
            aria-label="Next change"
            variant="ghost"
            size="icon"
            disabled={fileMode || !content || content.binary || !changeCount}
            onClick={() => navigation.current?.jump(1)}
          >
            <ChevronDown size={15} />
          </Button>
          <span className="separator" />
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
          <Button
            title="Full file"
            aria-label="Full file"
            variant="ghost"
            size="icon"
            className={full ? "active-control" : ""}
            onClick={() => setFull(!full)}
            aria-pressed={full}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 3v18m-3-15 3-3 3 3M2 18l3 3 3-3M13 4h8M13 9h8M13 15h8M13 20h8" />
            </svg>
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
            <Columns2 size={15} />
          </Button>
        </div>
      </div>
      {loading && content && (
        <span className="diff-loading-indicator" role="status">
          Loading file…
        </span>
      )}
      <Virtualizer className="diff-content" config={{ overscrollSize: 500 }}>
        {isSvg && showSvg && content && (
          <SvgPreview content={content} fileMode={fileMode} />
        )}
        {loading && !content ? (
          <div className="empty">
            <span className="spinner" />
            Loading file…
          </div>
        ) : !content ? (
          <div className="empty">
            <p>Select a file to view changes.</p>
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
              ref={navigation}
              onChangesReady={setChangeCount}
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
            ref={navigation}
            onChangesReady={setChangeCount}
            content={content}
            options={options}
            fileMode={fileMode}
          />
        )}
        {content && !content.binary && (
          <div className="diff-scroll-space" aria-hidden="true" />
        )}
      </Virtualizer>
    </section>
  );
}
