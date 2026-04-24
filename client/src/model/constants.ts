export const P         = 32;          // Pixel pro Tile
export const WALK      = 4.8;         // Tile/Sekunde
export const SPRINT    = 15.0;        // Tile/Sekunde (Shift)
export const MAP       = { w: 120, h: 100 } as const;
export const ZOOM_MAX  = 4.0;
export const ZOOM_MIN  = 0.15;        // wird durch minScale() überschrieben
export const CAM_SPEED = 5;           // Pixel/Frame für Pfeil-Kamerasteuerung
export const SEND_INTERVAL = 50;      // ms zwischen WS-Positionsupdates

// Backend-URLs – direkt zu den Microservices
export const AUTH_URL = import.meta.env.VITE_AUTH_URL ?? 'https://auth.freischule.info';

// Presence-WS: integriert im Express-Server auf office2.freischule.info
const _wsOrigin = import.meta.env.VITE_PRESENCE_WS_URL ?? (
  typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? 'wss://office2.freischule.info'
    : 'ws://localhost:3000'
);
export const WS_PATH = `${_wsOrigin}/ws`;
export const OBJECT_URL       = import.meta.env.VITE_OBJECT_URL       ?? 'https://object.freischule.info';
export const MEDIA_URL        = import.meta.env.VITE_MEDIA_URL        ?? 'https://media.freischule.info';
export const MESSAGE_URL      = import.meta.env.VITE_MESSAGE_URL      ?? 'https://message.freischule.info';
