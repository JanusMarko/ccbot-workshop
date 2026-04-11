import type { ConnectionStatus } from "../hooks/useWebSocket";

interface StatusBarProps {
  statusText: string;
  connectionStatus: ConnectionStatus;
}

export function StatusBar({ statusText, connectionStatus }: StatusBarProps) {
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
    </div>
  );
}
