import type { AgentStatus, SessionRecord, SessionView, WorkboardConfig } from "./types.js";
import {
  ageLabel,
  extractLatestMessageLines,
  inferStatus,
  initializationBlockedMessage,
  isAgentInitializationBlocked,
  summarize
} from "./status.js";
import { SessionStore } from "./store.js";
import { Tmux } from "./tmux.js";
import type { HistoryEntry } from "./history.js";
import { GlobalStateStore } from "./globalState.js";

export class Workboard {
  constructor(
    private readonly cwd: string,
    private readonly config: WorkboardConfig,
    private readonly store: SessionStore,
    private readonly tmux: Tmux,
    private readonly globalState = new GlobalStateStore()
  ) {}

  list(): SessionView[] {
    return this.store.read().map((session) => {
      const exists = this.tmux.hasSession(session.tmuxSession);
      const capture = exists ? this.tmux.capture(session.tmuxSession) : "";
      const initializationBlocked = isAgentInitializationBlocked(capture);
      const status = session.statusOverride ?? inferStatus(capture, exists);
      return {
        ...session,
        exists,
        status,
        summary: initializationBlocked ? initializationBlockedMessage() : capture.trim() ? summarize(capture) : session.title,
        latestMessageLines: initializationBlocked
          ? [initializationBlockedMessage()]
          : capture.trim()
            ? extractLatestMessageLines(capture)
            : [],
        ageLabel: ageLabel(session.updatedAt)
      };
    });
  }

  create(agent: string, task: string): SessionRecord {
    const agentConfig = this.config.agents[agent];
    if (!agentConfig) {
      throw new Error(`Unknown agent "${agent}". Known agents: ${Object.keys(this.config.agents).join(", ")}`);
    }

    const id = makeId(task);
    const tmuxSession = `${this.config.tmuxPrefix}-${id}`;
    const now = new Date().toISOString();
    const record: SessionRecord = {
      id,
      title: task.slice(0, 80) || id,
      agent,
      tmuxSession,
      createdAt: now,
      updatedAt: now
    };

    if (!this.tmux.hasSession(tmuxSession)) {
      this.tmux.newSession(tmuxSession, this.cwd, agentConfig.command);
    }
    this.store.upsert(record);
    const startupCapture = waitForStartupCapture(this.tmux, tmuxSession);
    if (isAgentInitializationBlocked(startupCapture)) {
      this.store.upsert({ ...record, statusOverride: "Needs input" });
      return record;
    }
    this.tmux.sendKeys(tmuxSession, task);
    return record;
  }

  restore(history: HistoryEntry): SessionRecord {
    const agentConfig = this.config.agents[history.agent];
    if (!agentConfig) {
      throw new Error(`Unknown agent "${history.agent}". Known agents: ${Object.keys(this.config.agents).join(", ")}`);
    }

    const mapping = this.globalState.findByHistoryId(history.id);
    const existing = this.store.read().find((session) => session.historyId === history.id);
    const now = new Date().toISOString();
    const record: SessionRecord = existing ?? {
      id: mapping?.sessionId ?? `${history.agent}-${safeId(history.id)}`,
      title: history.title,
      agent: history.agent,
      tmuxSession: mapping?.tmuxSession ?? `${this.config.tmuxPrefix}-${history.agent}-${safeId(history.id)}`,
      createdAt: mapping?.createdAt ?? now,
      updatedAt: now,
      historyId: history.id,
      historyPath: history.sourcePath
    };

    if (!this.tmux.hasSession(record.tmuxSession)) {
      this.tmux.newSession(
        record.tmuxSession,
        history.cwd ?? this.cwd,
        renderResumeCommand(agentConfig.resumeCommand ?? agentConfig.command, history)
      );
    }

    const next = {
      ...record,
      title: history.title,
      updatedAt: now,
      historyId: history.id,
      historyPath: history.sourcePath,
      statusOverride: undefined
    };
    this.store.upsert(next);
    this.globalState.upsertMapping({
      historyId: history.id,
      historyPath: history.sourcePath,
      agent: history.agent,
      sessionId: next.id,
      tmuxSession: next.tmuxSession,
      cwd: history.cwd ?? this.cwd,
      title: history.title,
      createdAt: next.createdAt,
      updatedAt: now
    });
    return next;
  }

  send(id: string, input: string): void {
    const session = this.find(id);
    if (!session) throw new Error(`Unknown session "${id}".`);
    if (!this.tmux.hasSession(session.tmuxSession)) throw new Error(`tmux session "${session.tmuxSession}" is not running.`);
    const capture = this.tmux.capture(session.tmuxSession);
    if (isAgentInitializationBlocked(capture)) {
      this.store.upsert({ ...session, updatedAt: new Date().toISOString(), statusOverride: "Needs input" });
      throw new Error(initializationBlockedMessage());
    }

    this.tmux.sendKeys(session.tmuxSession, input);
    this.store.upsert({ ...session, updatedAt: new Date().toISOString(), statusOverride: undefined });
  }

  setStatus(id: string, status: AgentStatus): void {
    const session = this.find(id);
    if (!session) throw new Error(`Unknown session "${id}".`);
    this.store.upsert({ ...session, statusOverride: status, updatedAt: new Date().toISOString() });
  }

  kill(id: string): void {
    const session = this.find(id);
    if (!session) return;
    this.tmux.kill(session.tmuxSession);
    this.store.upsert({ ...session, updatedAt: new Date().toISOString(), statusOverride: "Completed" });
  }

  attach(id: string): void {
    const session = this.find(id);
    if (!session) throw new Error(`Unknown session "${id}".`);
    this.tmux.attach(session.tmuxSession);
  }

  review(id: string, lines = 30): string {
    const session = this.find(id);
    if (!session) throw new Error(`Unknown session "${id}".`);
    if (!this.tmux.hasSession(session.tmuxSession)) {
      throw new Error(`tmux session "${session.tmuxSession}" is not running.`);
    }
    return this.tmux.capture(session.tmuxSession, lines);
  }

  private find(id: string): SessionRecord | undefined {
    const sessions = this.store.read();
    return sessions.find((session) => session.id === id || session.tmuxSession === id || session.title === id);
  }
}

function renderResumeCommand(template: string, history: HistoryEntry): string {
  return template
    .replaceAll("{sessionId}", shellQuote(history.id))
    .replaceAll("{sourcePath}", shellQuote(history.sourcePath))
    .replaceAll("{cwd}", shellQuote(history.cwd ?? ""))
    .replaceAll("{title}", shellQuote(history.title));
}

function makeId(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base || "session"}-${suffix}`;
}

function safeId(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36) || "history";
}

function shellQuote(input: string): string {
  return `'${input.replaceAll("'", "'\\''")}'`;
}

function waitForStartupCapture(tmux: Tmux, tmuxSession: string): string {
  let capture = "";
  for (let attempt = 0; attempt < 8; attempt++) {
    capture = tmux.capture(tmuxSession, 40);
    if (isAgentInitializationBlocked(capture)) return capture;
    if (capture.trim()) return capture;
    sleep(100);
  }
  return capture;
}

function sleep(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
