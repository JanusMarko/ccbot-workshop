import type { ConnectionStatus } from "../hooks/useWebSocket";

interface StatusBarProps {
  statusText: string;
  contextPct: number | null;
  connectionStatus: ConnectionStatus;
  onExport?: () => void;
}

function contextColor(pct: number): string {
  if (pct < 50) return "var(--success)";
  if (pct < 80) return "var(--warning)";
  return "var(--error)";
}

export function StatusBar({
  statusText,
  contextPct,
  connectionStatus,
  onExport,
}: StatusBarProps) {
  const statusColors: Record<ConnectionStatus, string> = {
    connected: "var(--success)",
    connecting: "var(--warning)",
    reconnecting: "var(--warning)",
    disconnected: "var(--error)",
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "4px 12px",
        background: "var(--bg-secondary)",
        borderTop: "1px solid var(--border)",
        fontSize: 12,
        color: "var(--text-muted)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: statusColors[connectionStatus],
            display: "inline-block",
          }}
        />
        {connectionStatus === "connected"
          ? statusText || "Ready"
          : connectionStatus}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {contextPct !== null && (
          <span style={{ color: contextColor(contextPct) }}>
            Context: {contextPct}%
          </span>
        )}
        {onExport && (
          <button
            onClick={onExport}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              fontSize: 11,
              padding: "2px 4px",
              fontFamily: "inherit",
            }}
          >
            Export
          </button>
        )}
      </div>
    </div>
  );
}
