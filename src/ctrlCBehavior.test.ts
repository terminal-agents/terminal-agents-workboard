import assert from "node:assert/strict";
import test from "node:test";
import { decideCtrlC } from "./ctrlCBehavior.js";

test("ctrl+c clears a non-empty prompt first", () => {
  assert.deepEqual(decideCtrlC("hello", null, 1000), {
    action: "clearPrompt",
    message: "prompt cleared; press ctrl+c again to quit",
    pendingExitAt: null
  });
});

test("ctrl+c on an empty prompt asks for confirmation", () => {
  assert.deepEqual(decideCtrlC("", null, 1000), {
    action: "promptExit",
    message: "press ctrl+c again to quit",
    pendingExitAt: 1000
  });
});

test("second ctrl+c within timeout exits", () => {
  assert.deepEqual(decideCtrlC("", 1000, 2500), {
    action: "exit",
    message: "exiting",
    pendingExitAt: null
  });
});

test("second ctrl+c after timeout asks again", () => {
  assert.deepEqual(decideCtrlC("", 1000, 4001), {
    action: "promptExit",
    message: "press ctrl+c again to quit",
    pendingExitAt: 4001
  });
});
