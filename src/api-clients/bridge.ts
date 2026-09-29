import type {
  Action,
  ChangedFile,
  FileContent,
  Project,
  Snapshot,
} from "@/types";
const base = "http://127.0.0.1:43127";
export function getToken() {
  return window.diffsDesktop
    ? "desktop"
    : sessionStorage.getItem("diffs-token") || "";
}
export function setToken(token: string) {
  sessionStorage.setItem("diffs-token", token);
}
export function capturePairingToken() {
  const hash = new URLSearchParams(location.hash.slice(1));
  if (hash.get("token")) {
    setToken(hash.get("token")!);
    history.replaceState(null, "", location.pathname);
  }
}
capturePairingToken();
async function request<T>(
  route: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  if (window.diffsDesktop) {
    const result = await window.diffsDesktop.request<T>(route, method, body);
    if (!result.ok) throw new Error(result.error);
    return result.data;
  }
  let response: Response;
  try {
    response = await fetch(base + route, {
      method,
      headers: {
        Authorization: `Bearer ${getToken()}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(70000),
    });
  } catch {
    throw new Error(
      "Local bridge is offline. Start it on this computer, then reconnect.",
    );
  }
  const json = await response.json();
  if (!response.ok) throw new Error(json.error || "The request failed");
  return json as T;
}
export const bridge = {
  projects: () => request<Project[]>("/projects"),
  add: (path: string) => request<Project>("/projects", "POST", { path }),
  remove: (id: string) => request<{ ok: boolean }>(`/projects/${id}`, "DELETE"),
  snapshot: (id: string) => request<Snapshot>(`/projects/${id}`),
  files: (id: string, commit?: string, base?: string) =>
    request<ChangedFile[]>(
      `/projects/${id}/files${commit ? `?commit=${commit}${base ? `&base=${base}` : ""}` : ""}`,
    ),
  tree: (id: string, commit?: string) =>
    request<string[]>(
      `/projects/${id}/tree${commit ? `?commit=${commit}` : ""}`,
    ),
  file: (
    id: string,
    path: string,
    commit?: string,
    base?: string,
    layer?: "staged" | "unstaged",
  ) =>
    request<FileContent>(
      `/projects/${id}/file?path=${encodeURIComponent(path)}${commit ? `&commit=${commit}` : ""}${base ? `&base=${base}` : ""}${layer ? `&layer=${layer}` : ""}`,
    ),
  action: (id: string, action: Action, input: Record<string, string> = {}) =>
    request<{ message: string }>(`/projects/${id}/action`, "POST", {
      action,
      ...input,
    }),
};
