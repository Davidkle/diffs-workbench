export type ChatProvider = "codex" | "claude";
export type ChatModel = { id: string; name: string; efforts: string[] };
export type ChatProviderInfo = {
  id: ChatProvider;
  name: string;
  available: boolean;
  error?: string;
  models: ChatModel[];
};
export type ChatSkill = {
  id: string;
  name: string;
  description: string;
  path: string;
};
export type ChatEntry = {
  id: string;
  kind: "user" | "assistant" | "activity";
  text: string;
  detail?: string;
  status?: "running" | "done" | "error";
};
export type ChatSession = {
  id: string;
  projectId: string;
  provider: ChatProvider;
  title: string;
  model: string;
  effort: string;
  status: "idle" | "running" | "error" | "stopped";
  activity: string;
  entries: ChatEntry[];
  startedAt?: number;
  updatedAt: number;
  error?: string;
};
export type ChatState = { sessions: ChatSession[]; skills: ChatSkill[] };
export type ChatSend = {
  sessionId?: string;
  provider: ChatProvider;
  model: string;
  effort: string;
  text: string;
  skillId?: string;
};
