import type { ReactNode } from "react";
import { WorkerPoolContextProvider } from "@pierre/diffs/react";
import HighlightWorker from "@pierre/diffs/worker/worker.js?worker&inline";
const poolOptions = {
  workerFactory: () => new HighlightWorker(),
  poolSize: 2,
  totalASTLRUCacheSize: 8,
};
const highlighterOptions = {
  theme: "pierre-dark",
  preferredHighlighter: "shiki-js" as const,
};
export function DiffWorkers({ children }: { children: ReactNode }) {
  return (
    <WorkerPoolContextProvider
      poolOptions={poolOptions}
      highlighterOptions={highlighterOptions}
    >
      {children}
    </WorkerPoolContextProvider>
  );
}
