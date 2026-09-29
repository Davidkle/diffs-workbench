export {};
declare global {
  interface Window {
    diffsDesktop?: {
      request: <T>(route: string, method: string, body?: unknown) => Promise<T>;
      chooseProject: () => Promise<string | null>;
    };
  }
}
