type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;
export const preferenceKey = (project: string, area: string, path: string) =>
  `diffs-state:${JSON.stringify([project, area, path])}`;

export class BooleanPreferences {
  private memory = new Map<string, boolean>();
  private listeners = new Map<string, Set<() => void>>();
  constructor(private storage?: Storage) {}
  get(key: string, fallback: boolean): boolean {
    if (this.memory.has(key)) return this.memory.get(key)!;
    try {
      const value = this.storage?.getItem(key);
      if (value === "true" || value === "false") return value === "true";
    } catch {
      /* Preferences still work for this session if storage is unavailable. */
    }
    return fallback;
  }
  set(key: string, value: boolean) {
    this.memory.set(key, value);
    try {
      this.storage?.setItem(key, String(value));
    } catch {
      /* Use session memory. */
    }
    this.listeners.get(key)?.forEach((notify) => notify());
  }
  subscribe(key: string, notify: () => void) {
    const listeners = this.listeners.get(key) || new Set<() => void>();
    listeners.add(notify);
    this.listeners.set(key, listeners);
    return () => {
      listeners.delete(notify);
      if (!listeners.size) this.listeners.delete(key);
    };
  }
}
