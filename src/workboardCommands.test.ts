import assert from "node:assert/strict";
import test from "node:test";
import type { AgentStatus, SessionView } from "./types.js";
import type { HistoryEntry } from "./history.js";
import { parseNewCommand, runWorkboardCommand, type CommandWorkboard } from "./workboardCommands.js";

test("/new uses the current agent when the first token is not a known agent", () => {
  assert.deepEqual(parseNewCommand(["fix", "tests"], "codex", ["codex", "claude"]), {
    agent: "codex",
    task: "fix tests"
  });
});

test("/new accepts an explicit known agent", () => {
  assert.deepEqual(parseNewCommand(["claude", "fix", "tests"], "codex", ["codex", "claude"]), {
    agent: "claude",
    task: "fix tests"
  });
});

test("/new creates a session with default agent and task text", () => {
  const calls: Array<{ agent: string; task: string }> = [];
  const context = makeContext({
    workboard: {
      ...fakeWorkboard(),
      create(agent, task) {
        calls.push({ agent, task });
        return { id: "created-1" };
      }
    }
  });

  runWorkboardCommand("/new implement slash menu", context);

  assert.deepEqual(calls, [{ agent: "codex", task: "implement slash menu" }]);
  assert.equal(context.messages.at(-1), "created created-1");
});

test("/new creates a session with explicit agent", () => {
  const calls: Array<{ agent: string; task: string }> = [];
  const context = makeContext({
    workboard: {
      ...fakeWorkboard(),
      create(agent, task) {
        calls.push({ agent, task });
        return { id: "created-2" };
      }
    }
  });

  runWorkboardCommand("/new claude inspect failing tests", context);

  assert.deepEqual(calls, [{ agent: "claude", task: "inspect failing tests" }]);
});

test("/new without task is rejected", () => {
  assert.throws(
    () => runWorkboardCommand("/new", makeContext()),
    /Usage: \/new \[agent\] <task>/
  );
});

test("/new without agent or task is still rejected", () => {
  assert.throws(
    () => runWorkboardCommand("/new", makeContext()),
    /Usage: \/new \[agent\] <task>/
  );
});

test("/new with only an explicit agent is rejected", () => {
  assert.throws(
    () => runWorkboardCommand("/new claude", makeContext()),
    /Usage: \/new \[agent\] <task>/
  );
});

test("/agent is no longer a supported command", () => {
  assert.throws(
    () => runWorkboardCommand("/agent claude", makeContext()),
    /Unknown command "\/agent"/
  );
});

test("/resume restores a unique history id prefix", () => {
  const calls: HistoryEntry[] = [];
  const context = makeContext({
    history: [history("abc12345", "codex", "fix parser")],
    workboard: {
      ...fakeWorkboard(),
      restore(entry) {
        calls.push(entry);
        return { id: `restored-${entry.id}` };
      }
    }
  });

  runWorkboardCommand("/resume abc12345", context);

  assert.equal(calls[0]?.id, "abc12345");
  assert.equal(context.messages.at(-1), "restored restored-abc12345");
});

test("/review captures selected tmux session preview", () => {
  const context = makeContext({
    workboard: {
      ...fakeWorkboard(),
      review(id, lines) {
        return `${id}:${lines}`;
      }
    }
  });

  runWorkboardCommand("/review", context);

  assert.deepEqual(context.reviews.at(-1), { title: "one", content: "one:30" });
  assert.equal(context.messages.at(-1), "reviewing one");
});

function makeContext(overrides: Partial<Parameters<typeof runWorkboardCommand>[1]> = {}) {
  const messages: string[] = [];
  const reviews: Array<{ title: string; content: string }> = [];
  const sessions = [session("one"), session("two")];
  const context = {
    sessions,
    history: [],
    selected: 0,
    currentAgent: "codex",
    agents: ["codex", "claude", "opencode", "gemini"],
    workboard: fakeWorkboard(),
    agentIndex: 0,
    selectedIndex: 0,
    exited: false,
    messages,
    reviews,
    setSelected(index: number) {
      context.selectedIndex = index;
    },
    setAgentIndex(index: number) {
      context.agentIndex = index;
    },
    setMessage(message: string) {
      messages.push(message);
    },
    setReview(title: string, content: string) {
      reviews.push({ title, content });
    },
    exit() {
      context.exited = true;
    },
    ...overrides
  };
  return context;
}

function fakeWorkboard(): CommandWorkboard {
  return {
    create(agent: string, task: string) {
      return { id: `${agent}-${task}` };
    },
    restore(entry: HistoryEntry) {
      return { id: entry.id };
    },
    send() {},
    setStatus(_id: string, _status: AgentStatus) {},
    review() {
      return "";
    },
    attach() {},
    kill() {}
  };
}

function history(id: string, agent: string, title: string): HistoryEntry {
  return {
    id,
    agent,
    title,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ageLabel: "1m",
    sourcePath: `/tmp/${id}.jsonl`
  };
}

function session(id: string): SessionView {
  return {
    id,
    title: id,
    agent: "codex",
    tmuxSession: `awb-${id}`,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    status: "Working",
    summary: id,
    latestMessageLines: [id],
    ageLabel: "1m",
    exists: true
  };
}
