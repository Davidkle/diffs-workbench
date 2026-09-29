import { useCallback, useSyncExternalStore } from "react";
import { BooleanPreferences, preferenceKey } from "@/preferences";
const storage = (() => {
  try {
    return localStorage;
  } catch {
    return undefined;
  }
})();
const preferences = new BooleanPreferences(storage);
export function usePersistentBoolean(
  project: string,
  area: string,
  path: string,
  fallback = true,
) {
  const key = preferenceKey(project, area, path);
  const subscribe = useCallback(
    (notify: () => void) => preferences.subscribe(key, notify),
    [key],
  );
  const snapshot = useCallback(
    () => preferences.get(key, fallback),
    [key, fallback],
  );
  const value = useSyncExternalStore(subscribe, snapshot);
  const setValue = useCallback(
    (next: boolean) => preferences.set(key, next),
    [key],
  );
  return [value, setValue] as const;
}
