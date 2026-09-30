import type { FileDiffMetadata, SelectionSide } from "@pierre/diffs";

export function changeTargets(diff: FileDiffMetadata) {
  return diff.hunks.flatMap((hunk) =>
    hunk.hunkContent.flatMap((block) => {
      if (block.type !== "change") return [];
      const side: SelectionSide = block.deletions ? "deletions" : "additions";
      const line =
        side === "deletions"
          ? hunk.deletionStart +
            block.deletionLineIndex -
            hunk.deletionLineIndex
          : hunk.additionStart +
            block.additionLineIndex -
            hunk.additionLineIndex;
      return [{ line, side }];
    }),
  );
}
