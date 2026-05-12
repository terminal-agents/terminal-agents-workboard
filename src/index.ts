#!/usr/bin/env node
import { loadConfig } from "./config.js";
import { SessionStore } from "./store.js";
import { Tmux } from "./tmux.js";
import { Workboard } from "./workboard.js";
import { GlobalStateStore } from "./globalState.js";
import React from "react";
import { render } from "ink";
import { WorkboardApp } from "./ui.js";

const cwd = process.cwd();
const config = loadConfig(cwd);
const store = new SessionStore(cwd);
const globalState = new GlobalStateStore();
const tmux = new Tmux();
const workboard = new Workboard(cwd, config, store, tmux, globalState);

async function main(): Promise<void> {
  globalState.init();

  if (!tmux.available()) {
    throw new Error("tmux is required but was not found on PATH.");
  }

  const [command, ...args] = process.argv.slice(2);
  if (command === "new") {
    const [agent, ...taskParts] = args;
    const task = taskParts.join(" ");
    if (!task) throw new Error("Usage: workboard new <agent> <task>");
    const session = workboard.create(agent, task);
    console.log(`created ${session.id} (${session.tmuxSession})`);
    return;
  }

  if (command === "send") {
    const [id, ...inputParts] = args;
    if (!id || inputParts.length === 0) throw new Error("Usage: workboard send <session> <input>");
    workboard.send(id, inputParts.join(" "));
    console.log(`sent to ${id}`);
    return;
  }

  if (command === "list") {
    for (const session of workboard.list()) {
      console.log(`${session.status.padEnd(17)} ${session.id.padEnd(32)} ${session.agent.padEnd(10)} ${session.summary}`);
    }
    return;
  }

  if (command === "open") {
    const [id] = args;
    if (!id) throw new Error("Usage: workboard open <session>");
    workboard.attach(id);
  }

  if (command === "--demo") {
    seedDemo(store, config.tmuxPrefix);
  }

  if (!process.stdin.isTTY) {
    throw new Error("workboard requires an interactive terminal (TTY).");
  }

  render(React.createElement(WorkboardApp, { workboard, config }), { exitOnCtrlC: false });
}

function seedDemo(store: SessionStore, prefix: string): void {
  const now = new Date();
  store.write([
    demo("dark-mode", "codex", "system theme vs explicit toggle - your call", "Needs input", 4, prefix, now),
    demo("release-notes", "claude", "draft ready - which feature leads?", "Needs input", 11, prefix, now),
    demo("load-test", "gemini", "-> to return", "Return pending", 3, prefix, now),
    demo("pr-review", "codex", "-> to return", "Working", 0, prefix, now),
    demo("perf-audit", "opencode", "events_org_ts index live - p95 38ms", "Working", 7, prefix, now),
    demo("payment-migration", "claude", "porting billing to the new processor - 12/14", "WIP", 2, prefix, now),
    demo("onboarding-copy", "gemini", "rewriting empty-state copy across 6 screens", "Working", 1, prefix, now),
    demo("test-coverage", "codex", "billing/ from 61% -> 92% - PR #408 merged", "Completed", 9, prefix, now)
  ]);
}

function demo(
  id: string,
  agent: string,
  title: string,
  statusOverride: "Needs input" | "Working" | "Completed" | "Return pending" | "WIP",
  ageMinutes: number,
  prefix: string,
  now: Date
) {
  const updatedAt = new Date(now.getTime() - ageMinutes * 60_000).toISOString();
  return {
    id,
    title,
    agent,
    tmuxSession: `${prefix}-${id}`,
    createdAt: updatedAt,
    updatedAt,
    statusOverride
  };
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
