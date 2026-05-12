import type { AgentStatus, SessionView } from "./types.js";
import type { HistoryEntry } from "./history.js";

export type CommandWorkboard = {
  create(agent: string, task: string): { id: string };
  restore(history: HistoryEntry): { id: string };
  send(id: string, input: string): void;
  setStatus(id: string, status: AgentStatus): void;
  review(id: string, lines?: number): string;
  attach(id: string): void;
  kill(id: string): void;
};

export type WorkboardCommandContext = {
  sessions: SessionView[];
  history: HistoryEntry[];
  selected: number;
  currentAgent: string;
  agents: string[];
  workboard: CommandWorkboard;
  setSelected: (index: number) => void;
  setAgentIndex: (index: number) => void;
  setMessage: (message: string) => void;
  setReview: (title: string, content: string) => void;
  exit: () => void;
};

export function runWorkboardCommand(value: string, context: WorkboardCommandContext): void {
  const [command, ...rest] = value.slice(1).trim().split(/\s+/);
  if (command === "new") {
    const { agent, task } = parseNewCommand(rest, context.currentAgent, context.agents);
    if (!task.trim()) {
      throw new Error("Usage: /new [agent] <task>");
    }
    const created = context.workboard.create(agent, task);
    context.setMessage(`created ${created.id}`);
    return;
  }
  if (command === "resume") {
    const [target] = rest;
    if (!target) throw new Error("Usage: /resume <history-id-prefix>");
    const matches = context.history.filter(
      (entry) => entry.id.startsWith(target) || entry.id.slice(0, 8) === target || entry.title.includes(target)
    );
    if (matches.length === 0) throw new Error(`No history matched "${target}".`);
    if (matches.length > 1) {
      throw new Error(`History match is ambiguous: ${matches.slice(0, 3).map((entry) => entry.id.slice(0, 8)).join(", ")}`);
    }
    const restored = context.workboard.restore(matches[0]);
    context.setMessage(`restored ${restored.id}`);
    return;
  }
  if (command === "send") {
    const [id, ...inputParts] = rest;
    if (!id || inputParts.length === 0) throw new Error("Usage: /send <session> <input>");
    context.workboard.send(id, inputParts.join(" "));
    context.setMessage(`sent to ${id}`);
    return;
  }
  if (command === "select") {
    const target = rest.join(" ");
    const index = context.sessions.findIndex((session) => session.id === target || session.title === target);
    if (index < 0) throw new Error(`No session matched "${target}".`);
    context.setSelected(index);
    context.setMessage(`selected ${context.sessions[index]?.id ?? target}`);
    return;
  }
  if (command === "status") {
    const [id, ...statusParts] = rest;
    if (!id || statusParts.length === 0) throw new Error("Usage: /status <session> <status>");
    context.workboard.setStatus(id, statusParts.join(" ") as AgentStatus);
    context.setMessage(`status updated for ${id}`);
    return;
  }
  if (command === "open") {
    const session = context.sessions[context.selected];
    if (session) context.workboard.attach(session.id);
    return;
  }
  if (command === "review") {
    const [target, lineCount] = rest;
    const session = target ? context.sessions.find((item) => item.id === target || item.id.startsWith(target)) : context.sessions[context.selected];
    if (!session) throw new Error(`No session matched "${target ?? ""}".`);
    const lines = lineCount ? Number.parseInt(lineCount, 10) : 30;
    const content = context.workboard.review(session.id, Number.isFinite(lines) ? lines : 30);
    context.setReview(session.id, content);
    context.setMessage(`reviewing ${session.id}`);
    return;
  }
  if (command === "kill") {
    const session = context.sessions[context.selected];
    if (session) {
      context.workboard.kill(session.id);
      context.setMessage(`stopped ${session.id}`);
    }
    return;
  }
  if (command === "refresh") {
    context.setMessage("refreshed");
    return;
  }
  if (command === "help") {
    context.setMessage("/new /history /resume /review /send /select /status /open /kill /refresh /quit");
    return;
  }
  if (command === "quit") {
    context.exit();
    return;
  }
  throw new Error(`Unknown command "/${command}".`);
}

export function parseNewCommand(
  args: string[],
  currentAgent: string,
  agents: string[]
): { agent: string; task: string } {
  const [first, ...rest] = args;
  if (first && agents.includes(first)) {
    return { agent: first, task: rest.join(" ") };
  }
  return { agent: currentAgent, task: args.join(" ") };
}
