import { useCallback } from "react";
import { useWebSocket } from "./hooks/useWebSocket";
import { filterMessages, useSession } from "./hooks/useSession";
import { SessionSidebar } from "./components/SessionSidebar";
import { MessageStream } from "./components/MessageStream";
import { MessageInput } from "./components/MessageInput";
import { StatusBar } from "./components/StatusBar";
import { InteractiveUI } from "./components/InteractiveUI";
import { DecisionGrid } from "./components/DecisionGrid";
import { FilterBar } from "./components/FilterBar";
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
  } = useSession();

  const { status, send } = useWebSocket(handleServerMessage);

  const handleSelectSession = useCallback(
    (windowId: string) => {
      setActiveWindowId(windowId);
      send({ type: "switch_session", window_id: windowId });
    },
    [send, setActiveWindowId],
  );

  const handleCreateSession = useCallback(
    (workDir: string, name?: string) => {
      send({ type: "create_session", work_dir: workDir, name });
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
      {/* Sidebar */}
      <SessionSidebar
        sessions={sessions}
        activeWindowId={activeWindowId}
        health={health}
        onSelectSession={handleSelectSession}
        onCreateSession={handleCreateSession}
        onKillSession={handleKillSession}
      />

      {/* Main content */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
        }}
      >
        {activeWindowId ? (
          <>
            <FilterBar filter={filter} onFilterChange={setFilter} />
            <MessageStream messages={filteredMessages} />
            {interactiveUI && (
              <InteractiveUI ui={interactiveUI} onSendKey={handleSendKey} />
            )}
            <MessageInput
              onSend={handleSendText}
              onEscape={handleEscape}
              disabled={status !== "connected"}
            />
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

      {/* Decision grid overlay */}
      {decisionGrid && (
        <DecisionGrid
          grid={decisionGrid}
          onSubmit={handleSubmitDecisions}
          onDismiss={clearDecisionGrid}
        />
      )}
    </div>
  );
}

export default App;
