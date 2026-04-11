import { useCallback, useEffect, useMemo, useState } from "react";
import { useWebSocket } from "./hooks/useWebSocket";
import { filterMessages, useSession } from "./hooks/useSession";
import { SessionSidebar } from "./components/SessionSidebar";
import { MessageStream } from "./components/MessageStream";
import { MessageInput } from "./components/MessageInput";
import { StatusBar } from "./components/StatusBar";
import { InteractiveUI } from "./components/InteractiveUI";
import { DecisionGrid } from "./components/DecisionGrid";
import { FilterBar } from "./components/FilterBar";
import { FileUpload } from "./components/FileUpload";
import { DirectoryPicker } from "./components/DirectoryPicker";
import { WikiSidebar } from "./components/WikiSidebar";
import { WikiPage } from "./components/WikiPage";
import {
  BUILTIN_COMMANDS,
  type CommandItem,
} from "./components/CommandPalette";
import type { ClientSendKey, ClientSubmitDecisions } from "./protocol";

function App() {
  const {
    sessions,
    activeWindowId,
    messages,
    statusText,
    health,
    interactiveUI,
    decisionGrid,
    filter,
    setFilter,
    handleServerMessage,
    setActiveWindowId,
    clearDecisionGrid,
    clearSessionState,
  } = useSession();

  const { status, send } = useWebSocket(handleServerMessage);

  const [showDirectoryPicker, setShowDirectoryPicker] = useState(false);
  const [wikiPath, setWikiPath] = useState<string | null>(null);

  // Fetch project skills when active session changes
  const [projectCommands, setProjectCommands] = useState<CommandItem[]>([]);
  useEffect(() => {
    if (!activeWindowId) {
      setProjectCommands([]);
      return;
    }
    const controller = new AbortController();
    fetch(`/api/sessions/${encodeURIComponent(activeWindowId)}/skills`, {
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((skills: Array<{ name: string; description: string }>) => {
        setProjectCommands(
          skills.map((s) => ({
            name: s.name,
            description: s.description,
            group: "project" as const,
          })),
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) setProjectCommands([]);
      });
    return () => controller.abort();
  }, [activeWindowId]);

  const allCommands = useMemo(
    () => [...projectCommands, ...BUILTIN_COMMANDS],
    [projectCommands],
  );

  const handleSelectSession = useCallback(
    (windowId: string) => {
      clearSessionState();
      setActiveWindowId(windowId);
      send({ type: "switch_session", window_id: windowId });
    },
    [send, setActiveWindowId, clearSessionState],
  );

  const handleCreateSession = useCallback(
    (workDir: string, name?: string) => {
      send({ type: "create_session", work_dir: workDir, name });
      setShowDirectoryPicker(false);
    },
    [send],
  );

  const handleKillSession = useCallback(
    (windowId: string) => {
      send({ type: "kill_session", window_id: windowId });
      if (activeWindowId === windowId) {
        setActiveWindowId(null);
      }
    },
    [send, activeWindowId, setActiveWindowId],
  );

  const handleSendText = useCallback(
    (text: string) => {
      if (!activeWindowId) return;
      send({ type: "send_text", window_id: activeWindowId, text });
    },
    [send, activeWindowId],
  );

  const handleSendKey = useCallback(
    (key: ClientSendKey["key"]) => {
      if (!activeWindowId) return;
      send({ type: "send_key", window_id: activeWindowId, key });
    },
    [send, activeWindowId],
  );

  const handleEscape = useCallback(() => {
    if (!activeWindowId) return;
    send({ type: "send_key", window_id: activeWindowId, key: "Escape" });
  }, [send, activeWindowId]);

  const handleSubmitDecisions = useCallback(
    (submission: ClientSubmitDecisions) => {
      send(submission);
      clearDecisionGrid();
    },
    [send, clearDecisionGrid],
  );

  const handleScreenshot = useCallback(async () => {
    if (!activeWindowId) return;
    try {
      const resp = await fetch(
        `/api/sessions/${encodeURIComponent(activeWindowId)}/screenshot`,
      );
      const text = await resp.text();
      // Open in new window as pre-formatted text
      const w = window.open("", "_blank");
      if (w) {
        w.document.write(
          `<pre style="background:#1e1e2e;color:#cdd6f4;padding:20px;font-family:monospace">${text.replace(/</g, "&lt;")}</pre>`,
        );
      }
    } catch {
      console.error("Screenshot failed");
    }
  }, [activeWindowId]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+K: toggle command palette (handled by MessageInput focus)
      // Ctrl+N: new session
      if (e.key === "n" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setShowDirectoryPicker(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const filteredMessages = filterMessages(messages, filter);

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
      }}
    >
      {/* Sidebar — wiki or sessions */}
      {wikiPath !== null ? (
        <WikiSidebar
          activePath={wikiPath}
          onNavigate={setWikiPath}
          onClose={() => setWikiPath(null)}
        />
      ) : (
        <SessionSidebar
          sessions={sessions}
          activeWindowId={activeWindowId}
          health={health}
          onSelectSession={handleSelectSession}
          onCreateSession={() => setShowDirectoryPicker(true)}
          onKillSession={handleKillSession}
          onOpenWiki={() => setWikiPath("index.md")}
        />
      )}

      {/* Main content — wiki or session */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
        }}
      >
        {wikiPath !== null ? (
          <WikiPage path={wikiPath} onNavigate={setWikiPath} />
        ) : activeWindowId ? (
          <>
            <FilterBar filter={filter} onFilterChange={setFilter} />
            <MessageStream messages={filteredMessages} />
            {interactiveUI && (
              <InteractiveUI ui={interactiveUI} onSendKey={handleSendKey} />
            )}
            <MessageInput
              onSend={handleSendText}
              onEscape={handleEscape}
              onScreenshot={handleScreenshot}
              commands={allCommands}
              disabled={status !== "connected"}
            >
              <FileUpload
                windowId={activeWindowId}
                disabled={status !== "connected"}
              />
            </MessageInput>
            <StatusBar statusText={statusText} connectionStatus={status} />
          </>
        ) : (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-muted)",
              fontSize: 16,
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ fontSize: 28 }}>CCWeb</div>
            <div>Select a session or create a new one</div>
          </div>
        )}
      </div>

      {/* Overlays */}
      {decisionGrid && (
        <DecisionGrid
          key={decisionGrid.grid.id}
          grid={decisionGrid}
          onSubmit={handleSubmitDecisions}
          onDismiss={clearDecisionGrid}
        />
      )}
      {showDirectoryPicker && (
        <DirectoryPicker
          onSelect={handleCreateSession}
          onCancel={() => setShowDirectoryPicker(false)}
        />
      )}
    </div>
  );
}

export default App;
