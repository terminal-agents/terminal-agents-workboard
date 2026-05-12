export type AgentStatus =
  | "Needs input"
  | "Rate limited"
  | "Working"
  | "Completed"
  | "Return pending"
  | "WIP"
  | "human handoff"
  | "session switching"
  | "agent routing";

export type AgentConfig = {
  label: string;
  command: string;
  resumeCommand?: string;
};

export type WorkboardConfig = {
  tmuxPrefix: string;
  defaultAgent: string;
  agents: Record<string, AgentConfig>;
};

export type SessionRecord = {
  id: string;
  title: string;
  agent: string;
  tmuxSession: string;
  createdAt: string;
  updatedAt: string;
  historyId?: string;
  historyPath?: string;
  statusOverride?: AgentStatus;
};

export type SessionView = SessionRecord & {
  status: AgentStatus;
  summary: string;
  latestMessageLines: string[];
  ageLabel: string;
  exists: boolean;
};
