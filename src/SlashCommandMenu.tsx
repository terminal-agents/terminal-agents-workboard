import React from "react";
import { Box, Text } from "ink";
import type { SlashCommandItem } from "./slashCommands.js";

type Props = {
  items: SlashCommandItem[];
  activeIndex: number;
  width: number;
  maxVisible?: number;
};

export function SlashCommandMenu({ items, activeIndex, width, maxVisible = 7 }: Props): React.ReactElement | null {
  if (items.length === 0) return null;
  const visibleStart = Math.min(
    Math.max(0, activeIndex - Math.floor((maxVisible - 1) / 2)),
    Math.max(0, items.length - maxVisible)
  );
  const visible = items.slice(visibleStart, visibleStart + maxVisible);
  const labelWidth = Math.min(
    Math.max(14, ...visible.map((item) => item.label.length + 2)),
    Math.max(14, Math.floor(width / 2))
  );

  return (
    <Box flexDirection="column" marginBottom={1}>
      {visible.map((item, index) => {
        const actualIndex = visibleStart + index;
        const active = actualIndex === activeIndex;
        return (
          <Box key={item.name} gap={2}>
            <Box width={labelWidth}>
              <Text color={active ? "cyan" : undefined} bold={active} wrap="truncate-end">
                {active ? "› " : "  "}
                {item.label}
              </Text>
            </Box>
            <Text color={active ? "cyan" : "gray"} wrap="truncate-end">
              {item.description}
            </Text>
          </Box>
        );
      })}
      <Text color="gray">
        ({activeIndex + 1}/{items.length}) ↑↓ select · Enter apply · Esc close
      </Text>
    </Box>
  );
}
