import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { DisplayMessage } from "../hooks/useSession";
import { ExpandableBlock } from "./ExpandableBlock";

interface MessageStreamProps {
  messages: DisplayMessage[];
}

function CopyButton({ text }: { text: string }) {
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
  };

  return (
    <button
      onClick={handleCopy}
      title="Copy"
      style={{
        position: "absolute",
        top: 4,
        right: 4,
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        color: "var(--text-muted)",
        borderRadius: 4,
        padding: "2px 6px",
        cursor: "pointer",
        fontSize: 11,
      }}
    >
      Copy
    </button>
  );
}

function MessageContent({ msg }: { msg: DisplayMessage }) {
  if (msg.contentType === "thinking") {
    return (
      <ExpandableBlock title="Thinking...">
        {msg.text}
      </ExpandableBlock>
    );
  }

  if (msg.contentType === "tool_use") {
    return (
      <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
        {msg.text}
      </div>
    );
  }

  if (msg.contentType === "tool_result") {
    const lines = msg.text.split("\n");
    const summary = lines[0] || "";
    const detail = lines.slice(1).join("\n").trim();

    if (detail) {
      return (
        <ExpandableBlock title={summary}>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{detail}</pre>
        </ExpandableBlock>
      );
    }
    return (
      <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
        {summary}
      </div>
    );
  }

  // Regular text — render as markdown
  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const codeText = String(children).replace(/\n$/, "");
            const isBlock = className?.startsWith("language-");

            if (isBlock) {
              return (
                <div style={{ position: "relative" }}>
                  <CopyButton text={codeText} />
                  <pre
                    style={{
                      background: "var(--bg-secondary)",
                      padding: "12px",
                      borderRadius: 6,
                      overflow: "auto",
                      fontSize: 13,
                    }}
                  >
                    <code className={className} {...props}>
                      {children}
                    </code>
                  </pre>
                </div>
              );
            }
            return (
              <code
                style={{
                  background: "var(--bg-surface)",
                  padding: "2px 5px",
                  borderRadius: 3,
                  fontSize: 13,
                }}
                {...props}
              >
                {children}
              </code>
            );
          },
        }}
      >
        {msg.text}
      </ReactMarkdown>
    </div>
  );
}

export function MessageStream({ messages }: MessageStreamProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const userScrolled = useRef(false);

  // Auto-scroll unless user has scrolled up
  useEffect(() => {
    if (!userScrolled.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    userScrolled.current = !atBottom;
  };

  if (messages.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-muted)",
          fontSize: 14,
        }}
      >
        No messages yet. Send a message to start.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {messages.map((msg) => (
        <div
          key={msg.id}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            maxWidth: "100%",
            background:
              msg.role === "user" ? "var(--bg-surface)" : "transparent",
            borderLeft:
              msg.role === "user"
                ? "3px solid var(--accent)"
                : msg.contentType === "tool_use" || msg.contentType === "tool_result"
                  ? "3px solid var(--text-muted)"
                  : "none",
          }}
        >
          {msg.role === "user" && (
            <div
              style={{
                fontSize: 11,
                color: "var(--accent)",
                marginBottom: 4,
                fontWeight: 600,
              }}
            >
              You
            </div>
          )}
          <MessageContent msg={msg} />
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
