// ── Map Data ──────────────────────────────────────────────────────────────────
export interface Room {
  label: string;
  fill: string;
  pts: number[]; // flat [x1,y1, x2,y2, ...] in Tile-Einheiten
}

export type WallType = 'wall' | 'shared' | 'door';

export interface Wall {
  f: [number, number]; // from [x, y] in Tile-Einheiten
  t: [number, number]; // to   [x, y] in Tile-Einheiten
  type: WallType;
}

// ── Presence ──────────────────────────────────────────────────────────────────
export interface RemoteUser {
  user_id: string;
  name: string;
  department?: string;
  x: number;
  y: number;
}

export type RemoteUsersMap = Record<string, RemoteUser>;

// ── WebSocket-Nachrichten (eingehend vom PresenceService) ─────────────────────
export interface WsSnapshot  { type: 'snapshot';    users: RemoteUser[] }
export interface WsJoined    { type: 'user_joined'; user_id: string; name: string; department?: string; x: number; y: number }
export interface WsMoved     { type: 'user_moved';  user_id: string; x: number; y: number }
export interface WsLeft       { type: 'user_left';    user_id: string }
export interface WsNewMessage { type: 'new_message';  senderId: string }
export type WsInbound = WsSnapshot | WsJoined | WsMoved | WsLeft | WsNewMessage;

// ── WebSocket-Nachrichten (ausgehend zum PresenceService) ─────────────────────
export interface WsMsgSetName      { type: 'set_name';      name: string }
export interface WsMsgMove         { type: 'move';          x: number; y: number }
export interface WsMsgRefreshToken { type: 'refresh_token'; token: string }
export interface WsMsgNotifyUser   { type: 'notify_user';   targetUserId: string }
export type WsOutbound = WsMsgSetName | WsMsgMove | WsMsgRefreshToken | WsMsgNotifyUser;

// ── Auth ──────────────────────────────────────────────────────────────────────
export type AuthStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected_guest'
  | 'connected_auth'
  | 'session_expired';

// ── Kamera ────────────────────────────────────────────────────────────────────
export interface CameraOffset {
  x: number;
  y: number;
}
