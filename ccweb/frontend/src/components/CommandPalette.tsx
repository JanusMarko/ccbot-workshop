import { useCallback, useEffect, useRef, useState } from "react";

export interface CommandItem {
  name: string;
  description: string;
  group: "built-in" | "project";
}

interface CommandPaletteProps {
  commands: CommandItem[];
  filter: string;
  visible: boolean;
  onSelect: (command: string) => void;
  onClose: () => void;
}

export const BUILTIN_COMMANDS: CommandItem[] = [
  { name: "clear", description: "Clear conversation history", group: "built-in" },
  { name: "compact", description: "Compact conversation context", group: "built-in" },
  { name: "cost", description: "Show token/cost usage", group: "built-in" },
  { name: "model", description: "Switch AI model", group: "built-in" },
  { name: "fast", description: "Toggle fast mode", group: "built-in" },
  { name: "plan", description: "Enter plan mode", group: "built-in" },
  { name: "help", description: "Show Claude Code help", group: "built-in" },
  { name: "memory", description: "Edit CLAUDE.md", group: "built-in" },
  { name: "config", description: "Open settings", group: "built-in" },
  { name: "doctor", description: "Run diagnostics", group: "built-in" },
  { name: "bug", description: "Report a bug", group: "built-in" },
  { name: "hooks", description: "View hooks configuration", group: "built-in" },
  { name: "login", description: "Log in to Anthropic", group: "built-in" },
  { name: "logout", description: "Log out", group: "built-in" },
  { name: "review", description: "Review code changes", group: "built-in" },
];

export function CommandPalette({
  commands,
  filter,
  visible,
  onSelect,
  onClose,
}: CommandPaletteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = commands.filter((cmd) =>
    cmd.name.toLowerCase().includes(filter.toLowerCase()),
  );

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filter]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!visible) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && filtered.length > 0) {
        e.preventDefault();
        // Clamp to prevent out-of-bounds if filter shrank the list
        const idx = Math.min(selectedIndex, filtered.length - 1);
        onSelect(filtered[idx].name);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [visible, filtered, selectedIndex, onSelect, onClose],
  );

  // Only register global keydown when palette is visible
  useEffect(() => {
    if (!visible) return;
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [visible, handleKeyDown]);

  // Scroll selected item into view (use data attribute, not child index,
  // because group headers shift child indices)
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.querySelector(
      `[data-cmd-index="${selectedIndex}"]`,
    ) as HTMLElement | null;
    item?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!visible || filtered.length === 0) return null;

  // Group commands
  const builtIn = filtered.filter((c) => c.group === "built-in");
  const project = filtered.filter((c) => c.group === "project");

  return (
    <div
      style={{
        position: "absolute",
        bottom: "100%",
        left: 0,
        right: 0,
        maxHeight: 300,
        overflowY: "auto",
        background: "var(--bg-primary)",
        border: "1px solid var(--border)",
        borderBottom: "none",
        borderRadius: "8px 8px 0 0",
        zIndex: 50,
      }}
      ref={listRef}
    >
      {project.length > 0 && (
        <>
          <div
            style={{
              padding: "6px 12px",
              fontSize: 11,
              color: "var(--text-muted)",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              background: "var(--bg-secondary)",
            }}
          >
            Project Commands
          </div>
          {project.map((cmd) => {
            const globalIdx = filtered.indexOf(cmd);
            return (
              <CommandRow
                key={cmd.name}
                cmd={cmd}
                index={globalIdx}
                selected={globalIdx === selectedIndex}
                onClick={() => onSelect(cmd.name)}
              />
            );
          })}
        </>
      )}
      {builtIn.length > 0 && (
        <>
          <div
            style={{
              padding: "6px 12px",
              fontSize: 11,
              color: "var(--text-muted)",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              background: "var(--bg-secondary)",
            }}
          >
            Built-in Commands
          </div>
          {builtIn.map((cmd) => {
            const globalIdx = filtered.indexOf(cmd);
            return (
              <CommandRow
                key={cmd.name}
                cmd={cmd}
                index={globalIdx}
                selected={globalIdx === selectedIndex}
                onClick={() => onSelect(cmd.name)}
              />
            );
          })}
        </>
      )}
    </div>
  );
}

function CommandRow({
  cmd,
  selected,
  onClick,
  index,
}: {
  cmd: CommandItem;
  selected: boolean;
  onClick: () => void;
  index: number;
}) {
  return (
    <div
      data-cmd-index={index}
      onClick={onClick}
      style={{
        padding: "8px 12px",
        cursor: "pointer",
        background: selected ? "var(--bg-surface)" : "transparent",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
      }}
    >
      <span style={{ fontWeight: 500, fontSize: 13 }}>/{cmd.name}</span>
      <span
        style={{
          fontSize: 12,
          color: "var(--text-muted)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {cmd.description}
      </span>
    </div>
  );
}
