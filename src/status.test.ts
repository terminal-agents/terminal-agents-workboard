import assert from "node:assert/strict";
import test from "node:test";
import {
  extractLatestMessageLines,
  inferStatus,
  initializationBlockedMessage,
  isAgentRateLimited,
  rateLimitedMessage,
  summarize
} from "./status.js";
import {
  CLAUDE_IDLE_HI_CAPTURE,
  CLAUDE_IDLE_WORKDAY_CAPTURE,
  CODEX_PROMPT_WITH_PENDING_TEXT_CAPTURE,
  CODEX_RATE_LIMIT_MODAL_CAPTURE,
  CODEX_UPDATE_PROMPT_CAPTURE
} from "./testFixtures.js";

test("Claude idle prompt after assistant response is needs input", () => {
  assert.equal(inferStatus(CLAUDE_IDLE_HI_CAPTURE, true), "Needs input");
});

test("Claude summary prefers latest assistant response over footer", () => {
  assert.equal(summarize(CLAUDE_IDLE_HI_CAPTURE), "Hi! What would you like to work on today?");
});

test("summary filters common terminal footer lines", () => {
  assert.equal(summarize("? for shortcuts · ← for agents"), "session started");
});

test("Claude multi-line assistant response is extracted for current session pane", () => {
  assert.deepEqual(extractLatestMessageLines(CLAUDE_IDLE_WORKDAY_CAPTURE), [
    "下个月是 2026 年 6 月。",
    "",
    "工作日数量",
    "- 6 月共 30 天，其中周一至周五合计 22 天",
    "- 6 月有法定节假日 端午节（农历五月初五，公历 2026-06-19，周五），通常放假 1 天",
    "- 按照常见安排（无调休情况下）：约 21 个工作日",
    "- 实际数字以国务院办公厅公布的 2026 年放假调休安排为准（若有调休补班可能略有变动）",
    "",
    "下一次法定节假日",
    "- 端午节：2026 年 6 月 19 日（周五），与周末连休形成 3 天小长假（6/19–6/21）",
    "",
    "需要我帮你查一下官方发布的 2026 年放假安排吗？"
  ]);
});

test("Codex update prompt is treated as initialization needing input", () => {
  assert.equal(inferStatus(CODEX_UPDATE_PROMPT_CAPTURE, true), "Needs input");
  assert.equal(summarize(CODEX_UPDATE_PROMPT_CAPTURE), initializationBlockedMessage());
  assert.deepEqual(extractLatestMessageLines(CODEX_UPDATE_PROMPT_CAPTURE), [initializationBlockedMessage()]);
});

test("Codex welcome copy mentioning done does not mark session completed", () => {
  assert.equal(inferStatus(CODEX_PROMPT_WITH_PENDING_TEXT_CAPTURE, true), "Needs input");
  assert.equal(summarize(CODEX_PROMPT_WITH_PENDING_TEXT_CAPTURE), "Codex prompt awaiting input: say-hi hi");
});

test("Codex approaching rate limits modal is detected as Rate limited", () => {
  assert.ok(isAgentRateLimited(CODEX_RATE_LIMIT_MODAL_CAPTURE));
  assert.equal(inferStatus(CODEX_RATE_LIMIT_MODAL_CAPTURE, true), "Rate limited");
  assert.equal(summarize(CODEX_RATE_LIMIT_MODAL_CAPTURE), rateLimitedMessage());
  assert.deepEqual(extractLatestMessageLines(CODEX_RATE_LIMIT_MODAL_CAPTURE), [rateLimitedMessage()]);
});

test("Generic usage limit reached message is Rate limited", () => {
  const capture = "You've reached your weekly usage limit. Try again later.";
  assert.ok(isAgentRateLimited(capture));
  assert.equal(inferStatus(capture, true), "Rate limited");
});

test("Out of credits message is Rate limited", () => {
  const capture = "Error: out of credits";
  assert.ok(isAgentRateLimited(capture));
});
