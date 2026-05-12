export type SlashCommandKind =
  | "new"
  | "resume"
  | "history"
  | "review"
  | "send"
  | "select"
  | "open"
  | "kill"
  | "refresh"
  | "status"
  | "help"
  | "quit";

export type SlashCommandItem = {
  kind: SlashCommandKind;
  name: string;
  label: string;
  description: string;
  insertText?: string;
};

export function buildSlashCommands(agents: string[]): SlashCommandItem[] {
  return [
    { kind: "new", name: "new", label: "/new", description: `Create a session: /new [${agents.join("|")}] <task>`, insertText: "/new " },
    { kind: "history", name: "history", label: "/history", description: "Browse discovered JSONL history sessions" },
    { kind: "resume", name: "resume", label: "/resume", description: "Restore a JSONL history session: /resume <id-prefix>", insertText: "/resume " },
    { kind: "review", name: "review", label: "/review", description: "Preview selected tmux session pane", insertText: "/review" },
    { kind: "send", name: "send", label: "/send", description: "Send input to a session: /send <id> <text>", insertText: "/send " },
    { kind: "select", name: "select", label: "/select", description: "Select a session by id/title", insertText: "/select " },
    { kind: "open", name: "open", label: "/open", description: "Attach to selected tmux session" },
    { kind: "kill", name: "kill", label: "/kill", description: "Stop selected tmux session" },
    { kind: "status", name: "status", label: "/status", description: "Override status: /status <id> <status>", insertText: "/status " },
    { kind: "refresh", name: "refresh", label: "/refresh", description: "Reload tmux/session state" },
    { kind: "help", name: "help", label: "/help", description: "Show available slash commands" },
    { kind: "quit", name: "quit", label: "/quit", description: "Exit workboard" }
  ];
}

export function filterSlashCommands(items: SlashCommandItem[], token: string): SlashCommandItem[] {
  if (!token.startsWith("/")) return [];
  const query = token.slice(1).toLowerCase();
  if (!query) return items;
  return items.filter((item) => item.label.slice(1).toLowerCase().includes(query) || item.description.toLowerCase().includes(query));
}

export function isExactSlashCommand(input: string, item: SlashCommandItem | undefined): boolean {
  if (!item) return false;
  return input.trim() === item.label;
}
