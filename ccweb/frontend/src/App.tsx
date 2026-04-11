import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useResponsive } from "./hooks/useResponsive";

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
  const { isTablet } = useResponsive();

  const [showDirectoryPicker, setShowDirectoryPicker] = useState(false);
  const [wikiPath, setWikiPath] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
      setSidebarOpen(false); // Close drawer on tablet after selection
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

  // Ctrl+K toggle counter — changes trigger the palette toggle in MessageInput
  const [paletteToggle, setPaletteToggle] = useState<boolean | undefined>(
    undefined,
  );

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "n" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setShowDirectoryPicker(true);
      }
      if (e.key === "k" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setPaletteToggle((prev) => (prev === undefined ? true : !prev));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Swipe gestures for sidebar drawer on tablet
  const touchStartX = useRef(0);
  useEffect(() => {
    if (!isTablet) return;
    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
    };
    const handleTouchEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      if (dx > 80 && touchStartX.current < 40) {
        // Swipe right from left edge → open
        setSidebarOpen(true);
      } else if (dx < -80) {
        // Swipe left → close
        setSidebarOpen(false);
      }
    };
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isTablet]);

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
      {/* Sidebar — responsive drawer on tablet, fixed on desktop */}
      {isTablet && !showDirectoryPicker && !decisionGrid && (
        <>
          {/* Hamburger button */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              position: "fixed",
              top: 8,
              left: 8,
              zIndex: 200,
              width: 44,
              height: 44,
              background: "var(--bg-surface)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {sidebarOpen ? "\u2715" : "\u2630"}
          </button>
          {/* Backdrop */}
          {sidebarOpen && (
            <div
              onClick={() => setSidebarOpen(false)}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.5)",
                zIndex: 99,
              }}
            />
          )}
        </>
      )}
      <div
        style={{
          position: isTablet ? "fixed" : "relative",
          left: isTablet ? (sidebarOpen ? 0 : -300) : 0,
          top: 0,
          height: "100%",
          zIndex: isTablet ? 100 : "auto",
          transition: isTablet ? "left 0.2s ease" : "none",
          flexShrink: 0,
        }}
      >
        {wikiPath !== null ? (
          <WikiSidebar
            activePath={wikiPath}
            onNavigate={(p) => {
              setWikiPath(p);
              setSidebarOpen(false);
            }}
            onClose={() => {
              setWikiPath(null);
              setSidebarOpen(false);
            }}
          />
        ) : (
          <SessionSidebar
            sessions={sessions}
            activeWindowId={activeWindowId}
            health={health}
            onSelectSession={handleSelectSession}
            onCreateSession={() => {
              setShowDirectoryPicker(true);
              setSidebarOpen(false);
            }}
            onKillSession={handleKillSession}
            onOpenWiki={() => {
              setWikiPath("index.md");
              setSidebarOpen(false);
            }}
          />
        )}
      </div>

      {/* Main content — wiki or session */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          marginLeft: isTablet ? 0 : undefined,
          paddingTop: isTablet ? 52 : 0, // Space for hamburger button
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
              externalPaletteToggle={paletteToggle}
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
