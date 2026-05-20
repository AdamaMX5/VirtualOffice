import { useState, useCallback, useRef, useEffect } from 'react';
import { Stage } from 'react-konva';
import GroundLayer from './layers/GroundLayer';
import BuildingLayer from './layers/BuildingLayer';
import FurnitureLayer from './layers/FurnitureLayer';
import AvatarLayer from './layers/AvatarLayer';
import PixiCanvas from './PixiCanvas';
import { useEngineStore } from '../model/stores/engineStore';
import HUD from './hud/HUD';
import ControlsHint from './hud/ControlsHint';
import VirtualJoystick from './hud/VirtualJoystick';
import ChatInput from './hud/ChatInput';
import VideoManager from './media/VideoManager';
import VideoGrid from './media/VideoGrid';
import MediaControls from './media/MediaControls';
import ConnectionErrorModal from './media/ConnectionErrorModal';
import MeetingOverlay from './meeting/MeetingOverlay';
import FurniturePanel from './furniture/FurniturePanel';
import MessagesPanel from './messages/MessagesPanel';
import DesignerLayer from './layers/DesignerLayer';
import DesignerPanel from './designer/DesignerPanel';
import DesignerToolbar from './designer/DesignerToolbar';
import DesignerRoomModal from './modals/DesignerRoomModal';
import { useDesignerStore } from '../model/stores/designerStore';
import { usePresence } from '../hooks/usePresence';
import { useProfile } from '../hooks/useProfile';
import { useGameLoop } from '../hooks/useGameLoop';
import { setFollowTarget } from '../hooks/useGameLoop';
import { useFollowStore } from '../model/stores/followStore';
import { useCamera } from '../hooks/useCamera';
import { useTokenRefresh } from '../hooks/useTokenRefresh';
import { useMeetingRoom } from '../hooks/useMeetingRoom';
import { useProximityCall } from '../hooks/useProximityCall';
import { useCameraStore } from '../model/stores/cameraStore';
import { usePlayerStore } from '../model/stores/playerStore';
import { useFurnitureStore } from '../model/stores/furnitureStore';
import { useMessageStore } from '../model/stores/messageStore';
import { useMessaging } from '../hooks/useMessaging';
import { useMapLoader } from '../hooks/useMapLoader';
import { loadCatalog, loadPlacedItems, placeItem, resizeItem } from '../services/furnitureService';
import { P, ZOOM_MAX, ZOOM_MIN } from '../model/constants';

function useStageSize() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return size;
}

const OfficeCanvas = () => {
  const size = useStageSize();
  const { scale, offset } = useCameraStore();
  const [showMeeting, setShowMeeting] = useState(false);

  const currentRoom = usePlayerStore((s) => s.currentRoom);
  const { furnitureModeActive, selectedId, pendingCatalogItem,
          toggleFurnitureMode, selectItem, setPendingCatalogItem } = useFurnitureStore();
  const { panelOpen: messagesPanelOpen, togglePanel: toggleMessagesPanel,
          closePanel: closeMessagesPanel } = useMessageStore();

  const followTarget    = useFollowStore((s) => s.followTarget);
  const incomingCall    = useFollowStore((s) => s.incomingCall);
  const designerActive  = useDesignerStore((s) => s.active);
  const toggleDesigner  = useDesignerStore((s) => s.toggle);
  const engine          = useEngineStore((s) => s.engine);

  // Polling + Echtzeit-Notifications (läuft dauerhaft)
  useMessaging();
  useProfile();
  useMapLoader();

  // Möbel einmalig beim Start laden — alle Räume, kein Filter
  useEffect(() => {
    loadCatalog();
    loadPlacedItems();
  }, []);

  // ESC: Platzierungs-Modus abbrechen oder Möbel deselektieren
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (pendingCatalogItem) { setPendingCatalogItem(null); return; }
      if (selectedId)         { selectItem(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pendingCatalogItem, selectedId, setPendingCatalogItem, selectItem]);

  // ── Linke Maustaste tracken (für Scroll-Resize) ────────────────────────────
  const leftMouseRef = useRef(false);
  useEffect(() => {
    const down = (e: MouseEvent) => { if (e.button === 0) leftMouseRef.current = true;  };
    const up   = (e: MouseEvent) => { if (e.button === 0) leftMouseRef.current = false; };
    window.addEventListener('mousedown', down);
    window.addEventListener('mouseup',   up);
    return () => {
      window.removeEventListener('mousedown', down);
      window.removeEventListener('mouseup',   up);
    };
  }, []);

  // Presence-WebSocket
  const { sendMove, sendRefreshToken } = usePresence();
  useMeetingRoom();
  useProximityCall();
  useTokenRefresh({ onNewToken: sendRefreshToken });

  // Kamera (Zoom + Drag)
  const { handleWheel, startDrag, updateDrag } = useCamera(size.w, size.h);

  // Game-Loop
  const { updateFromDrag } = useGameLoop({
    sendMove,
    stageWidth:  size.w,
    stageHeight: size.h,
    paused:      showMeeting,
  });

  // ── Touch-Gesten ──────────────────────────────────────────────────────────
  const touchPanRef = useRef<{
    active: boolean;
    startOffset: { x: number; y: number };
    startClient: { x: number; y: number };
  }>({ active: false, startOffset: { x: 0, y: 0 }, startClient: { x: 0, y: 0 } });
  const pinchRef = useRef<{ prevMidX: number; prevMidY: number; prevDist: number } | null>(null);

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const t = e.touches[0];
        if ((e.target as HTMLElement).closest?.('[data-joystick]')) return;
        const cam    = useCameraStore.getState();
        const player = usePlayerStore.getState();
        const ax   = player.wx * P * cam.scale + cam.offset.x;
        const ay   = player.wy * P * cam.scale + cam.offset.y;
        const dist2 = (t.clientX - ax) ** 2 + (t.clientY - ay) ** 2;
        const hitR  = (16 * cam.scale + 14) ** 2;
        if (dist2 < hitR) return;
        cam.setFollow(false);
        touchPanRef.current = {
          active: true,
          startOffset: { ...cam.offset },
          startClient: { x: t.clientX, y: t.clientY },
        };
      } else if (e.touches.length === 2) {
        touchPanRef.current.active = false;
        const t0 = e.touches[0], t1 = e.touches[1];
        pinchRef.current = {
          prevMidX: (t0.clientX + t1.clientX) / 2,
          prevMidY: (t0.clientY + t1.clientY) / 2,
          prevDist: Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY),
        };
        useCameraStore.getState().setFollow(false);
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1 && touchPanRef.current.active) {
        const t = e.touches[0];
        const { startOffset, startClient } = touchPanRef.current;
        useCameraStore.getState().setOffset({
          x: startOffset.x + t.clientX - startClient.x,
          y: startOffset.y + t.clientY - startClient.y,
        });
      } else if (e.touches.length === 2 && pinchRef.current) {
        const t0 = e.touches[0], t1 = e.touches[1];
        const midX = (t0.clientX + t1.clientX) / 2;
        const midY = (t0.clientY + t1.clientY) / 2;
        const dist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
        const cam      = useCameraStore.getState();
        const oldScale = cam.scale;
        const newScale = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, oldScale * dist / pinchRef.current.prevDist));
        const dMidX    = midX - pinchRef.current.prevMidX;
        const dMidY    = midY - pinchRef.current.prevMidY;
        const afterPanX = cam.offset.x + dMidX;
        const afterPanY = cam.offset.y + dMidY;
        cam.setScale(newScale);
        cam.setOffset({
          x: midX - (midX - afterPanX) * newScale / oldScale,
          y: midY - (midY - afterPanY) * newScale / oldScale,
        });
        pinchRef.current = { prevMidX: midX, prevMidY: midY, prevDist: dist };
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinchRef.current = null;
      if (e.touches.length === 0) touchPanRef.current.active = false;
    };

    window.addEventListener('touchstart',  onTouchStart,  { passive: true });
    window.addEventListener('touchmove',   onTouchMove,   { passive: true });
    window.addEventListener('touchend',    onTouchEnd,    { passive: true });
    window.addEventListener('touchcancel', onTouchEnd,    { passive: true });
    return () => {
      window.removeEventListener('touchstart',  onTouchStart);
      window.removeEventListener('touchmove',   onTouchMove);
      window.removeEventListener('touchend',    onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
  }, []);

  // ── PixiJS-Modus: Camera-Events via DOM (Konva-Stage nicht aktiv) ────────
  useEffect(() => {
    if (engine !== 'pixi') return;
    const pixiDrag = { active: false, startOffset: { x: 0, y: 0 }, startClient: { x: 0, y: 0 } };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      handleWheel(e, e.clientX, e.clientY);
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 2) return;
      e.preventDefault();
      const { startOffset, startClient } = startDrag(e.clientX, e.clientY);
      pixiDrag.active = true;
      pixiDrag.startOffset = startOffset;
      pixiDrag.startClient = startClient;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!pixiDrag.active) return;
      updateDrag(e.clientX, e.clientY, pixiDrag.startOffset, pixiDrag.startClient);
    };
    const onMouseUp = (e: MouseEvent) => { if (e.button === 2) pixiDrag.active = false; };
    const onCtxMenu = (e: Event) => e.preventDefault();

    window.addEventListener('wheel',       onWheel,     { passive: false });
    window.addEventListener('mousedown',   onMouseDown);
    window.addEventListener('mousemove',   onMouseMove);
    window.addEventListener('mouseup',     onMouseUp);
    window.addEventListener('contextmenu', onCtxMenu);
    return () => {
      window.removeEventListener('wheel',       onWheel);
      window.removeEventListener('mousedown',   onMouseDown);
      window.removeEventListener('mousemove',   onMouseMove);
      window.removeEventListener('mouseup',     onMouseUp);
      window.removeEventListener('contextmenu', onCtxMenu);
    };
  }, [engine, handleWheel, startDrag, updateDrag]);

  // ── Rechtsklick-Drag ──────────────────────────────────────────────────────
  const dragStateRef = useRef<{
    active: boolean;
    startOffset: { x: number; y: number };
    startClient: { x: number; y: number };
  }>({ active: false, startOffset: { x: 0, y: 0 }, startClient: { x: 0, y: 0 } });

  const handleMouseDown = useCallback((e: { evt: MouseEvent }) => {
    if (e.evt.button !== 2) return;
    e.evt.preventDefault();
    const { startOffset, startClient } = startDrag(e.evt.clientX, e.evt.clientY);
    dragStateRef.current = { active: true, startOffset, startClient };
  }, [startDrag]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragStateRef.current.active) return;
      updateDrag(e.clientX, e.clientY, dragStateRef.current.startOffset, dragStateRef.current.startClient);
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 2) dragStateRef.current.active = false;
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup',   onMouseUp);
    };
  }, [updateDrag]);

  // ── Scroll: Möbel-Resize ODER Kamera-Zoom ────────────────────────────────
  const handleWheel2 = useCallback((e: { evt: WheelEvent }) => {
    const { furnitureModeActive: fma, selectedId: sid } = useFurnitureStore.getState();

    if (fma && sid && leftMouseRef.current) {
      // Resize des ausgewählten Möbelstücks
      e.evt.preventDefault();
      const factor = e.evt.deltaY < 0 ? 1.08 : 0.93;
      const items  = useFurnitureStore.getState().placedItems;
      const item   = items.find((i) => i.id === sid);
      if (item) {
        const newW = Math.max(0.5, item.width  * factor);
        const newH = Math.max(0.5, item.height * factor);
        resizeItem(sid, newW, newH);
      }
      return;
    }

    handleWheel(e.evt, e.evt.clientX, e.evt.clientY);
  }, [handleWheel]);

  // ── Stage-Klick: Möbel platzieren oder deselektieren ──────────────────────
  const handleStageClick = useCallback((e: { evt: MouseEvent; target: unknown; currentTarget: unknown }) => {
    if (e.evt.button !== 0) return;
    if (useDesignerStore.getState().active) return; // Designer-Layer behandelt Klicks selbst
    if (!useFurnitureStore.getState().furnitureModeActive) return;

    const pending = useFurnitureStore.getState().pendingCatalogItem;
    if (pending) {
      const cam  = useCameraStore.getState();
      const tileX = (e.evt.clientX - cam.offset.x) / (cam.scale * P);
      const tileY = (e.evt.clientY - cam.offset.y) / (cam.scale * P);
      placeItem(pending, tileX, tileY, usePlayerStore.getState().currentRoom ?? undefined);
      useFurnitureStore.getState().setPendingCatalogItem(null);
    } else if (e.target === e.currentTarget) {
      useFurnitureStore.getState().selectItem(null);
    }
  }, []);

  const layerProps = { x: offset.x, y: offset.y, scaleX: scale, scaleY: scale };

  return (
    <div style={{
      width: '100vw', height: '100vh', position: 'relative', touchAction: 'none',
      cursor: designerActive ? 'crosshair' : furnitureModeActive && pendingCatalogItem ? 'crosshair' : 'default',
    }}>
      {/* Furniture-Mode-Overlay: leichter blauer Rahmen */}
      {furnitureModeActive && (
        <div style={{
          position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 50,
          boxShadow: 'inset 0 0 0 3px rgba(99,179,237,0.4)',
        }} />
      )}
      {/* Designer-Mode-Overlay: orange Rahmen */}
      {designerActive && (
        <div style={{
          position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 50,
          boxShadow: 'inset 0 0 0 3px rgba(245,158,11,0.5)',
        }} />
      )}

      {engine === 'pixi' ? (
        <PixiCanvas />
      ) : (
        <Stage
          width={size.w}
          height={size.h}
          onWheel={handleWheel2}
          onMousedown={handleMouseDown}
          onClick={handleStageClick}
          onContextmenu={(e: { evt: MouseEvent }) => e.evt.preventDefault()}
          style={{ position: 'absolute', top: 0, left: 0, visibility: showMeeting ? 'hidden' : 'visible' }}
        >
          <GroundLayer    {...layerProps} />
          <BuildingLayer  {...layerProps} />
          <FurnitureLayer {...layerProps} />
          <DesignerLayer  {...layerProps} />
          <AvatarLayer    {...layerProps} updateFromDrag={updateFromDrag} paused={showMeeting} />
        </Stage>
      )}

      {/* HTML-Overlays */}
      <HUD
        onOpenMeeting={() => setShowMeeting(true)}
        onToggleFurniture={engine === 'pixi' ? undefined : toggleFurnitureMode}
        furnitureModeActive={furnitureModeActive}
        onToggleMessages={toggleMessagesPanel}
        messagesPanelOpen={messagesPanelOpen}
        onToggleDesigner={engine === 'pixi' ? undefined : toggleDesigner}
        designerActive={designerActive}
        pixiMode={engine === 'pixi'}
      />
      <ControlsHint />
      <ChatInput />
      <VideoManager />
      <VideoGrid />
      <MediaControls />
      {showMeeting && <MeetingOverlay onClose={() => setShowMeeting(false)} />}
      <ConnectionErrorModal />
      <VirtualJoystick />
      {furnitureModeActive && <FurniturePanel onClose={toggleFurnitureMode} />}
      {messagesPanelOpen  && <MessagesPanel  onClose={closeMessagesPanel} />}
      {designerActive     && <DesignerPanel   onClose={toggleDesigner} />}
      {designerActive     && <DesignerToolbar />}
      <DesignerRoomModal />

      {/* Follow-Indikator */}
      {followTarget && (
        <div style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(15,23,42,0.92)', border: '1px solid rgba(99,179,237,0.3)',
          borderRadius: 24, padding: '8px 18px',
          color: '#93c5fd', fontSize: 13, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 10, zIndex: 1500,
          backdropFilter: 'blur(6px)',
        }}>
          🏃 Folge <strong style={{ color: '#e2e8f0' }}>{followTarget.name}</strong>
          <button
            onClick={() => setFollowTarget(null)}
            style={{
              background: 'rgba(99,179,237,0.15)', border: '1px solid rgba(99,179,237,0.3)',
              borderRadius: 12, padding: '2px 10px', color: '#93c5fd',
              cursor: 'pointer', fontSize: 12, fontWeight: 600,
            }}
          >
            Stop
          </button>
        </div>
      )}

      {/* Eingehender Anruf */}
      {incomingCall && (
        <div style={{
          position: 'fixed', top: 24, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(34,197,94,0.4)',
          borderRadius: 16, padding: '14px 24px',
          color: '#e2e8f0', fontSize: 14, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 12, zIndex: 2500,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(8px)',
        }}>
          <span style={{ fontSize: 22 }}>📞</span>
          <span><strong style={{ color: '#86efac' }}>{incomingCall.fromName}</strong> ruft an</span>
          <button
            onClick={() => useFollowStore.getState().setIncomingCall(null)}
            style={{
              background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)',
              borderRadius: 10, padding: '4px 12px', color: '#fca5a5',
              cursor: 'pointer', fontSize: 13, fontWeight: 600,
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};

export default OfficeCanvas;
