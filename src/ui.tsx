import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Text, useApp, useStdout } from "ink";
import { orderedStatuses } from "./status.js";
import type { AgentStatus, SessionView, WorkboardConfig } from "./types.js";
import { Workboard } from "./workboard.js";
import { discoverHistory, type HistoryEntry } from "./history.js";
import {
  EMPTY_BUFFER,
  backspace,
  deleteForward,
  deleteWordBefore,
  getCurrentSlashToken,
  insertText,
  killLine,
  moveDown,
  moveLeft,
  moveLineEnd,
  moveLineStart,
  moveRight,
  moveUp,
  moveWordLeft,
  moveWordRight,
  type PromptBufferState
} from "./promptBuffer.js";
import { useTerminalInput } from "./terminalInput.js";
import { SlashCommandMenu } from "./SlashCommandMenu.js";
import { buildSlashCommands, filterSlashCommands, isExactSlashCommand, type SlashCommandItem } from "./slashCommands.js";
import { runWorkboardCommand } from "./workboardCommands.js";
import { decideCtrlC } from "./ctrlCBehavior.js";

type Props = {
  workboard: Workboard;
  config: WorkboardConfig;
};

type Row =
  | { kind: "heading"; status: AgentStatus }
  | { kind: "session"; session: SessionView; index: number };

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function WorkboardApp({ workboard, config }: Props): React.ReactElement {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [sessions, setSessions] = useState<SessionView[]>(() => workboard.list());
  const [history, setHistory] = useState<HistoryEntry[]>(() => discoverHistory());
  const [selected, setSelected] = useState(0);
  const [buffer, setBuffer] = useState<PromptBufferState>(EMPTY_BUFFER);
  const [message, setMessage] = useState("");
  const [review, setReview] = useState<{ title: string; content: string } | null>(null);
  const [agentIndex, setAgentIndex] = useState(0);
  const [menuIndex, setMenuIndex] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [pendingExitAt, setPendingExitAt] = useState<number | null>(null);
  const [spinnerIndex, setSpinnerIndex] = useState(0);
  const [attaching, setAttaching] = useState(false);

  const agents = useMemo(() => Object.keys(config.agents), [config.agents]);
  const currentAgent = agents[agentIndex] ?? config.defaultAgent;
  const visibleSessions = useMemo(() => buildVisibleSessions(sessions), [sessions]);
  const selectedSession = visibleSessions[selected];
  const selectedWorking = selectedSession?.status === "Working";
  const slashCommands = useMemo(() => buildSlashCommands(agents), [agents]);
  const slashToken = getCurrentSlashToken(buffer);
  const slashMenu = useMemo(
    () => (slashToken ? filterSlashCommands(slashCommands, slashToken) : []),
    [slashCommands, slashToken]
  );
  const showSlashMenu = slashMenu.length > 0;

  const refresh = useCallback(() => {
    const next = workboard.list();
    setSessions(next);
    setHistory(discoverHistory());
    setSelected((current) => Math.min(current, Math.max(0, buildVisibleSessions(next).length - 1)));
  }, [workboard]);

  useEffect(() => {
    const timer = setInterval(refresh, 1000);
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    const hide = () => stdout.write("[?25l");
    const show = () => stdout.write("[?25h");
    hide();
    process.on("exit", show);
    return () => {
      show();
      process.off("exit", show);
    };
  }, [stdout]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!selectedWorking) {
      setSpinnerIndex(0);
      return;
    }
    const timer = setInterval(() => {
      setSpinnerIndex((index) => (index + 1) % SPINNER_FRAMES.length);
    }, 80);
    return () => clearInterval(timer);
  }, [selectedWorking]);

  const rows = useMemo(() => buildRows(sessions), [sessions]);

  useEffect(() => {
    if (!showSlashMenu) {
      setMenuIndex(0);
      return;
    }
    if (menuIndex >= slashMenu.length) {
      setMenuIndex(Math.max(0, slashMenu.length - 1));
    }
  }, [menuIndex, showSlashMenu, slashMenu.length]);

  useEffect(() => {
    setHistoryIndex((index) => Math.min(index, Math.max(0, history.length - 1)));
  }, [history.length]);

  const restoreHistoryAt = useCallback((index: number) => {
    const entry = history[index];
    if (!entry) {
      setMessage("no history session selected");
      return;
    }
    try {
      const restored = workboard.restore(entry);
      setHistoryOpen(false);
      setBuffer(EMPTY_BUFFER);
      setMessage(`restored ${restored.id}`);
      refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }, [history, refresh, workboard]);

  const attachSession = useCallback((sessionId: string) => {
    const session = sessions.find((candidate) => candidate.id === sessionId || candidate.tmuxSession === sessionId);
    if (!session) {
      setMessage(`unknown session ${sessionId}`);
      return;
    }
    setAttaching(true);
    setMessage(`attached to ${session.id}; detach tmux to return`);
    setTimeout(() => {
      try {
        stdout.write("\u001B[2J\u001B[3J\u001B[H");
        workboard.attach(session.id);
        stdout.write("[?25l");
        setMessage(`returned from ${session.id}`);
        refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : String(error));
      } finally {
        setAttaching(false);
      }
    }, 20);
  }, [refresh, sessions, stdout, workboard]);

  const submit = useCallback(() => {
    const value = buffer.text.trim();
    if (!value) return;
    setBuffer(EMPTY_BUFFER);

    try {
      if (value.startsWith("/")) {
          if (value === "/history") {
          const nextHistory = discoverHistory();
          setHistory(nextHistory);
          setHistoryOpen(true);
          setMessage(nextHistory.length > 0 ? "history browser opened" : "no history sessions found");
          return;
        }
        runWorkboardCommand(value, {
          sessions: visibleSessions,
          history,
          selected,
          currentAgent,
          agents,
          workboard: {
            create: workboard.create.bind(workboard),
            restore: workboard.restore.bind(workboard),
            send: workboard.send.bind(workboard),
            setStatus: workboard.setStatus.bind(workboard),
            review: workboard.review.bind(workboard),
            kill: workboard.kill.bind(workboard),
            attach: attachSession
          },
          setSelected,
          setAgentIndex,
          setMessage,
          setReview: (title, content) => setReview({ title, content }),
          exit
        });
      } else if (selectedSession?.exists) {
        workboard.send(selectedSession.id, value);
        setMessage(`sent to ${selectedSession.id}`);
      } else {
        const created = workboard.create(currentAgent, value);
        setMessage(`created ${created.id}`);
      }
      refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }, [agents, attachSession, buffer.text, currentAgent, exit, history, refresh, selected, selectedSession, visibleSessions, workboard]);

  const openSelected = useCallback(() => {
    const session = selectedSession;
    if (!session) return;
    attachSession(session.id);
  }, [attachSession, selectedSession]);

  const killSelected = useCallback(() => {
    const session = selectedSession;
    if (!session) return;
    workboard.kill(session.id);
    setMessage(`stopped ${session.id}`);
    refresh();
  }, [refresh, selectedSession, workboard]);

  const applySlashCommand = useCallback((item: SlashCommandItem) => {
    if (item.kind === "history") {
      const nextHistory = discoverHistory();
      setHistory(nextHistory);
      setHistoryOpen(true);
      setBuffer(EMPTY_BUFFER);
      setMessage(nextHistory.length > 0 ? "history browser opened" : "no history sessions found");
      return;
    }
    if (item.insertText) {
      setBuffer({ text: item.insertText, cursor: item.insertText.length });
      return;
    }
    setBuffer({ text: item.label, cursor: item.label.length });
  }, []);

  useTerminalInput((value, key) => {
    if (historyOpen) {
      if (key.escape) {
        setHistoryOpen(false);
        setMessage("history browser closed");
        return;
      }
      if (key.upArrow || value === "k") {
        setHistoryIndex((index) => Math.max(0, index - 1));
        return;
      }
      if (key.downArrow || value === "j") {
        setHistoryIndex((index) => Math.min(Math.max(0, history.length - 1), index + 1));
        return;
      }
      if (key.return) {
        restoreHistoryAt(historyIndex);
        return;
      }
      if (key.ctrl && value === "c") {
        setHistoryOpen(false);
        setMessage("history browser closed");
        return;
      }
      return;
    }

    if (key.ctrl && value === "c") {
      const decision = decideCtrlC(buffer.text, pendingExitAt, Date.now());
      setMessage(decision.message);
      setPendingExitAt(decision.pendingExitAt);
      if (decision.action === "clearPrompt") {
        setBuffer(EMPTY_BUFFER);
      } else if (decision.action === "exit") {
        exit();
      }
      return;
    }
    setPendingExitAt(null);
    if (key.escape) {
      setBuffer(EMPTY_BUFFER);
      setMenuIndex(0);
      setReview(null);
      setHistoryOpen(false);
      return;
    }
    if (key.ctrl && value === "n") {
      setBuffer({ text: `/new ${currentAgent} `, cursor: `/new ${currentAgent} `.length });
      return;
    }
    if (key.ctrl && value === "o") {
      openSelected();
      return;
    }
    if (key.ctrl && value === "x") {
      killSelected();
      return;
    }
    if (showSlashMenu && key.tab) {
      setMenuIndex((index) => (index + 1) % slashMenu.length);
      return;
    }
    if (!showSlashMenu && key.tab) {
      setAgentIndex((index) => (index + 1) % Math.max(1, agents.length));
      return;
    }
    if (key.return) {
      if (showSlashMenu && slashMenu[menuIndex] && !key.shift) {
        if (isExactSlashCommand(buffer.text, slashMenu[menuIndex])) {
          submit();
          return;
        }
        applySlashCommand(slashMenu[menuIndex]);
        return;
      }
      if (key.shift) {
        setBuffer((current) => insertText(current, "\n"));
        return;
      }
      submit();
      return;
    }
    if (key.backspace) {
      setBuffer((current) => backspace(current));
      return;
    }
    if (key.delete) {
      setBuffer((current) => deleteForward(current));
      return;
    }
    if (key.ctrl && value === "w") {
      setBuffer((current) => deleteWordBefore(current));
      return;
    }
    if (key.ctrl && value === "k") {
      setBuffer((current) => killLine(current));
      return;
    }
    if (key.home || (key.ctrl && value === "a")) {
      setBuffer((current) => moveLineStart(current));
      return;
    }
    if (key.end || (key.ctrl && value === "e")) {
      setBuffer((current) => moveLineEnd(current));
      return;
    }
    if (key.leftArrow) {
      setBuffer((current) => (key.ctrl || key.meta ? moveWordLeft(current) : moveLeft(current)));
      return;
    }
    if (key.rightArrow) {
      setBuffer((current) => (key.ctrl || key.meta ? moveWordRight(current) : moveRight(current)));
      return;
    }
    if (showSlashMenu && key.upArrow) {
      setMenuIndex((index) => (index - 1 + slashMenu.length) % slashMenu.length);
      return;
    }
    if (showSlashMenu && key.downArrow) {
      setMenuIndex((index) => (index + 1) % slashMenu.length);
      return;
    }
    if (key.upArrow && buffer.text.includes("\n")) {
      setBuffer((current) => moveUp(current));
      return;
    }
    if (key.downArrow && buffer.text.includes("\n")) {
      setBuffer((current) => moveDown(current));
      return;
    }
    if ((key.upArrow || value === "k") && buffer.text.length === 0) {
      setSelected((index) => Math.max(0, index - 1));
      return;
    }
    if ((key.downArrow || value === "j") && buffer.text.length === 0) {
      setSelected((index) => Math.min(Math.max(0, visibleSessions.length - 1), index + 1));
      return;
    }
    if (value >= " " && !key.ctrl && !key.meta) {
      setBuffer((current) => insertText(current, value));
    }
  }, { isActive: !attaching });

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>Agent Workboard</Text>
        <Text color="gray"> tmux router / target: {currentAgent} / Tab cycles agent</Text>
      </Box>

      <Box flexDirection="column" minHeight={18}>
        {rows.length === 0 ? (
          <Text color="gray">No sessions yet. Type a task and press enter to create one.</Text>
        ) : (
          rows.map((row, rowIndex) => {
            if (row.kind === "heading") {
              return <StatusHeading key={`heading-${row.status}-${rowIndex}`} status={row.status} />;
            }
            return (
              <SessionRow
                key={row.session.id}
                session={row.session}
                agentLabel={config.agents[row.session.agent]?.label ?? row.session.agent}
                selected={row.index === selected}
              />
            );
          })
        )}
      </Box>

      {historyOpen ? (
        <HistoryPicker history={history} selected={historyIndex} />
      ) : (
        <CurrentSessionPane session={selectedSession} />
      )}

      {review ? <ReviewPane title={review.title} content={review.content} /> : null}

      <Box marginTop={1}>
        <Text color="gray">{"─".repeat(Math.max(20, stdout.columns || 80))}</Text>
      </Box>
      {showSlashMenu ? <SlashCommandMenu items={slashMenu} activeIndex={menuIndex} width={stdout.columns || 80} /> : null}
      <PromptMeta session={selectedSession} fallbackAgent={currentAgent} />
      <Box>
        <PromptPrefix working={selectedWorking} spinnerIndex={spinnerIndex} />
        <PromptText buffer={buffer} placeholder="describe a task or type / for commands" />
      </Box>
      <Box>
        <Text color="gray">{"─".repeat(Math.max(20, stdout.columns || 80))}</Text>
      </Box>
      <Text color="gray">
        enter send/create · shift+enter newline · / commands · arrows edit/select · ctrl+x stop
        {message ? ` · ${message}` : ""}
      </Text>
    </Box>
  );
}

function StatusHeading({ status }: { status: AgentStatus }): React.ReactElement {
  return (
    <Box marginTop={1}>
      <Text bold={status === "Working"} color={status === "Working" ? "white" : "gray"}>
        {status}
      </Text>
    </Box>
  );
}

function SessionRow({
  session,
  agentLabel,
  selected
}: {
  session: SessionView;
  agentLabel: string;
  selected: boolean;
}): React.ReactElement {
  const content = `${iconFor(session.status)} ${session.id.padEnd(30)} ${agentLabel.padEnd(13)} ${session.summary}`;
  return (
    <Box>
      <Text inverse={selected} bold={selected} color={selected ? "white" : colorFor(session.status)}>
        {content}
      </Text>
      <Text inverse={selected} color="gray">
        {" "}
        {session.ageLabel}
      </Text>
    </Box>
  );
}

function CurrentSessionPane({ session }: { session?: SessionView }): React.ReactElement {
  const title = session ? `${session.id} · ${session.status}` : "No session selected";
  const lines = session?.latestMessageLines.length ? session.latestMessageLines : [session?.summary || "No current session message."];
  const maxLines = 8;
  const visibleLines = lines.slice(0, maxLines);
  const truncated = lines.length > maxLines;
  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" marginTop={1} paddingX={1}>
      <Text bold>Current Session</Text>
      <Text color="gray">{title}</Text>
      {visibleLines.map((line, index) => (
        <Text key={`${index}-${line}`} wrap="truncate-end">
          {line || " "}
        </Text>
      ))}
      <Text color="gray">
        {truncated ? "… truncated · Ctrl+O or /open to view full tmux session." : "Ctrl+O or /open to view tmux session · /history for JSONL history."}
      </Text>
    </Box>
  );
}

function HistoryPicker({ history, selected }: { history: HistoryEntry[]; selected: number }): React.ReactElement {
  const maxVisible = 10;
  const visibleStart = Math.min(
    Math.max(0, selected - Math.floor((maxVisible - 1) / 2)),
    Math.max(0, history.length - maxVisible)
  );
  const visible = history.slice(visibleStart, visibleStart + maxVisible);

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="cyan" marginTop={1} paddingX={1}>
      <Box justifyContent="space-between">
        <Text bold>Discovered History</Text>
        <Text color="gray">↑↓ select · Enter resume · Esc close</Text>
      </Box>
      {history.length === 0 ? (
        <Text color="gray">No JSONL history sessions found.</Text>
      ) : (
        visible.map((entry, index) => {
          const actualIndex = visibleStart + index;
          const active = actualIndex === selected;
          return (
            <Box key={`${entry.agent}-${entry.id}`}>
              <Text inverse={active} color={entry.agent === "codex" ? "cyan" : "magenta"}>
                {active ? "› " : "  "}
                {entry.agent.padEnd(7)}
              </Text>
              <Text inverse={active} color="gray"> {entry.id.slice(0, 8).padEnd(10)}</Text>
              <Text inverse={active} wrap="truncate-end">{entry.title}</Text>
              <Text inverse={active} color="gray"> {entry.ageLabel}</Text>
            </Box>
          );
        })
      )}
      {history.length > 0 ? (
        <Text color="gray">
          {selected + 1}/{history.length}
        </Text>
      ) : null}
    </Box>
  );
}

function ReviewPane({
  title,
  content
}: {
  title: string;
  content: string;
}): React.ReactElement {
  const lines = content.split(/\r?\n/).slice(-18);
  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" marginTop={1} paddingX={1}>
      <Box justifyContent="space-between">
        <Text bold>Review {title}</Text>
        <Text color="gray">Esc clears prompt · /review refreshes</Text>
      </Box>
      {lines.map((line, index) => (
        <Text key={`${index}-${line}`} color={line.trim() ? undefined : "gray"} wrap="truncate-end">
          {line || " "}
        </Text>
      ))}
      <Box>
        <Text color="gray">Type /open to attach · Esc closes preview.</Text>
      </Box>
    </Box>
  );
}

function PromptText({
  buffer,
  placeholder
}: {
  buffer: PromptBufferState;
  placeholder: string;
}): React.ReactElement {
  if (buffer.text.length === 0) {
    return (
      <Text>
        <Text inverse> </Text>
        <Text color="gray">{placeholder}</Text>
      </Text>
    );
  }

  const before = buffer.text.slice(0, buffer.cursor);
  const cursorChar = buffer.text[buffer.cursor] ?? " ";
  const after = buffer.text.slice(buffer.cursor + (buffer.cursor < buffer.text.length ? 1 : 0));

  return (
    <Text>
      {before}
      <Text inverse>{cursorChar}</Text>
      {after}
    </Text>
  );
}

function PromptPrefix({
  working,
  spinnerIndex
}: {
  working: boolean;
  spinnerIndex: number;
}): React.ReactElement {
  if (working) {
    return (
      <Text bold color="yellow">
        {SPINNER_FRAMES[spinnerIndex] ?? SPINNER_FRAMES[0]}{" "}
      </Text>
    );
  }

  return (
    <Text bold color="green">
      ›{" "}
    </Text>
  );
}

function PromptMeta({
  session,
  fallbackAgent
}: {
  session?: SessionView;
  fallbackAgent: string;
}): React.ReactElement {
  if (session?.exists) {
    return (
      <Text color="gray">
        session: {session.id} agent: {session.agent}
      </Text>
    );
  }

  return <Text color="gray">session: new agent: {fallbackAgent}</Text>;
}

export function buildRows(sessions: SessionView[]): Row[] {
  const rows: Row[] = [];
  let displayIndex = 0;
  for (const status of orderedStatuses()) {
    const group = sessions.filter((session) => session.status === status);
    if (group.length === 0) continue;
    rows.push({ kind: "heading", status });
    for (const session of group) {
      rows.push({ kind: "session", session, index: displayIndex });
      displayIndex += 1;
    }
  }
  return rows;
}

export function buildVisibleSessions(sessions: SessionView[]): SessionView[] {
  return orderedStatuses().flatMap((status) => sessions.filter((session) => session.status === status));
}

function iconFor(status: AgentStatus): string {
  if (status === "Needs input") return "*";
  if (status === "Rate limited") return "!";
  if (status === "Completed") return "*";
  if (status === "Return pending") return "*";
  if (status === "human handoff") return "!";
  if (status === "agent routing") return ">";
  return "+";
}

function colorFor(status: AgentStatus): string {
  if (status === "Needs input") return "yellow";
  if (status === "Rate limited") return "red";
  if (status === "Completed") return "green";
  if (status === "Return pending") return "magenta";
  if (status === "human handoff") return "red";
  if (status === "agent routing") return "cyan";
  return "gray";
}
