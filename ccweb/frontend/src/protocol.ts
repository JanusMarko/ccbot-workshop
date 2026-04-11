/** WebSocket protocol types — mirrors ws_protocol.py */

// ── Server → Client ─────────────────────────────────────────────────────

export interface WsMessage {
  type: "message";
  window_id: string;
  role: "user" | "assistant";
  content_type: "text" | "thinking" | "tool_use" | "tool_result" | "local_command";
  text: string;
  tool_use_id: string | null;
  tool_name: string | null;
  timestamp: string | null;
}

export interface WsInteractiveUI {
  type: "interactive_ui";
  window_id: string;
  ui_name: string;
  raw_content: string;
  structured: {
    ui_name: string;
    options: Array<{ label: string; checked: boolean; index: number }>;
    description: string;
    command: string;
  } | null;
}

export interface WsDecisionGrid {
  type: "decision_grid";
  window_id: string;
  grid: {
    id: string;
    type: string;
    title: string;
    items: Array<{
      topic: string;
      description: string;
      allow_custom: boolean;
      options: Array<{ label: string; recommended: boolean }>;
    }>;
  };
}

export interface WsStatus {
  type: "status";
  window_id: string;
  text: string;
}

export interface WsSessions {
  type: "sessions";
  sessions: SessionInfo[];
}

export interface WsHealth {
  type: "health";
  tmux_running: boolean;
  hook_installed: boolean;
  sessions_found: number;
  warnings: string[];
}

export interface WsError {
  type: "error";
  code: string;
  message: string;
}

export interface WsPong {
  type: "pong";
}

export interface WsHistory {
  type: "history";
  window_id: string;
  messages: HistoryMessage[];
  total: number;
}

export interface WsSendAck {
  type: "send_ack";
  window_id: string;
}

export type ServerMessage =
  | WsMessage
  | WsInteractiveUI
  | WsDecisionGrid
  | WsStatus
  | WsSessions
  | WsHealth
  | WsError
  | WsPong
  | WsHistory
  | WsSendAck;

// ── Client → Server ─────────────────────────────────────────────────────

export interface ClientSendText {
  type: "send_text";
  window_id: string;
  text: string;
}

export interface ClientSendKey {
  type: "send_key";
  window_id: string;
  key: "Enter" | "Escape" | "Space" | "Tab" | "Up" | "Down" | "Left" | "Right";
}

export interface ClientSubmitDecisions {
  type: "submit_decisions";
  window_id: string;
  title: string;
  selections: Array<{
    topic: string;
    choice: string | null;
    notes: string;
  }>;
}

export interface ClientCreateSession {
  type: "create_session";
  work_dir: string;
  name?: string;
}

export interface ClientKillSession {
  type: "kill_session";
  window_id: string;
}

export interface ClientSwitchSession {
  type: "switch_session";
  window_id: string;
}

export interface ClientGetHistory {
  type: "get_history";
  window_id: string;
}

export interface ClientPing {
  type: "ping";
}

export type ClientMessage =
  | ClientSendText
  | ClientSendKey
  | ClientSubmitDecisions
  | ClientCreateSession
  | ClientKillSession
  | ClientSwitchSession
  | ClientGetHistory
  | ClientPing;

// ── Shared types ────────────────────────────────────────────────────────

export interface SessionInfo {
  window_id: string;
  name: string;
  cwd: string;
  command: string;
}

export interface HistoryMessage {
  role: "user" | "assistant";
  text: string;
  content_type: string;
  timestamp: string | null;
}
