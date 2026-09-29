export {};
declare global {
  interface Window {
    diffsDesktop?: {
      request: <T>(
        route: string,
        method: string,
        body?: unknown,
      ) => Promise<{ ok: true; data: T } | { ok: false; error: string }>;
      chooseProject: () => Promise<string | null>;
      onOpenProject: (callback: () => void) => () => void;
    };
  }
}
