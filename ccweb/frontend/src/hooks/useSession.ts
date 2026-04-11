import { useCallback, useState } from "react";
import type {
  HistoryMessage,
  ServerMessage,
  SessionInfo,
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
}

interface UseSessionReturn {
  sessions: SessionInfo[];
  activeWindowId: string | null;
  messages: DisplayMessage[];
  statusText: string;
  health: WsHealth | null;
  interactiveUI: WsInteractiveUI | null;
  filter: MessageFilter;
  setFilter: (f: MessageFilter) => void;
  handleServerMessage: (msg: ServerMessage) => void;
  setActiveWindowId: (id: string | null) => void;
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
  const [filter, setFilter] = useState<MessageFilter>("all");

  const handleServerMessage = useCallback(
    (msg: ServerMessage) => {
      switch (msg.type) {
        case "health":
          setHealth(msg);
          break;

        case "sessions":
          setSessions(msg.sessions);
          break;

        case "history":
          setMessages(msg.messages.map(historyToDisplay));
          setInteractiveUI(null);
          break;

        case "message":
          if (activeWindowId && msg.window_id === activeWindowId) {
            setMessages((prev) => [...prev, wsMessageToDisplay(msg)]);
            // Any non-interactive message clears the interactive UI
            setInteractiveUI(null);
          }
          break;

        case "status":
          if (activeWindowId && msg.window_id === activeWindowId) {
            setStatusText(msg.text);
          }
          break;

        case "interactive_ui":
          if (activeWindowId && msg.window_id === activeWindowId) {
            setInteractiveUI(msg);
            setStatusText("");
          }
          break;

        case "send_ack":
          // Could show a delivery confirmation — for now just clear status
          break;

        case "error":
          console.error(`[CCWeb Error] ${msg.code}: ${msg.message}`);
          break;

        case "pong":
          // Keepalive response — no action needed
          break;
      }
    },
    [activeWindowId],
  );

  return {
    sessions,
    activeWindowId,
    messages,
    statusText,
    health,
    interactiveUI,
    filter,
    setFilter,
    handleServerMessage,
    setActiveWindowId,
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
