import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export type HistoryTmuxMapping = {
  historyId: string;
  historyPath: string;
  agent: string;
  sessionId: string;
  tmuxSession: string;
  cwd: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

type GlobalStateFile = {
  mappings: HistoryTmuxMapping[];
};

export class GlobalStateStore {
  readonly dir: string;
  readonly path: string;

  constructor(dir = defaultWorkboardHome()) {
    this.dir = dir;
    this.path = join(dir, "state.json");
  }

  init(): void {
    mkdirSync(this.dir, { recursive: true });
    if (!existsSync(this.path)) {
      this.writeMappings([]);
    }
  }

  readMappings(): HistoryTmuxMapping[] {
    if (!existsSync(this.path)) return [];
    const parsed = JSON.parse(readFileSync(this.path, "utf8")) as Partial<GlobalStateFile>;
    return parsed.mappings ?? [];
  }

  findByHistoryId(historyId: string): HistoryTmuxMapping | undefined {
    return this.readMappings().find((mapping) => mapping.historyId === historyId);
  }

  upsertMapping(mapping: HistoryTmuxMapping): void {
    const mappings = this.readMappings();
    const index = mappings.findIndex((candidate) => candidate.historyId === mapping.historyId);
    if (index >= 0) {
      mappings[index] = mapping;
    } else {
      mappings.push(mapping);
    }
    this.writeMappings(mappings);
  }

  private writeMappings(mappings: HistoryTmuxMapping[]): void {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, `${JSON.stringify({ mappings }, null, 2)}\n`);
  }
}

export function defaultWorkboardHome(): string {
  return process.env.WORKBOARD_HOME || join(homedir(), ".workboard");
}
