import { useState } from "react";
import type { FileContent } from "@/types";

type Props = {
  content: FileContent;
  fileMode: boolean;
};

function MediaSide({
  source,
  type,
  label,
  path,
}: {
  source: string;
  type: string;
  label: string;
  path: string;
}) {
  const [failed, setFailed] = useState<string>();
  const description = `${label}: ${path}`;
  const onError = () => setFailed(source);
  return (
    <figure>
      <figcaption>{label}</figcaption>
      <div className="media-preview-surface">
        {!source ? (
          <p>No media in this version.</p>
        ) : failed === source ? (
          <p>Unable to preview this media. The format may be unsupported.</p>
        ) : type.startsWith("image/") ? (
          <img src={source} alt={description} onError={onError} />
        ) : type.startsWith("video/") ? (
          <video
            key={source}
            src={source}
            aria-label={description}
            controls
            playsInline
            preload="metadata"
            onError={onError}
          />
        ) : (
          <audio
            key={source}
            src={source}
            aria-label={description}
            controls
            preload="metadata"
            onError={onError}
          />
        )}
      </div>
    </figure>
  );
}

export function MediaPreview({ content, fileMode }: Props) {
  const showBefore = !fileMode && !!content.old;
  const showAfter = fileMode || !!content.current || !showBefore;
  return (
    <section className="media-preview" aria-label="Media preview">
      {showBefore && (
        <MediaSide
          source={content.old}
          type={content.mediaType!}
          label="Before"
          path={content.path}
        />
      )}
      {showAfter && (
        <MediaSide
          source={content.current}
          type={content.mediaType!}
          label={fileMode ? "Preview" : "After"}
          path={content.path}
        />
      )}
    </section>
  );
}
