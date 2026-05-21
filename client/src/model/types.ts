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
  title?: string;
  x: number;
  y: number;
}

export type RemoteUsersMap = Record<string, RemoteUser>;

// ── WebSocket-Nachrichten (eingehend vom PresenceService) ─────────────────────
export interface WsSnapshot  { type: 'snapshot';    users: RemoteUser[] }
export interface WsJoined    { type: 'user_joined'; user_id: string; name: string; department?: string; title?: string; x: number; y: number }
export interface WsMoved     { type: 'user_moved';  user_id: string; x: number; y: number }
export interface WsLeft       { type: 'user_left';    user_id: string }
export interface WsNewMessage      { type: 'new_message';     senderId: string }
export interface WsNotifyUser     { type: 'notify_user';     targetUserId: string; senderId: string; callType?: 'call' | 'appointment' | 'guest_joined'; guestName?: string }
export interface WsChatMessage     { type: 'chat';            userId: string; text: string }
export interface WsProximityCall   { type: 'proximity_call';   fromUserId: string; fromName: string; roomName: string; userCount: number; prio: number }
export interface WsProximityEnded  { type: 'proximity_ended';  roomName: string }
export interface WsProximitySwitch { type: 'proximity_switch'; oldRoomName: string; newRoomName: string }
export interface WsMeetingBg       { type: 'meeting_bg';       backgroundUrl: string | null }
export interface WsRoomLockUpdate   { type: 'room_lock_update';   room: string; locked: boolean; lockerId?: string }
export interface WsRoomKnockRequest { type: 'room_knock_request'; room: string; userId: string; name: string }
export interface WsRoomAdmitted     { type: 'room_admitted';      room: string }
export type WsInbound = WsSnapshot | WsJoined | WsMoved | WsLeft | WsNewMessage | WsNotifyUser | WsChatMessage | WsProximityCall | WsProximityEnded | WsProximitySwitch | WsMeetingBg | WsRoomLockUpdate | WsRoomKnockRequest | WsRoomAdmitted;

// ── WebSocket-Nachrichten (ausgehend zum PresenceService) ─────────────────────
export interface WsMsgSetName        { type: 'set_name';        name: string; department?: string; title?: string }
export interface WsMsgMove           { type: 'move';            x: number; y: number }
export interface WsMsgRefreshToken   { type: 'refresh_token';   token: string }
export interface WsMsgNotifyUser     { type: 'notify_user';     targetUserId: string; callType?: 'call' | 'appointment' | 'guest_joined' }
export interface WsMsgChat           { type: 'chat';            text: string }
export interface WsMsgProximityEnter { type: 'proximity_enter'; roomName: string; userCount: number; prio: number }
export interface WsMsgProximityExit  { type: 'proximity_exit';  roomName: string }
export interface WsMsgProximitySwitch { type: 'proximity_switch'; oldRoomName: string; newRoomName: string }
export interface WsMsgMeetingBg      { type: 'meeting_bg';      backgroundUrl: string | null }
export interface WsMsgRoomLock  { type: 'room_lock';  room: string; locked: boolean }
export interface WsMsgRoomKnock { type: 'room_knock'; room: string }
export interface WsMsgRoomAdmit { type: 'room_admit'; room: string; userId: string }
export type WsOutbound = WsMsgSetName | WsMsgMove | WsMsgRefreshToken | WsMsgNotifyUser | WsMsgChat | WsMsgProximityEnter | WsMsgProximityExit | WsMsgProximitySwitch | WsMsgMeetingBg | WsMsgRoomLock | WsMsgRoomKnock | WsMsgRoomAdmit;

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
