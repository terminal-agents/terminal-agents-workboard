import type { AgentStatus } from "./types.js";

const statusOrder: AgentStatus[] = [
  "Needs input",
  "Rate limited",
  "Working",
  "Return pending",
  "WIP",
  "human handoff",
  "session switching",
  "agent routing",
  "Completed"
];

export function orderedStatuses(): AgentStatus[] {
  return statusOrder;
}

export function inferStatus(capture: string, exists: boolean): AgentStatus {
  if (!exists) return "Completed";

  const text = capture.toLowerCase();
  if (isAgentRateLimited(capture)) {
    return "Rate limited";
  }
  if (isAgentInitializationBlocked(capture)) {
    return "Needs input";
  }
  if (extractCodexPromptText(capture)) {
    return "Needs input";
  }
  if (hasIdleAgentPrompt(capture)) {
    return "Needs input";
  }
  if (/(need(s)? input|waiting for input|approve|confirm|permission|continue\?|y\/n|\[y\/n\])/.test(text)) {
    return "Needs input";
  }
  if (/(handoff|human handoff|manual intervention|blocked by human)/.test(text)) {
    return "human handoff";
  }
  if (/(routing|route to|select agent|agent routing)/.test(text)) {
    return "agent routing";
  }
  if (/(switching|switched session|session switching|attach-session)/.test(text)) {
    return "session switching";
  }
  if (/(return pending|to return|pending return)/.test(text)) {
    return "Return pending";
  }
  if (hasCompletedLine(capture)) {
    return "Completed";
  }
  if (/(wip|draft|in progress)/.test(text)) {
    return "WIP";
  }
  return "Working";
}

export function summarize(capture: string): string {
  if (isAgentRateLimited(capture)) {
    return rateLimitedMessage();
  }
  if (isAgentInitializationBlocked(capture)) {
    return initializationBlockedMessage();
  }
  const codexPromptText = extractCodexPromptText(capture);
  if (codexPromptText) {
    return `Codex prompt awaiting input: ${codexPromptText}`.slice(0, 96);
  }

  const latestMessageLines = extractLatestMessageLines(capture);
  if (latestMessageLines.length > 0) {
    return latestMessageLines[0]?.replace(/\s+/g, " ").slice(0, 96) ?? "session started";
  }

  const lines = capture
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(cleanLine)
    .filter(Boolean)
    .filter((line) => !isPromptLine(line))
    .filter((line) => !isFooterLine(line))
    .filter((line) => !isCodexNoiseLine(line));

  const assistantLine = [...lines].reverse().find((line) => isAssistantLine(line));
  const last = assistantLine ?? lines.at(-1) ?? "session started";
  return stripAssistantPrefix(last).replace(/\s+/g, " ").slice(0, 96);
}

export function extractLatestMessageLines(capture: string): string[] {
  if (isAgentRateLimited(capture)) {
    return [rateLimitedMessage()];
  }
  if (isAgentInitializationBlocked(capture)) {
    return [initializationBlockedMessage()];
  }

  const rawLines = capture.split(/\r?\n/);
  const assistantStart = findLastIndex(rawLines, (line) => isAssistantLine(cleanLine(line.trim())));
  if (assistantStart < 0) return [];

  const lines: string[] = [];
  for (const rawLine of rawLines.slice(assistantStart)) {
    const line = cleanLine(rawLine.trimEnd());
    if (!line) {
      if (lines.length > 0) lines.push("");
      continue;
    }
    if (lines.length > 0 && (isPromptLine(line) || isFooterLine(line) || isThinkingLine(line))) {
      break;
    }
    if (lines.length > 0 && /^Claude Code v/i.test(line)) {
      break;
    }
    if (isAssistantLine(line)) {
      lines.push(stripAssistantPrefix(line));
      continue;
    }
    lines.push(line);
  }

  return trimBlankEdges(lines).slice(0, 40);
}

export function ageLabel(iso: string): string {
  const elapsed = Math.max(0, Date.now() - new Date(iso).getTime());
  const seconds = Math.floor(elapsed / 1000);
  if (seconds < 60) return `${Math.max(1, seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function isAgentInitializationBlocked(capture: string): boolean {
  const text = capture.toLowerCase();
  return (
    /update available/.test(text) &&
    /press enter to continue/.test(text) &&
    /(update now|skip until next version|release notes)/.test(text)
  );
}

export function initializationBlockedMessage(): string {
  return "Agent initialization needs input. Use /open or Ctrl+O to finish setup in tmux.";
}

export function isAgentRateLimited(capture: string): boolean {
  const text = capture.toLowerCase();
  return (
    /approaching rate limits?/.test(text) ||
    /rate limit (?:reached|exceeded|hit)/.test(text) ||
    /(?:daily|weekly|monthly|usage|quota|5-?h(?:our)?) limit (?:reached|exceeded|hit)/.test(text) ||
    /you'?ve reached your [^\n]{0,60}(?:usage|quota|rate) limit/.test(text) ||
    /(?:quota|usage) exhausted/.test(text) ||
    /usage limit hit/.test(text) ||
    /out of (?:credits|quota|tokens)/.test(text)
  );
}

export function rateLimitedMessage(): string {
  return "Agent quota/rate limit reached. Use /open or Ctrl+O to switch model or wait for reset.";
}

function hasIdleAgentPrompt(capture: string): boolean {
  const lines = capture
    .split(/\r?\n/)
    .map((line) => cleanLine(line.trim()))
    .filter(Boolean)
    .filter((line) => !isFooterLine(line))
    .filter((line) => !isCodexNoiseLine(line));

  const lastMeaningful = lines.at(-1) ?? "";
  const hasAssistantResponse = lines.some((line) => isAssistantLine(line));
  return hasAssistantResponse && isPromptLine(lastMeaningful);
}

function cleanLine(line: string): string {
  return line
    .replace(/\u00a0/g, " ")
    .replace(/[│╭╮╰╯─]+/g, "")
    .trim();
}

function isPromptLine(line: string): boolean {
  return /^[>❯›$#]\s*$/.test(line) || /^[\w.-]+[$#]\s*$/.test(line);
}

function isFooterLine(line: string): boolean {
  return (
    /^\? for shortcuts\b/.test(line) ||
    /^← for agents\b/.test(line) ||
    /^for shortcuts ·/.test(line) ||
    /for shortcuts · .*for agents/.test(line)
  );
}

function isAssistantLine(line: string): boolean {
  return /^[⏺●]\s+/.test(line);
}

function isThinkingLine(line: string): boolean {
  return /^[✻✽✶]\s+/.test(line);
}

function hasCompletedLine(capture: string): boolean {
  return capture
    .split(/\r?\n/)
    .map((line) => cleanLine(line.trim()).toLowerCase())
    .some((line) =>
      line === "done" ||
      line === "completed" ||
      /^done[.!:]?$/.test(line) ||
      /^completed[.!:]?$/.test(line) ||
      /\ball tests pass\b/.test(line) ||
      /\bpr #[0-9]+ merged\b/.test(line) ||
      /^success\b/.test(line) ||
      /^finished\b/.test(line)
    );
}

function extractCodexPromptText(capture: string): string | null {
  const promptLine = capture
    .split(/\r?\n/)
    .map((line) => cleanLine(line.trim()))
    .reverse()
    .find((line) => /^›\s+\S/.test(line));
  if (!promptLine) return null;
  return promptLine.replace(/^›\s+/, "").trim() || null;
}

function isCodexNoiseLine(line: string): boolean {
  return (
    /^gpt-[\w.-]+\s+.*·/.test(line) ||
    /^model:\s+/.test(line) ||
    /^directory:\s+/.test(line) ||
    /^tip:\s+/i.test(line) ||
    /^learn more:/i.test(line)
  );
}

function stripAssistantPrefix(line: string): string {
  return line.replace(/^[⏺●]\s+/, "");
}

function trimBlankEdges(lines: string[]): string[] {
  let start = 0;
  let end = lines.length;
  while (start < end && !lines[start]?.trim()) start++;
  while (end > start && !lines[end - 1]?.trim()) end--;
  return lines.slice(start, end);
}

function findLastIndex<T>(items: T[], predicate: (item: T) => boolean): number {
  for (let index = items.length - 1; index >= 0; index--) {
    if (predicate(items[index] as T)) return index;
  }
  return -1;
}
