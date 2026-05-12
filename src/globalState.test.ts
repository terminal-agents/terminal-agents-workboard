import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { GlobalStateStore } from "./globalState.js";

test("global state initializes ~/.workboard-compatible directory and state file", () => {
  const dir = mkdtempSync(join(tmpdir(), "workboard-home-"));
  try {
    const home = join(dir, ".workboard");
    const store = new GlobalStateStore(home);

    store.init();

    assert.equal(existsSync(home), true);
    assert.equal(existsSync(join(home, "state.json")), true);
    assert.deepEqual(store.readMappings(), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("global state upserts history to tmux mappings by history id", () => {
  const dir = mkdtempSync(join(tmpdir(), "workboard-home-"));
  try {
    const store = new GlobalStateStore(join(dir, ".workboard"));
    store.init();

    store.upsertMapping({
      historyId: "history-1",
      historyPath: "/tmp/history-1.jsonl",
      agent: "claude",
      sessionId: "hi-nwk2",
      tmuxSession: "awb-hi-nwk2",
      cwd: "/tmp/project",
      title: "hihi",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    });
    store.upsertMapping({
      historyId: "history-1",
      historyPath: "/tmp/history-1.jsonl",
      agent: "claude",
      sessionId: "hi-nwk2",
      tmuxSession: "awb-hi-nwk2",
      cwd: "/tmp/project",
      title: "hihi updated",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:01:00.000Z"
    });

    assert.equal(store.readMappings().length, 1);
    assert.equal(store.findByHistoryId("history-1")?.title, "hihi updated");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
