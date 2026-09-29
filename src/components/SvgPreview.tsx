import { useMemo, useState } from "react";
import type { FileContent } from "@/types";

function SvgImage({ source, label }: { source: string; label: string }) {
  const url = useMemo(
    () => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`,
    [source],
  );
  const [failed, setFailed] = useState<string>();
  return (
    <figure>
      <figcaption>{label}</figcaption>
      <div className="svg-image">
        {!source.trim() ? (
          <span>No image</span>
        ) : failed === url ? (
          <span>Unable to preview this SVG</span>
        ) : (
          <img src={url} alt={`${label} SVG`} onError={() => setFailed(url)} />
        )}
      </div>
    </figure>
  );
}

export function SvgPreview({
  content,
  fileMode,
}: {
  content: FileContent;
  fileMode: boolean;
}) {
  return (
    <section className="svg-preview" aria-label="SVG preview">
      {!fileMode && <SvgImage source={content.old} label="Before" />}
      <SvgImage
        source={content.current}
        label={fileMode ? "Preview" : "After"}
      />
    </section>
  );
}
