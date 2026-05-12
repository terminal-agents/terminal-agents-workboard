import assert from "node:assert/strict";
import test from "node:test";
import type { AgentStatus, SessionView } from "./types.js";
import { buildRows, buildVisibleSessions } from "./ui.js";

test("visible session order matches rendered grouped row order", () => {
  const sessions = [
    session("create-1i71", "Completed"),
    session("hi-nwk2", "Needs input"),
    session("claude-2e806b61", "Completed"),
    session("hello-5890", "Needs input")
  ];

  const visibleIds = buildVisibleSessions(sessions).map((item) => item.id);
  const rowIds = buildRows(sessions)
    .filter((row) => row.kind === "session")
    .map((row) => row.session.id);

  assert.deepEqual(visibleIds, ["hi-nwk2", "hello-5890", "create-1i71", "claude-2e806b61"]);
  assert.deepEqual(rowIds, visibleIds);
});

function session(id: string, status: AgentStatus): SessionView {
  return {
    id,
    title: id,
    agent: "codex",
    tmuxSession: `awb-${id}`,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    status,
    summary: id,
    latestMessageLines: [id],
    ageLabel: "1m",
    exists: true
  };
}
