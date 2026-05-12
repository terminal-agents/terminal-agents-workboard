import { type Dirent, existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { ageLabel } from "./status.js";

export type HistoryEntry = {
  id: string;
  agent: string;
  title: string;
  cwd?: string;
  updatedAt: string;
  ageLabel: string;
  sourcePath: string;
};

type JsonObject = Record<string, unknown>;

export function discoverHistory(limit = 12): HistoryEntry[] {
  return [...discoverCodexHistory(limit), ...discoverClaudeHistory(limit)]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, limit);
}

function discoverCodexHistory(limit: number): HistoryEntry[] {
  const path = join(homedir(), ".codex", "session_index.jsonl");
  if (!existsSync(path)) return [];

  return readJsonl(path)
    .map((item) => {
      const id = asString(item.id) ?? basename(path);
      const updatedAt = asString(item.updated_at) ?? new Date(statSync(path).mtimeMs).toISOString();
      const title = asString(item.thread_name) ?? id;
      return toEntry({ id, agent: "codex", title, updatedAt, sourcePath: path });
    })
    .filter((entry): entry is HistoryEntry => Boolean(entry))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, limit);
}

function discoverClaudeHistory(limit: number): HistoryEntry[] {
  const root = join(homedir(), ".claude", "projects");
  if (!existsSync(root)) return [];

  return findJsonlFiles(root, 5)
    .filter((path) => !path.includes("/subagents/"))
    .map((path) => parseClaudeJsonl(path))
    .filter((entry): entry is HistoryEntry => Boolean(entry))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, limit);
}

function parseClaudeJsonl(path: string): HistoryEntry | null {
  const fallbackId = basename(path, ".jsonl");
  const fallbackTime = new Date(statSync(path).mtimeMs).toISOString();
  let cwd: string | undefined;
  let updatedAt = fallbackTime;
  let sessionId = fallbackId;
  let title = "";

  for (const item of readJsonl(path, 120)) {
    const timestamp = asString(item.timestamp);
    if (timestamp) updatedAt = timestamp;
    cwd = asString(item.cwd) ?? cwd;
    sessionId = asString(item.sessionId) ?? sessionId;

    if (item.type === "user") {
      const message = asObject(item.message);
      const content = extractText(message?.content);
      if (content && !isEnvironmentContext(content)) {
        title = content;
        break;
      }
    }
  }

  if (!title) {
    title = fallbackId;
  }

  return toEntry({
    id: sessionId,
    agent: "claude",
    title,
    cwd: cwd ?? decodeClaudeProjectPath(dirname(path)),
    updatedAt,
    sourcePath: path
  });
}

function findJsonlFiles(root: string, maxDepth: number): string[] {
  const files: string[] = [];
  const visit = (dir: string, depth: number) => {
    if (depth > maxDepth) return;
    for (const entry of safeReadDir(dir)) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(path, depth + 1);
      } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
        files.push(path);
      }
    }
  };
  visit(root, 0);
  return files
    .map((path) => ({ path, mtimeMs: statSync(path).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, 200)
    .map((item) => item.path);
}

function readJsonl(path: string, maxLines = Number.POSITIVE_INFINITY): JsonObject[] {
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .slice(0, maxLines)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as JsonObject;
      } catch {
        return null;
      }
    })
    .filter((item): item is JsonObject => Boolean(item));
}

function safeReadDir(path: string): Dirent<string>[] {
  try {
    return readdirSync(path, { withFileTypes: true, encoding: "utf8" });
  } catch {
    return [];
  }
}

function toEntry(input: Omit<HistoryEntry, "ageLabel">): HistoryEntry | null {
  const title = input.title.trim().replace(/\s+/g, " ").slice(0, 120);
  if (!title) return null;
  return {
    ...input,
    title,
    ageLabel: ageLabel(input.updatedAt)
  };
}

function extractText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map((item) => extractText(asObject(item)?.text)).filter(Boolean).join(" ");
  }
  return "";
}

function decodeClaudeProjectPath(path: string): string | undefined {
  const encoded = basename(path);
  if (!encoded.startsWith("-")) return undefined;
  return encoded.replace(/-/g, "/");
}

function isEnvironmentContext(text: string): boolean {
  return text.trim().startsWith("<environment_context>");
}

function asObject(value: unknown): JsonObject | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}
