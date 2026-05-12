export const CLAUDE_IDLE_HI_CAPTURE = `
╭─── Claude Code v2.1.139 ─────────────────────────────────────────────────────╮
│                                                    │ Tips for getting        │
│               Welcome back Allansin!               │ started                 │
│                                                    │ Run /init to create a … │
│                       ▐▛███▜▌                      │ ─────────────────────── │
│                      ▝▜█████▛▘                     │ What's new              │
│                        ▘▘ ▝▝                       │ \`/config\` settings (th… │
│ Opus 4.7 · Claude Pro · allansinhuang@gmail.com's  │ Added \`prUrlTemplate\` … │
│ Organization                                       │ Added \`CLAUDE_CODE_HID… │
│   ~/Documents/workspace/terminal-agent-workboard   │ /release-notes for more │
╰──────────────────────────────────────────────────────────────────────────────╯

❯ hihi

⏺ Hi! What would you like to work on today?

✻ Crunched for 2s

────────────────────────────────────────────────────────────────────────────────
❯ 
────────────────────────────────────────────────────────────────────────────────
  ? for shortcuts · ← for agents
`;

export const CLAUDE_IDLE_WORKDAY_CAPTURE = `
❯ 下个月有几个工作日？下一次法定节假日是什么时候？

⏺ 下个月是 2026 年 6 月。

  工作日数量
  - 6 月共 30 天，其中周一至周五合计 22 天
  - 6 月有法定节假日 端午节（农历五月初五，公历 2026-06-19，周五），通常放假 1 天
  - 按照常见安排（无调休情况下）：约 21 个工作日
  - 实际数字以国务院办公厅公布的 2026 年放假调休安排为准（若有调休补班可能略有变动）

  下一次法定节假日
  - 端午节：2026 年 6 月 19 日（周五），与周末连休形成 3 天小长假（6/19–6/21）

  需要我帮你查一下官方发布的 2026 年放假安排吗？

✻ Brewed for 16s

────────────────────────────────────────────────────────────────────────────────
❯ 
────────────────────────────────────────────────────────────────────────────────
  ? for shortcuts · ← for agents
`;

export const CODEX_UPDATE_PROMPT_CAPTURE = `
  ✨ Update available! 0.128.0 -> 0.130.0

  Release notes: https://github.com/openai/codex/releases/latest

› 1. Update now (runs \`npm install -g @openai/codex\`)
  2. Skip
  3. Skip until next version

  Press enter to continue
`;

export const CODEX_RATE_LIMIT_MODAL_CAPTURE = `
╭───────────────────────────────────────────────────╮
│ >_ OpenAI Codex (v0.130.0)                        │
│                                                   │
│ model:     gpt-5.5 medium   /model to change      │
│ directory: ~/…/workspace/terminal-agent-workboard │
╰───────────────────────────────────────────────────╯

⚠ Heads up, you have less than 5% of your 5h limit left. Run /status for a breakdown.


› hhh


• hhh


  Approaching rate limits
  Switch to gpt-5.4-mini for lower credit usage?

› 1. Switch to gpt-5.4-mini                 Small, fast, and cost-efficient model for simpler coding
                                            tasks.
  2. Keep current model
  3. Keep current model (never show again)  Hide future rate limit reminders about switching models.

  Press enter to confirm or esc to go back
`;

export const CODEX_PROMPT_WITH_PENDING_TEXT_CAPTURE = `
╭───────────────────────────────────────────────────╮
│ >_ OpenAI Codex (v0.130.0)                        │
│                                                   │
│ model:     gpt-5.5 medium   /model to change      │
│ directory: ~/…/workspace/terminal-agent-workboard │
╰───────────────────────────────────────────────────╯

  Tip: GPT-5.5 is now available in Codex. It's our strongest agentic coding
  model yet, built to reason through large codebases, check assumptions with
  tools, and keep going until the work is done.

  Learn more: https://openai.com/index/introducing-gpt-5-5/

⚠ 3 hooks need review before they can run. Open /hooks to review them.

⚠ \`on-failure\` approval policy is deprecated and will be removed in a future
  release. Use \`on-request\` for interactive approvals or \`never\` for non-
  interactive runs.

⚠ Heads up, you have less than 10% of your 5h limit left. Run /status for a
  breakdown.


› say-hi hi


  gpt-5.5 medium · ~/Documents/workspace/terminal-agent-workboard
`;
