import { useCallback, useEffect, useRef, useState } from "react";
import type { CommandItem } from "./CommandPalette";
import { CommandPalette } from "./CommandPalette";

interface MessageInputProps {
  onSend: (text: string) => void;
  onEscape: () => void;
  onScreenshot?: () => void;
  commands: CommandItem[];
  disabled?: boolean;
  children?: React.ReactNode; // Slot for FileUpload button
  externalPaletteToggle?: number; // Counter incremented by parent (Ctrl+K)
}

export function MessageInput({
  onSend,
  onEscape,
  onScreenshot,
  commands,
  disabled,
  children,
  externalPaletteToggle,
}: MessageInputProps) {
  const [text, setText] = useState("");
  const [showPalette, setShowPalette] = useState(false);
  const [slashFilter, setSlashFilter] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);

  // React to external palette toggle (e.g., Ctrl+K from parent)
  // Uses counter so StrictMode double-invocation sets true twice (idempotent)
  useEffect(() => {
    if (externalPaletteToggle !== undefined) {
      setShowPalette(true);
      setSlashFilter("");
      textareaRef.current?.focus();
    }
  }, [externalPaletteToggle]);

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    historyRef.current.push(trimmed);
    historyIndexRef.current = -1;
    onSend(trimmed);
    setText("");
    setShowPalette(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [text, onSend]);

  const handleSelectCommand = useCallback(
    (name: string) => {
      const cmd = `/${name}`;
      onSend(cmd);
      setText("");
      setShowPalette(false);
      textareaRef.current?.focus();
    },
    [onSend],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
      return;
    }
    // Command history: Ctrl+Up / Ctrl+Down
    if (e.key === "ArrowUp" && e.ctrlKey) {
      e.preventDefault();
      const hist = historyRef.current;
      if (hist.length === 0) return;
      const idx = historyIndexRef.current;
      const newIdx = idx < 0 ? hist.length - 1 : Math.max(0, idx - 1);
      historyIndexRef.current = newIdx;
      setText(hist[newIdx]);
      return;
    }
    if (e.key === "ArrowDown" && e.ctrlKey) {
      e.preventDefault();
      const hist = historyRef.current;
      const idx = historyIndexRef.current;
      if (idx < 0) return;
      if (idx >= hist.length - 1) {
        historyIndexRef.current = -1;
        setText("");
      } else {
        historyIndexRef.current = idx + 1;
        setText(hist[idx + 1]);
      }
      return;
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);

    // Show palette when typing / at the start of a line
    const lines = val.split("\n");
    const lastLine = lines[lines.length - 1];
    if (lastLine.startsWith("/")) {
      setShowPalette(true);
      setSlashFilter(lastLine.slice(1));
    } else {
      setShowPalette(false);
    }

    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

  const handleClosePalette = useCallback(() => {
    setShowPalette(false);
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "8px 12px",
        background: "var(--bg-secondary)",
        borderTop: "1px solid var(--border)",
      }}
    >
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 6 }}>
        <button
          onClick={onEscape}
          title="Interrupt Claude (Escape)"
          style={{
            padding: "4px 10px",
            background: "var(--error)",
            color: "#1e1e2e",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          Esc
        </button>
        <button
          onClick={() => {
            setShowPalette(!showPalette);
            setSlashFilter("");
            textareaRef.current?.focus();
          }}
          title="Commands"
          style={{
            padding: "4px 10px",
            background: showPalette ? "var(--accent)" : "var(--bg-surface)",
            color: showPalette ? "#1e1e2e" : "var(--text-secondary)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          / Commands
        </button>
        {onScreenshot && (
          <button
            onClick={onScreenshot}
            title="Terminal screenshot"
            style={{
              padding: "4px 10px",
              background: "var(--bg-surface)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            Screenshot
          </button>
        )}
        {children}
      </div>

      {/* Input area with command palette */}
      <div style={{ position: "relative", display: "flex", gap: 8, alignItems: "flex-end" }}>
        <CommandPalette
          commands={commands}
          filter={slashFilter}
          visible={showPalette}
          onSelect={handleSelectCommand}
          onClose={handleClosePalette}
        />
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Type a message... (/ for commands, Ctrl+Enter to send)"
          rows={1}
          style={{
            flex: 1,
            resize: "none",
            padding: "8px 12px",
            background: "var(--bg-primary)",
            color: "var(--text-primary)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 14,
            fontFamily: "inherit",
            outline: "none",
            minHeight: 38,
            maxHeight: 200,
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || !text.trim()}
          style={{
            padding: "8px 20px",
            background: text.trim() ? "var(--accent)" : "var(--bg-surface)",
            color: text.trim() ? "#1e1e2e" : "var(--text-muted)",
            border: "none",
            borderRadius: 8,
            cursor: text.trim() ? "pointer" : "default",
            fontSize: 14,
            fontWeight: 600,
            minHeight: 38,
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
