import { useCallback, useRef, useState } from "react";

interface MessageInputProps {
  onSend: (text: string) => void;
  onEscape: () => void;
  disabled?: boolean;
}

export function MessageInput({ onSend, onEscape, disabled }: MessageInputProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [text, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl/Cmd+Enter to submit
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Auto-resize textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

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
      </div>

      {/* Input area */}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Type a message... (Ctrl+Enter to send)"
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
            background: text.trim()
              ? "var(--accent)"
              : "var(--bg-surface)",
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
