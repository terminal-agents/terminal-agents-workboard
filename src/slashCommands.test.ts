import assert from "node:assert/strict";
import test from "node:test";
import { buildSlashCommands, isExactSlashCommand } from "./slashCommands.js";

test("slash commands include history browser command", () => {
  const labels = buildSlashCommands(["codex", "claude"]).map((item) => item.label);

  assert.equal(labels.includes("/history"), true);
});

test("slash commands do not include per-agent commands", () => {
  const labels = buildSlashCommands(["codex", "claude"]).map((item) => item.label);

  assert.equal(labels.includes("/agent codex"), false);
  assert.equal(labels.includes("/agent claude"), false);
});

test("exact slash command detects typed executable command", () => {
  const open = buildSlashCommands(["codex"]).find((item) => item.label === "/open");

  assert.equal(isExactSlashCommand("/open", open), true);
  assert.equal(isExactSlashCommand("/open ", open), true);
  assert.equal(isExactSlashCommand("/op", open), false);
});
