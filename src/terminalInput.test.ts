import assert from "node:assert/strict";
import test from "node:test";
import { parseTerminalInput } from "./terminalInput.js";

test("enter parses as return without shift", () => {
  const parsed = parseTerminalInput("\r");

  assert.equal(parsed.key.return, true);
  assert.equal(parsed.key.shift, false);
});

test("shift enter parses as shifted return for common terminal sequences", () => {
  for (const sequence of ["\n", "\u001B\r", "\u001B\n", "\u001B[13;2u", "\u001B[13;2~", "\u001B[27;2;13~"]) {
    const parsed = parseTerminalInput(sequence);

    assert.equal(parsed.key.return, true, `return for ${JSON.stringify(sequence)}`);
    assert.equal(parsed.key.shift, true, `shift for ${JSON.stringify(sequence)}`);
  }
});
