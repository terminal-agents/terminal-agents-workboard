import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { WorkboardConfig } from "./types.js";

const defaultConfig: WorkboardConfig = {
  tmuxPrefix: "awb",
  defaultAgent: "codex",
  agents: {
    codex: { label: "Codex", command: "codex", resumeCommand: "codex resume {sessionId}" },
    claude: { label: "Claude Code", command: "claude", resumeCommand: "claude --resume {sessionId}" },
    opencode: { label: "OpenCode", command: "opencode" },
    gemini: { label: "Gemini CLI", command: "gemini" }
  }
};

export function loadConfig(cwd: string): WorkboardConfig {
  const path = join(cwd, ".agent-workboard.json");
  if (!existsSync(path)) {
    return defaultConfig;
  }

  const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<WorkboardConfig>;
  return {
    ...defaultConfig,
    ...parsed,
    agents: {
      ...defaultConfig.agents,
      ...(parsed.agents ?? {})
    }
  };
}

export function ensureConfigExample(cwd: string): void {
  const path = join(cwd, ".agent-workboard.example.json");
  if (existsSync(path)) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(defaultConfig, null, 2)}\n`);
}
