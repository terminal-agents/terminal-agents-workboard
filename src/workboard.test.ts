import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { HistoryEntry } from "./history.js";
import { GlobalStateStore } from "./globalState.js";
import { SessionStore } from "./store.js";
import { Tmux } from "./tmux.js";
import type { WorkboardConfig } from "./types.js";
import { Workboard } from "./workboard.js";
import {
  CLAUDE_IDLE_HI_CAPTURE,
  CLAUDE_IDLE_WORKDAY_CAPTURE,
  CODEX_PROMPT_WITH_PENDING_TEXT_CAPTURE,
  CODEX_UPDATE_PROMPT_CAPTURE
} from "./testFixtures.js";

test("restore creates a tmux session when missing", () => {
  const cwd = mkdtempSync(join(tmpdir(), "workboard-"));
  try {
    const tmux = new FakeTmux();
    const workboard = new Workboard(cwd, config(), new SessionStore(cwd), tmux as unknown as Tmux);

    const restored = workboard.restore(history("abc123"));

    assert.equal(restored.id, "codex-abc123");
    assert.equal(tmux.created.length, 1);
    assert.equal(tmux.created[0]?.name, "awb-codex-abc123");
    assert.equal(tmux.created[0]?.command, "codex resume 'abc123'");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("restore reuses an existing tmux session", () => {
  const cwd = mkdtempSync(join(tmpdir(), "workboard-"));
  try {
    const tmux = new FakeTmux(["awb-codex-abc123"]);
    const workboard = new Workboard(cwd, config(), new SessionStore(cwd), tmux as unknown as Tmux);

    workboard.restore(history("abc123"));

    assert.equal(tmux.created.length, 0);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("restore reuses tmux session from global history mapping", () => {
  const cwd = mkdtempSync(join(tmpdir(), "workboard-"));
  const home = mkdtempSync(join(tmpdir(), "workboard-home-"));
  try {
    const globalState = new GlobalStateStore(home);
    globalState.init();
    globalState.upsertMapping({
      historyId: "abc123",
      historyPath: "/tmp/abc123.jsonl",
      agent: "codex",
      sessionId: "hi-nwk2",
      tmuxSession: "awb-hi-nwk2",
      cwd: "/tmp/project",
      title: "Fix parser",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    });
    const tmux = new FakeTmux(["awb-hi-nwk2"]);
    const workboard = new Workboard(cwd, config(), new SessionStore(cwd), tmux as unknown as Tmux, globalState);

    const restored = workboard.restore(history("abc123"));

    assert.equal(restored.id, "hi-nwk2");
    assert.equal(restored.tmuxSession, "awb-hi-nwk2");
    assert.equal(tmux.created.length, 0);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});

test("review captures the selected tmux session", () => {
  const cwd = mkdtempSync(join(tmpdir(), "workboard-"));
  try {
    const tmux = new FakeTmux(["awb-codex-abc123"]);
    tmux.captures.set("awb-codex-abc123", "pane preview");
    const workboard = new Workboard(cwd, config(), new SessionStore(cwd), tmux as unknown as Tmux);
    const restored = workboard.restore(history("abc123"));

    assert.equal(workboard.review(restored.id), "pane preview");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("list maps real Claude idle tmux pane to needs input with assistant summary", () => {
  const cwd = mkdtempSync(join(tmpdir(), "workboard-"));
  try {
    const tmux = new FakeTmux(["awb-hi-nwk2"]);
    tmux.captures.set("awb-hi-nwk2", CLAUDE_IDLE_HI_CAPTURE);
    const store = new SessionStore(cwd);
    store.write([
      {
        id: "hi-nwk2",
        title: "hi",
        agent: "claude",
        tmuxSession: "awb-hi-nwk2",
        createdAt: "2026-05-12T10:54:41.751Z",
        updatedAt: "2026-05-12T10:58:58.936Z"
      }
    ]);
    const workboard = new Workboard(cwd, config(), store, tmux as unknown as Tmux);

    const [session] = workboard.list();

    assert.equal(session?.status, "Needs input");
    assert.equal(session?.summary, "Hi! What would you like to work on today?");
    assert.equal(session?.exists, true);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("list exposes multi-line latest assistant message for current session pane", () => {
  const cwd = mkdtempSync(join(tmpdir(), "workboard-"));
  try {
    const tmux = new FakeTmux(["awb-hi-nwk2"]);
    tmux.captures.set("awb-hi-nwk2", CLAUDE_IDLE_WORKDAY_CAPTURE);
    const store = new SessionStore(cwd);
    store.write([
      {
        id: "hi-nwk2",
        title: "hi",
        agent: "claude",
        tmuxSession: "awb-hi-nwk2",
        createdAt: "2026-05-12T10:54:41.751Z",
        updatedAt: "2026-05-12T10:58:58.936Z"
      }
    ]);
    const workboard = new Workboard(cwd, config(), store, tmux as unknown as Tmux);

    const [session] = workboard.list();

    assert.equal(session?.status, "Needs input");
    assert.equal(session?.summary, "下个月是 2026 年 6 月。");
    assert.equal(session?.latestMessageLines.includes("工作日数量"), true);
    assert.equal(session?.latestMessageLines.includes("下一次法定节假日"), true);
    assert.equal(session?.latestMessageLines.at(-1), "需要我帮你查一下官方发布的 2026 年放假安排吗？");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("create does not send task when agent startup is blocked by initialization prompt", () => {
  const cwd = mkdtempSync(join(tmpdir(), "workboard-"));
  try {
    const tmux = new FakeTmux();
    tmux.defaultCapture = CODEX_UPDATE_PROMPT_CAPTURE;
    const workboard = new Workboard(cwd, config(), new SessionStore(cwd), tmux as unknown as Tmux);

    const created = workboard.create("codex", "hello");
    const [session] = workboard.list();

    assert.equal(created.title, "hello");
    assert.equal(tmux.sent.length, 0);
    assert.equal(session?.status, "Needs input");
    assert.equal(session?.summary, "Agent initialization needs input. Use /open or Ctrl+O to finish setup in tmux.");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("send refuses to type into an initialization prompt", () => {
  const cwd = mkdtempSync(join(tmpdir(), "workboard-"));
  try {
    const tmux = new FakeTmux(["awb-hello"]);
    tmux.captures.set("awb-hello", CODEX_UPDATE_PROMPT_CAPTURE);
    const store = new SessionStore(cwd);
    store.write([
      {
        id: "hello",
        title: "hello",
        agent: "codex",
        tmuxSession: "awb-hello",
        createdAt: "2026-05-12T10:54:41.751Z",
        updatedAt: "2026-05-12T10:58:58.936Z"
      }
    ]);
    const workboard = new Workboard(cwd, config(), store, tmux as unknown as Tmux);

    assert.throws(() => workboard.send("hello", "continue task"), /Agent initialization needs input/);
    assert.equal(tmux.sent.length, 0);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("list does not mark Codex startup prompt as completed because welcome text says done", () => {
  const cwd = mkdtempSync(join(tmpdir(), "workboard-"));
  try {
    const tmux = new FakeTmux(["awb-say-hi-hi-6rh5"]);
    tmux.captures.set("awb-say-hi-hi-6rh5", CODEX_PROMPT_WITH_PENDING_TEXT_CAPTURE);
    const store = new SessionStore(cwd);
    store.write([
      {
        id: "say-hi-hi-6rh5",
        title: "say-hi hi",
        agent: "codex",
        tmuxSession: "awb-say-hi-hi-6rh5",
        createdAt: "2026-05-12T11:47:05.273Z",
        updatedAt: "2026-05-12T11:47:05.273Z"
      }
    ]);
    const workboard = new Workboard(cwd, config(), store, tmux as unknown as Tmux);

    const [session] = workboard.list();

    assert.equal(session?.status, "Needs input");
    assert.equal(session?.summary, "Codex prompt awaiting input: say-hi hi");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

class FakeTmux {
  readonly sessions = new Set<string>();
  readonly created: Array<{ name: string; cwd: string; command: string }> = [];
  readonly captures = new Map<string, string>();
  readonly sent: Array<{ name: string; input: string }> = [];
  defaultCapture = "";

  constructor(existing: string[] = []) {
    for (const session of existing) this.sessions.add(session);
  }

  hasSession(name: string): boolean {
    return this.sessions.has(name);
  }

  newSession(name: string, cwd: string, command: string): void {
    this.sessions.add(name);
    this.created.push({ name, cwd, command });
  }

  capture(name: string): string {
    return this.captures.get(name) ?? this.defaultCapture;
  }

  sendKeys(name: string, input: string): void {
    this.sent.push({ name, input });
  }
  kill(): void {}
  attach(): void {}
}

function config(): WorkboardConfig {
  return {
    tmuxPrefix: "awb",
    defaultAgent: "codex",
    agents: {
      codex: {
        label: "Codex",
        command: "codex",
        resumeCommand: "codex resume {sessionId}"
      },
      claude: {
        label: "Claude Code",
        command: "claude",
        resumeCommand: "claude --resume {sessionId}"
      }
    }
  };
}

function history(id: string): HistoryEntry {
  return {
    id,
    agent: "codex",
    title: "Fix parser",
    cwd: "/tmp/project",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ageLabel: "1m",
    sourcePath: `/tmp/${id}.jsonl`
  };
}
