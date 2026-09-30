import { request } from "@/api-clients/bridge";
import type { ChatProviderInfo, ChatSend, ChatState } from "@/chat-types";
export const chat = {
  state: (projectId: string) =>
    request<ChatState>(`/projects/${projectId}/chat`),
  providers: (projectId: string, refresh = false) =>
    request<ChatProviderInfo[]>(
      `/projects/${projectId}/chat/providers${refresh ? "?refresh=true" : ""}`,
    ),
  send: (projectId: string, input: ChatSend) =>
    request<{ sessionId: string }>(
      `/projects/${projectId}/chat/send`,
      "POST",
      input,
    ),
  stop: (projectId: string, sessionId: string) =>
    request<{ ok: boolean }>(`/projects/${projectId}/chat/stop`, "POST", {
      sessionId,
    }),
};
