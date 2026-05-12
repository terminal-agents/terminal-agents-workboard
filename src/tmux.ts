import { execFileSync, spawnSync } from "node:child_process";

export class Tmux {
  available(): boolean {
    const result = spawnSync("tmux", ["-V"], { stdio: "ignore" });
    return result.status === 0;
  }

  hasSession(name: string): boolean {
    const result = spawnSync("tmux", ["has-session", "-t", name], { stdio: "ignore" });
    return result.status === 0;
  }

  newSession(name: string, cwd: string, command: string): void {
    execFileSync("tmux", ["new-session", "-d", "-s", name, "-c", cwd, command], {
      stdio: "ignore"
    });
  }

  sendKeys(name: string, input: string): void {
    execFileSync("tmux", ["send-keys", "-t", name, "-l", input], {
      stdio: "ignore"
    });
    execFileSync("tmux", ["send-keys", "-t", name, "C-m"], {
      stdio: "ignore"
    });
  }

  capture(name: string, lines = 80): string {
    try {
      return execFileSync("tmux", ["capture-pane", "-pt", name, "-S", `-${lines}`], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"]
      });
    } catch {
      return "";
    }
  }

  kill(name: string): void {
    spawnSync("tmux", ["kill-session", "-t", name], { stdio: "ignore" });
  }

  attach(name: string): void {
    process.stdout.write("\x1b[2J\x1b[H");
    spawnSync("tmux", ["attach-session", "-t", name], { stdio: "inherit" });
  }
}
