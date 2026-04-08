import { useState, useCallback, useRef, useEffect } from 'react';
import { Stage } from 'react-konva';
import GroundLayer from './layers/GroundLayer';
import BuildingLayer from './layers/BuildingLayer';
import AvatarLayer from './layers/AvatarLayer';
import HUD from './hud/HUD';
import ControlsHint from './hud/ControlsHint';
import VirtualJoystick from './hud/VirtualJoystick';
import VideoManager from './media/VideoManager';
import VideoGrid from './media/VideoGrid';
import MediaControls from './media/MediaControls';
import ConnectionErrorModal from './media/ConnectionErrorModal';
import MeetingOverlay from './meeting/MeetingOverlay';
import { usePresence } from '../hooks/usePresence';
import { useGameLoop } from '../hooks/useGameLoop';
import { useCamera } from '../hooks/useCamera';
import { useTokenRefresh } from '../hooks/useTokenRefresh';
import { useMeetingRoom } from '../hooks/useMeetingRoom';
import { useCameraStore } from '../model/stores/cameraStore';
import { usePlayerStore } from '../model/stores/playerStore';
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

  // Presence-WebSocket
  const { sendMove, sendRefreshToken } = usePresence();

  // Auto-Connect zum Meeting-Raum beim Betreten
  useMeetingRoom();

  // Token-Refresh
  useTokenRefresh({
    onNewToken: sendRefreshToken,
  });

  // Kamera (Zoom + Drag)
  const { handleWheel, startDrag, updateDrag } = useCamera(size.w, size.h);

  // Game-Loop (WASD + Bewegung)
  const { updateFromDrag } = useGameLoop({
    sendMove,
    stageWidth: size.w,
    stageHeight: size.h,
    paused: showMeeting,
  });

  // ── Touch: 1-Finger-Pan + 2-Finger-Pinch/Zoom ──────────────────────────────
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
        // Skip if touch started on the joystick
        if ((e.target as HTMLElement).closest?.('[data-joystick]')) return;
        // Skip if touch is near the local avatar (let Konva's draggable handle it)
        const cam = useCameraStore.getState();
        const player = usePlayerStore.getState();
        const ax = player.wx * P * cam.scale + cam.offset.x;
        const ay = player.wy * P * cam.scale + cam.offset.y;
        const dist2 = (t.clientX - ax) ** 2 + (t.clientY - ay) ** 2;
        const hitR  = (16 * cam.scale + 14) ** 2;
        if (dist2 < hitR) return; // on avatar → let Konva handle drag
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
        const cam  = useCameraStore.getState();
        const oldScale = cam.scale;
        const newScale = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, oldScale * dist / pinchRef.current.prevDist));
        const dMidX = midX - pinchRef.current.prevMidX;
        const dMidY = midY - pinchRef.current.prevMidY;
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

  // Rechtsklick-Drag State
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

  const handleWheel2 = useCallback((e: { evt: WheelEvent }) => {
    const ptr = { x: e.evt.clientX, y: e.evt.clientY };
    handleWheel(e.evt, ptr.x, ptr.y);
  }, [handleWheel]);

  const layerProps = { x: offset.x, y: offset.y, scaleX: scale, scaleY: scale };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', touchAction: 'none' }}>
      <Stage
        width={size.w}
        height={size.h}
        onWheel={handleWheel2}
        onMousedown={handleMouseDown}
        onContextmenu={(e: { evt: MouseEvent }) => e.evt.preventDefault()}
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        <GroundLayer   {...layerProps} />
        <BuildingLayer {...layerProps} />
        <AvatarLayer   {...layerProps} updateFromDrag={updateFromDrag} />
      </Stage>

      {/* HTML-Overlays außerhalb des Canvas */}
      <HUD onOpenMeeting={() => setShowMeeting(true)} />
      <ControlsHint />
      <VideoManager />
      <VideoGrid />
      <MediaControls />
      {showMeeting && <MeetingOverlay onClose={() => setShowMeeting(false)} />}
      <ConnectionErrorModal />
      <VirtualJoystick />
    </div>
  );
};

export default OfficeCanvas;
