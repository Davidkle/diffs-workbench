import { parseDiffFromFile } from "@pierre/diffs";
type Input = { name: string; old: string; current: string; key: string };
self.onmessage = ({ data }: MessageEvent<Input>) => {
  try {
    const fileDiff = parseDiffFromFile(
      { name: data.name, contents: data.old, cacheKey: `${data.key}:old` },
      { name: data.name, contents: data.current, cacheKey: `${data.key}:new` },
    );
    self.postMessage({ fileDiff });
  } catch (error) {
    self.postMessage({
      error:
        error instanceof Error ? error.message : "Could not prepare this diff",
    });
  }
};
