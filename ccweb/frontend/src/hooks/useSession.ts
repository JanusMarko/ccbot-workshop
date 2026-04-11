import { useCallback, useRef, useState } from "react";
import type {
  HistoryMessage,
  ServerMessage,
  SessionInfo,
  WsDecisionGrid,
  WsHealth,
  WsInteractiveUI,
  WsMessage,
} from "../protocol";

export type MessageFilter = "all" | "chat" | "no_thinking" | "tools";

export interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  contentType: string;
  toolUseId: string | null;
  toolName: string | null;
  timestamp: string | null;
  images?: Array<{ media_type: string; data: string }>;
}

interface UseSessionReturn {
  sessions: SessionInfo[];
  activeWindowId: string | null;
  messages: DisplayMessage[];
  statusText: string;
  health: WsHealth | null;
  interactiveUI: WsInteractiveUI | null;
  decisionGrid: WsDecisionGrid | null;
  filter: MessageFilter;
  setFilter: (f: MessageFilter) => void;
  handleServerMessage: (msg: ServerMessage) => void;
  setActiveWindowId: (id: string | null) => void;
  clearDecisionGrid: () => void;
  clearSessionState: () => void;
}

let msgCounter = 0;

function historyToDisplay(msg: HistoryMessage): DisplayMessage {
  return {
    id: `hist-${msgCounter++}`,
    role: msg.role,
    text: msg.text,
    contentType: msg.content_type,
    toolUseId: null,
    toolName: null,
    timestamp: msg.timestamp,
  };
}

function wsMessageToDisplay(msg: WsMessage): DisplayMessage {
  return {
    id: `msg-${msgCounter++}`,
    role: msg.role,
    text: msg.text,
    contentType: msg.content_type,
    toolUseId: msg.tool_use_id,
    toolName: msg.tool_name,
    timestamp: msg.timestamp,
    images: msg.images,
  };
}

export function useSession(): UseSessionReturn {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [activeWindowId, setActiveWindowId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [statusText, setStatusText] = useState("");
  const [health, setHealth] = useState<WsHealth | null>(null);
  const [interactiveUI, setInteractiveUI] = useState<WsInteractiveUI | null>(
    null,
  );
  const [decisionGrid, setDecisionGrid] = useState<WsDecisionGrid | null>(
    null,
  );
  const [filter, setFilter] = useState<MessageFilter>("all");

  // Use a ref to avoid stale closures in the message handler.
  // The handler is called synchronously from the WebSocket onmessage,
  // which may fire between a setState and the next render.
  const activeWindowIdRef = useRef(activeWindowId);
  activeWindowIdRef.current = activeWindowId;

  const handleServerMessage = useCallback((msg: ServerMessage) => {
    const currentWindowId = activeWindowIdRef.current;

    switch (msg.type) {
      case "health":
        setHealth(msg);
        break;

      case "sessions":
        setSessions(msg.sessions);
        break;

      case "history":
        // Gate by window_id to prevent wrong session's history overwriting
        // the display after rapid session switching
        if (
          "window_id" in msg &&
          currentWindowId &&
          msg.window_id !== currentWindowId
        ) {
          break;
        }
        setMessages(msg.messages.map(historyToDisplay));
        setInteractiveUI(null);
        break;

      case "message":
        if (currentWindowId && msg.window_id === currentWindowId) {
          setMessages((prev) => [...prev, wsMessageToDisplay(msg)]);
          setInteractiveUI(null);
        }
        break;

      case "status":
        if (currentWindowId && msg.window_id === currentWindowId) {
          setStatusText(msg.text);
        }
        break;

      case "interactive_ui":
        if (currentWindowId && msg.window_id === currentWindowId) {
          setInteractiveUI(msg);
          setStatusText("");
        }
        break;

      case "decision_grid":
        if (currentWindowId && msg.window_id === currentWindowId) {
          setDecisionGrid(msg);
        }
        break;

      case "send_ack":
        break;

      case "error":
        console.error(`[CCWeb Error] ${msg.code}: ${msg.message}`);
        break;

      case "pong":
        break;
    }
  }, []); // No deps — uses ref for activeWindowId

  const clearDecisionGrid = useCallback(() => {
    setDecisionGrid(null);
  }, []);

  // Clear ephemeral state when switching sessions to prevent stale UI
  const clearSessionState = useCallback(() => {
    setMessages([]);
    setStatusText("");
    setInteractiveUI(null);
    setDecisionGrid(null);
  }, []);

  return {
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
  };
}

export function filterMessages(
  messages: DisplayMessage[],
  filter: MessageFilter,
): DisplayMessage[] {
  switch (filter) {
    case "all":
      return messages;
    case "chat":
      return messages.filter(
        (m) => m.contentType === "text" || m.contentType === "local_command",
      );
    case "no_thinking":
      return messages.filter((m) => m.contentType !== "thinking");
    case "tools":
      return messages.filter(
        (m) => m.contentType === "tool_use" || m.contentType === "tool_result",
      );
  }
}
