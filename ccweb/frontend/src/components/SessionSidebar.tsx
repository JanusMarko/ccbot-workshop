import { useState } from "react";
import type { SessionInfo } from "../protocol";
import type { WsHealth } from "../protocol";

interface SessionSidebarProps {
  sessions: SessionInfo[];
  activeWindowId: string | null;
  health: WsHealth | null;
  onSelectSession: (windowId: string) => void;
  onCreateSession: (workDir: string, name?: string) => void;
  onKillSession: (windowId: string) => void;
}

function HealthBanner({ health }: { health: WsHealth }) {
  if (health.warnings.length === 0) return null;

  return (
    <div style={{ padding: "8px", fontSize: 12 }}>
      {health.warnings.map((w, i) => (
        <div
          key={i}
          style={{
            padding: "6px 8px",
            marginBottom: 4,
            borderRadius: 4,
            background: w.includes("not running")
              ? "rgba(243,139,168,0.15)"
              : "rgba(249,226,175,0.15)",
            color: w.includes("not running")
              ? "var(--error)"
              : "var(--warning)",
          }}
        >
          {w}
        </div>
      ))}
    </div>
  );
}

export function SessionSidebar({
  sessions,
  activeWindowId,
  health,
  onSelectSession,
  onCreateSession,
  onKillSession,
}: SessionSidebarProps) {
  const [showNewSession, setShowNewSession] = useState(false);
  const [newPath, setNewPath] = useState("");

  const handleCreate = () => {
    if (!newPath.trim()) return;
    const parts = newPath.trim().split("/");
    const name = parts[parts.length - 1];
    onCreateSession(newPath.trim(), name);
    setNewPath("");
    setShowNewSession(false);
  };

  return (
    <div
      style={{
        width: 260,
        minWidth: 260,
        background: "var(--bg-secondary)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 15 }}>CCWeb</span>
        <button
          onClick={() => setShowNewSession(!showNewSession)}
          style={{
            background: "var(--accent)",
            color: "#1e1e2e",
            border: "none",
            borderRadius: 4,
            padding: "4px 10px",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          + New
        </button>
      </div>

      {/* Health warnings */}
      {health && <HealthBanner health={health} />}

      {/* New session form */}
      {showNewSession && (
        <div
          style={{
            padding: "8px 12px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <input
            type="text"
            value={newPath}
            onChange={(e) => setNewPath(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="/path/to/project"
            autoFocus
            style={{
              width: "100%",
              padding: "6px 8px",
              background: "var(--bg-primary)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              fontSize: 13,
              fontFamily: "inherit",
              outline: "none",
              marginBottom: 6,
            }}
          />
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={handleCreate}
              disabled={!newPath.trim()}
              style={{
                flex: 1,
                padding: "4px 8px",
                background: newPath.trim()
                  ? "var(--accent)"
                  : "var(--bg-surface)",
                color: newPath.trim() ? "#1e1e2e" : "var(--text-muted)",
                border: "none",
                borderRadius: 4,
                cursor: newPath.trim() ? "pointer" : "default",
                fontSize: 12,
              }}
            >
              Create
            </button>
            <button
              onClick={() => {
                setShowNewSession(false);
                setNewPath("");
              }}
              style={{
                padding: "4px 8px",
                background: "var(--bg-surface)",
                color: "var(--text-secondary)",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Session list */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {sessions.length === 0 ? (
          <div
            style={{
              padding: "20px 12px",
              color: "var(--text-muted)",
              fontSize: 13,
              textAlign: "center",
            }}
          >
            No sessions yet.
            <br />
            Click + New to start.
          </div>
        ) : (
          sessions.map((s) => (
            <div
              key={s.window_id}
              onClick={() => onSelectSession(s.window_id)}
              style={{
                padding: "10px 12px",
                cursor: "pointer",
                background:
                  s.window_id === activeWindowId
                    ? "var(--bg-surface)"
                    : "transparent",
                borderLeft:
                  s.window_id === activeWindowId
                    ? "3px solid var(--accent)"
                    : "3px solid transparent",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 13,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.name}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.cwd}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Kill session "${s.name}"?`)) {
                    onKillSession(s.window_id);
                  }
                }}
                title="Kill session"
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  fontSize: 14,
                  padding: "2px 4px",
                  flexShrink: 0,
                }}
              >
                x
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
