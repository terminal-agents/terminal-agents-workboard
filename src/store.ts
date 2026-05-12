import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { SessionRecord } from "./types.js";

type StateFile = {
  sessions: SessionRecord[];
};

export class SessionStore {
  private readonly path: string;

  constructor(cwd: string) {
    this.path = join(cwd, ".agent-workboard", "state.json");
  }

  read(): SessionRecord[] {
    if (!existsSync(this.path)) return [];
    const parsed = JSON.parse(readFileSync(this.path, "utf8")) as StateFile;
    return parsed.sessions ?? [];
  }

  write(sessions: SessionRecord[]): void {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, `${JSON.stringify({ sessions }, null, 2)}\n`);
  }

  upsert(session: SessionRecord): void {
    const sessions = this.read();
    const index = sessions.findIndex((candidate) => candidate.id === session.id);
    if (index >= 0) {
      sessions[index] = session;
    } else {
      sessions.push(session);
    }
    this.write(sessions);
  }

  remove(id: string): void {
    this.write(this.read().filter((session) => session.id !== id));
  }
}
