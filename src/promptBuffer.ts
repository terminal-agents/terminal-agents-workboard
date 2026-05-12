export type PromptBufferState = {
  text: string;
  cursor: number;
};

export const EMPTY_BUFFER: PromptBufferState = { text: "", cursor: 0 };

export function insertText(state: PromptBufferState, value: string): PromptBufferState {
  if (!value) return state;
  const text = state.text.slice(0, state.cursor) + value + state.text.slice(state.cursor);
  return { text, cursor: state.cursor + value.length };
}

export function backspace(state: PromptBufferState): PromptBufferState {
  if (state.cursor === 0) return state;
  return {
    text: state.text.slice(0, state.cursor - 1) + state.text.slice(state.cursor),
    cursor: state.cursor - 1
  };
}

export function deleteForward(state: PromptBufferState): PromptBufferState {
  if (state.cursor >= state.text.length) return state;
  return {
    text: state.text.slice(0, state.cursor) + state.text.slice(state.cursor + 1),
    cursor: state.cursor
  };
}

export function deleteWordBefore(state: PromptBufferState): PromptBufferState {
  const end = state.cursor;
  let start = end;
  while (start > 0 && /\s/.test(state.text[start - 1] ?? "")) start--;
  while (start > 0 && !/\s/.test(state.text[start - 1] ?? "")) start--;
  return {
    text: state.text.slice(0, start) + state.text.slice(end),
    cursor: start
  };
}

export function moveLeft(state: PromptBufferState): PromptBufferState {
  return state.cursor === 0 ? state : { ...state, cursor: state.cursor - 1 };
}

export function moveRight(state: PromptBufferState): PromptBufferState {
  return state.cursor >= state.text.length ? state : { ...state, cursor: state.cursor + 1 };
}

export function moveWordLeft(state: PromptBufferState): PromptBufferState {
  let cursor = state.cursor;
  while (cursor > 0 && /\s/.test(state.text[cursor - 1] ?? "")) cursor--;
  while (cursor > 0 && !/\s/.test(state.text[cursor - 1] ?? "")) cursor--;
  return { ...state, cursor };
}

export function moveWordRight(state: PromptBufferState): PromptBufferState {
  let cursor = state.cursor;
  while (cursor < state.text.length && /\s/.test(state.text[cursor] ?? "")) cursor++;
  while (cursor < state.text.length && !/\s/.test(state.text[cursor] ?? "")) cursor++;
  return { ...state, cursor };
}

export function moveLineStart(state: PromptBufferState): PromptBufferState {
  return { ...state, cursor: locate(state).lineStart };
}

export function moveLineEnd(state: PromptBufferState): PromptBufferState {
  return { ...state, cursor: locate(state).lineEnd };
}

export function moveUp(state: PromptBufferState): PromptBufferState {
  const { column, lineStart } = locate(state);
  if (lineStart === 0) return { ...state, cursor: 0 };
  const previousLineEnd = lineStart - 1;
  const previousLineStart = state.text.lastIndexOf("\n", previousLineEnd - 1) + 1;
  return { ...state, cursor: previousLineStart + Math.min(column, previousLineEnd - previousLineStart) };
}

export function moveDown(state: PromptBufferState): PromptBufferState {
  const { column, lineEnd } = locate(state);
  if (lineEnd >= state.text.length) return { ...state, cursor: state.text.length };
  const nextLineStart = lineEnd + 1;
  const nextLineNewline = state.text.indexOf("\n", nextLineStart);
  const nextLineEnd = nextLineNewline === -1 ? state.text.length : nextLineNewline;
  return { ...state, cursor: nextLineStart + Math.min(column, nextLineEnd - nextLineStart) };
}

export function killLine(state: PromptBufferState): PromptBufferState {
  const { lineEnd } = locate(state);
  return { text: state.text.slice(0, state.cursor) + state.text.slice(lineEnd), cursor: state.cursor };
}

export function getCurrentSlashToken(state: PromptBufferState): string | null {
  const beforeCursor = state.text.slice(0, state.cursor);
  const line = beforeCursor.slice(beforeCursor.lastIndexOf("\n") + 1);
  if (!line.startsWith("/") || /\s/.test(line)) return null;
  return line;
}

function locate(state: PromptBufferState): { column: number; lineStart: number; lineEnd: number } {
  const before = state.text.slice(0, state.cursor);
  const lineStart = before.lastIndexOf("\n") + 1;
  const after = state.text.slice(state.cursor);
  const nextNewline = after.indexOf("\n");
  return {
    column: state.cursor - lineStart,
    lineStart,
    lineEnd: nextNewline === -1 ? state.text.length : state.cursor + nextNewline
  };
}
