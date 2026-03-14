export const P         = 32;          // Pixel pro Tile
export const WALK      = 4.8;         // Tile/Sekunde
export const SPRINT    = 15.0;        // Tile/Sekunde (Shift)
export const MAP       = { w: 120, h: 100 } as const;
export const ZOOM_MAX  = 4.0;
export const ZOOM_MIN  = 0.15;        // wird durch minScale() überschrieben
export const CAM_SPEED = 5;           // Pixel/Frame für Pfeil-Kamerasteuerung
export const SEND_INTERVAL = 50;      // ms zwischen WS-Positionsupdates

// Backend-URLs – in Produktion vom Vite-Proxy durch den Node-Server weitergeleitet
export const WS_PATH   = '/ws';       // Vite-Proxy → ws://localhost:3000/ws → PresenceService
export const GQL_PATH  = '/graphql';  // Vite-Proxy → http://localhost:3000/graphql
