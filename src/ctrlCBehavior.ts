export type CtrlCDecision =
  | { action: "clearPrompt"; message: string; pendingExitAt: null }
  | { action: "promptExit"; message: string; pendingExitAt: number }
  | { action: "exit"; message: string; pendingExitAt: null };

export function decideCtrlC(
  inputText: string,
  pendingExitAt: number | null,
  now: number,
  timeoutMs = 2000
): CtrlCDecision {
  if (inputText.length > 0) {
    return {
      action: "clearPrompt",
      message: "prompt cleared; press ctrl+c again to quit",
      pendingExitAt: null
    };
  }

  if (pendingExitAt !== null && now - pendingExitAt <= timeoutMs) {
    return {
      action: "exit",
      message: "exiting",
      pendingExitAt: null
    };
  }

  return {
    action: "promptExit",
    message: "press ctrl+c again to quit",
    pendingExitAt: now
  };
}
