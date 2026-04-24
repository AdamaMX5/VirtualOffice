import { useState, useCallback, useRef, useEffect } from 'react';
import { Stage } from 'react-konva';
import GroundLayer from './layers/GroundLayer';
import BuildingLayer from './layers/BuildingLayer';
import FurnitureLayer from './layers/FurnitureLayer';
import AvatarLayer from './layers/AvatarLayer';
import HUD from './hud/HUD';
import ControlsHint from './hud/ControlsHint';
import VirtualJoystick from './hud/VirtualJoystick';
import ChatInput from './hud/ChatInput';
import VideoManager from './media/VideoManager';
import VideoGrid from './media/VideoGrid';
import MediaControls from './media/MediaControls';
import ConnectionErrorModal from './media/ConnectionErrorModal';
import ProximityCallBar from './media/ProximityCallBar';
import MeetingOverlay from './meeting/MeetingOverlay';
import FurniturePanel from './furniture/FurniturePanel';
import MessagesPanel from './messages/MessagesPanel';
import { usePresence } from '../hooks/usePresence';
import { useGameLoop } from '../hooks/useGameLoop';
import { useCamera } from '../hooks/useCamera';
import { useTokenRefresh } from '../hooks/useTokenRefresh';
import { useMeetingRoom } from '../hooks/useMeetingRoom';
import { useProximityCall } from '../hooks/useProximityCall';
import { useCameraStore } from '../model/stores/cameraStore';
import { usePlayerStore } from '../model/stores/playerStore';
import { useFurnitureStore } from '../model/stores/furnitureStore';
import { useMessageStore } from '../model/stores/messageStore';
import { useMessaging } from '../hooks/useMessaging';
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

  // Polling + Echtzeit-Notifications (läuft dauerhaft)
  useMessaging();

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
      cursor: furnitureModeActive && pendingCatalogItem ? 'crosshair' : 'default',
    }}>
      {/* Furniture-Mode-Overlay: leichter blauer Rahmen */}
      {furnitureModeActive && (
        <div style={{
          position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 50,
          boxShadow: 'inset 0 0 0 3px rgba(99,179,237,0.4)',
          borderRadius: 0,
        }} />
      )}

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
        <AvatarLayer    {...layerProps} updateFromDrag={updateFromDrag} paused={showMeeting} />
      </Stage>

      {/* HTML-Overlays */}
      <HUD
        onOpenMeeting={() => setShowMeeting(true)}
        onToggleFurniture={toggleFurnitureMode}
        furnitureModeActive={furnitureModeActive}
        onToggleMessages={toggleMessagesPanel}
        messagesPanelOpen={messagesPanelOpen}
      />
      <ControlsHint />
      <ChatInput />
      <VideoManager />
      <VideoGrid />
      <MediaControls />
      {showMeeting && <MeetingOverlay onClose={() => setShowMeeting(false)} />}
      <ProximityCallBar />
      <ConnectionErrorModal />
      <VirtualJoystick />
      {furnitureModeActive && <FurniturePanel onClose={toggleFurnitureMode} />}
      {messagesPanelOpen  && <MessagesPanel  onClose={closeMessagesPanel} />}
    </div>
  );
};

export default OfficeCanvas;
