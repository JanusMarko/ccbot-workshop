import type { WsInteractiveUI, ClientSendKey } from "../protocol";

interface InteractiveUIProps {
  ui: WsInteractiveUI;
  onSendKey: (key: ClientSendKey["key"]) => void;
}

function StructuredUI({
  ui,
  onSendKey,
}: {
  ui: WsInteractiveUI;
  onSendKey: (key: ClientSendKey["key"]) => void;
}) {
  const data = ui.structured!;

  if (data.ui_name === "AskUserQuestion") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {data.options.map((opt) => (
          <button
            key={opt.index}
            onClick={() => {
              // Navigate to this option with arrow keys, then select with Space
              // For simplicity: send the appropriate number of Down keys then Space
              // In practice the frontend should track the current selection
              onSendKey("Space");
            }}
            style={{
              padding: "8px 14px",
              background: opt.checked ? "var(--accent)" : "var(--bg-surface)",
              color: opt.checked ? "#1e1e2e" : "var(--text-primary)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              cursor: "pointer",
              textAlign: "left",
              fontSize: 14,
              fontFamily: "inherit",
            }}
          >
            {opt.checked ? "\u2714 " : "\u25A1 "}
            {opt.label}
          </button>
        ))}
        <button
          onClick={() => onSendKey("Enter")}
          style={{
            padding: "8px 14px",
            background: "var(--accent)",
            color: "#1e1e2e",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 600,
            marginTop: 4,
          }}
        >
          Submit
        </button>
      </div>
    );
  }

  if (data.ui_name === "ExitPlanMode") {
    return (
      <div>
        {data.description && (
          <div
            style={{
              marginBottom: 10,
              fontSize: 13,
              color: "var(--text-secondary)",
              whiteSpace: "pre-wrap",
            }}
          >
            {data.description}
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => onSendKey("Enter")}
            style={{
              padding: "8px 20px",
              background: "var(--accent)",
              color: "#1e1e2e",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Proceed
          </button>
          <button
            onClick={() => onSendKey("Escape")}
            style={{
              padding: "8px 20px",
              background: "var(--bg-surface)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Edit Plan
          </button>
        </div>
      </div>
    );
  }

  if (
    data.ui_name === "PermissionPrompt" ||
    data.ui_name === "BashApproval"
  ) {
    return (
      <div>
        <div
          style={{
            marginBottom: 10,
            fontSize: 13,
            whiteSpace: "pre-wrap",
            color: "var(--text-secondary)",
          }}
        >
          {data.description}
        </div>
        {data.command && (
          <pre
            style={{
              background: "var(--bg-secondary)",
              padding: "8px 12px",
              borderRadius: 6,
              fontSize: 13,
              marginBottom: 10,
              border: "1px solid var(--error)",
            }}
          >
            {data.command}
          </pre>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => onSendKey("Enter")}
            style={{
              padding: "8px 20px",
              background: "var(--success)",
              color: "#1e1e2e",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Allow
          </button>
          <button
            onClick={() => onSendKey("Escape")}
            style={{
              padding: "8px 20px",
              background: "var(--error)",
              color: "#1e1e2e",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Deny
          </button>
        </div>
      </div>
    );
  }

  // Fallback for unknown structured UI types
  return <RawUI content={ui.raw_content} onSendKey={onSendKey} />;
}

function RawUI({
  content,
  onSendKey,
}: {
  content: string;
  onSendKey: (key: ClientSendKey["key"]) => void;
}) {
  return (
    <div>
      <pre
        style={{
          background: "var(--bg-secondary)",
          padding: "12px",
          borderRadius: 6,
          fontSize: 13,
          whiteSpace: "pre-wrap",
          marginBottom: 10,
        }}
      >
        {content}
      </pre>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 4,
          maxWidth: 280,
        }}
      >
        {(
          [
            ["Space", "\u2423 Space"],
            ["Up", "\u2191"],
            ["Tab", "\u21E5 Tab"],
            ["Left", "\u2190"],
            ["Down", "\u2193"],
            ["Right", "\u2192"],
            ["Escape", "Esc"],
            ["Enter", "\u23CE Enter"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => onSendKey(key)}
            style={{
              padding: "6px",
              background: "var(--bg-surface)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 12,
              fontFamily: "inherit",
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function InteractiveUI({ ui, onSendKey }: InteractiveUIProps) {
  return (
    <div
      style={{
        padding: "12px",
        margin: "8px 16px",
        background: "var(--bg-surface)",
        border: "1px solid var(--accent)",
        borderRadius: 8,
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: "var(--accent)",
          marginBottom: 8,
          fontWeight: 600,
        }}
      >
        {ui.ui_name}
      </div>
      {ui.structured ? (
        <StructuredUI ui={ui} onSendKey={onSendKey} />
      ) : (
        <RawUI content={ui.raw_content} onSendKey={onSendKey} />
      )}
    </div>
  );
}
