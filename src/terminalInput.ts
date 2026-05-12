import { useEffect, useRef } from "react";
import { useStdin } from "ink";

export type InputKey = {
  upArrow: boolean;
  downArrow: boolean;
  leftArrow: boolean;
  rightArrow: boolean;
  home: boolean;
  end: boolean;
  return: boolean;
  escape: boolean;
  ctrl: boolean;
  shift: boolean;
  tab: boolean;
  backspace: boolean;
  delete: boolean;
  meta: boolean;
};

const CTRL_LEFT = new Set(["\u001B[1;5D", "\u001B[5D"]);
const CTRL_RIGHT = new Set(["\u001B[1;5C", "\u001B[5C"]);
const META_LEFT = new Set(["\u001B[1;3D", "\u001B[3D", "\u001Bb"]);
const META_RIGHT = new Set(["\u001B[1;3C", "\u001B[3C", "\u001Bf"]);
const HOME = new Set(["\u001B[H", "\u001B[1~", "\u001B[7~", "\u001BOH"]);
const END = new Set(["\u001B[F", "\u001B[4~", "\u001B[8~", "\u001BOF"]);
const SHIFT_RETURN = new Set([
  "\n",
  "\u001B\r",
  "\u001B\n",
  "\u001B[13;2u",
  "\u001B[13;2~",
  "\u001B[27;2;13~"
]);

export function parseTerminalInput(data: Buffer | string): { input: string; key: InputKey } {
  const raw = String(data);
  let input = raw;
  const key: InputKey = {
    upArrow: raw === "\u001B[A",
    downArrow: raw === "\u001B[B",
    leftArrow: raw === "\u001B[D" || CTRL_LEFT.has(raw) || META_LEFT.has(raw),
    rightArrow: raw === "\u001B[C" || CTRL_RIGHT.has(raw) || META_RIGHT.has(raw),
    home: HOME.has(raw),
    end: END.has(raw),
    return: raw === "\r" || SHIFT_RETURN.has(raw),
    escape: raw === "\u001B",
    ctrl: CTRL_LEFT.has(raw) || CTRL_RIGHT.has(raw),
    shift: SHIFT_RETURN.has(raw),
    tab: raw === "\t" || raw === "\u001B[Z",
    backspace: raw === "\u007F" || raw === "\b",
    delete: raw === "\u001B[3~" || raw === "\u001B[P",
    meta: META_LEFT.has(raw) || META_RIGHT.has(raw)
  };

  if (raw.length === 1 && raw <= "\u001A" && !key.return) {
    input = String.fromCharCode(raw.charCodeAt(0) + "a".charCodeAt(0) - 1);
    key.ctrl = true;
  }
  if (raw.startsWith("\u001B") && !isKnownEscape(key)) {
    input = raw.slice(1);
    key.meta = true;
  }
  if (key.tab && raw === "\u001B[Z") key.shift = true;
  if (key.tab || key.backspace || key.delete) input = "";
  return { input, key };
}

export function useTerminalInput(
  handler: (input: string, key: InputKey) => void,
  options: { isActive?: boolean } = {}
): void {
  const { stdin, setRawMode } = useStdin();
  const isActive = options.isActive ?? true;
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!isActive) return;
    setRawMode(true);
    return () => setRawMode(false);
  }, [isActive, setRawMode]);

  useEffect(() => {
    if (!isActive) return;
    const onData = (data: Buffer | string) => {
      const parsed = parseTerminalInput(data);
      handlerRef.current(parsed.input, parsed.key);
    };
    stdin?.on("data", onData);
    return () => {
      stdin?.off("data", onData);
    };
  }, [isActive, stdin]);
}

function isKnownEscape(key: InputKey): boolean {
  return (
    key.upArrow ||
    key.downArrow ||
    key.leftArrow ||
    key.rightArrow ||
    key.home ||
    key.end ||
    key.return ||
    key.tab ||
    key.delete ||
    key.ctrl ||
    key.meta
  );
}
