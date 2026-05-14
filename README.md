# terminal-agents-workboard

`workboard` is a tmux-backed Node.js + TypeScript prototype for managing multiple code-agent conversations from one terminal workboard.

It can run sessions for tools such as Claude Code, Codex, OpenCode, and Gemini CLI, then group them by inferred state:

- Working
- Needs input
- Rate limited (agent hit a quota / rate limit modal — switch model or wait for reset)
- Completed
- Return pending
- WIP
- Human handoff
- Session switching
- Agent routing

## Requirements

- Node.js 20+
- tmux
- Any agent CLI you want to route to, such as `codex`, `claude`, `opencode`, or `gemini`

## Tech Stack

- Node.js + TypeScript
- React + Ink for terminal rendering
- tmux for agent process/session management

## Status detection

`workboard` polls each tmux pane and infers a status by matching common agent UI patterns. Notably:

- `Needs input` — Codex/Claude prompt sitting idle after an assistant reply, or an initialization prompt (e.g. Codex "Update available · press enter to continue") blocks startup.
- `Rate limited` — codex shows "Approaching rate limits" model-switch modal, or the agent output contains usage-limit / quota-exhausted phrasing. Open the session with `Ctrl+O` to choose a model or wait for the quota window to reset.

## History Discovery

The default UI shows a bordered `Current Session` panel with the selected session's latest message. Long messages are truncated in the panel; use `Ctrl+O` or `/open` to inspect the full tmux session. History is hidden by default and can be opened with `/history`.

The history browser reads JSONL history files only:

- `~/.codex/session_index.jsonl`
- `~/.claude/projects/**/*.jsonl`

Markdown files such as Claude plan documents are intentionally ignored.

On startup, `workboard` initializes `~/.workboard/state.json`. This global state stores mappings between JSONL history ids and tmux sessions, so `/resume <history-id>` can return to the existing tmux session instead of creating a duplicate.

Inside `/history`:

- `↑` / `↓` or `j` / `k`: select a history entry
- `Enter`: resume the selected history session
- `Esc`: close history and return to the prompt

## Setup

```sh
npm install
npm run build
npm link
```

Optional config:

```sh
cp .agent-workboard.example.json .agent-workboard.json
```

Edit `.agent-workboard.json` if your agent commands differ.

## Run

```sh
npm run dev
```

After `npm link`, use the bin directly:

```sh
workboard
```

Useful flags:

```sh
npm run dev -- --demo
npm run dev -- new codex "review this repository"
npm run dev -- list
workboard --demo
workboard new codex "review this repository"
workboard list
```

## Controls

- `↑` / `↓` or `j` / `k`: select a session
- `Enter`: send the bottom input to the selected session
- `/`: open the slash-command menu
- `Shift+Enter`: insert a newline in the prompt
- `←` / `→`: move the prompt cursor
- `Home` / `End`: move to line start/end
- `Alt+←` / `Alt+→` or `Ctrl+←` / `Ctrl+→`: move by word
- `Backspace` / `Delete`: delete before/after the cursor
- `Ctrl+W`: delete the previous word
- `Ctrl+K`: delete to the end of the line
- `Ctrl+N`: mark bottom input as a new-session task
- `Ctrl+O`: attach to the selected tmux session
- `Ctrl+X`: stop the selected session
- `Ctrl+C`: clear the prompt; press again on an empty prompt to quit

Commands typed into the input:

```text
/new codex implement login flow
/new claude inspect failing tests
/history
/resume 019dab7d
/review
/send payment-migration continue
/select pr-review
/open
/kill
/refresh
```

Without a slash command, pressing `Enter` sends the input to the selected conversation. If nothing is selected, it creates a new session with the default agent.
If the selected conversation no longer has a running tmux session, plain input creates a new session instead of sending to the dead session.

History restore uses a stable tmux session name. `workboard` first checks whether that tmux session already exists; if not, it creates one with the configured `resumeCommand`.

Resume command templates can use:

```json
{
  "resumeCommand": "codex resume {sessionId}"
}
```

Available placeholders: `{sessionId}`, `{sourcePath}`, `{cwd}`, `{title}`.
