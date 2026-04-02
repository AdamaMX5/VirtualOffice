import { useState, useCallback, useRef, useEffect } from 'react';
import { Stage } from 'react-konva';
import GroundLayer from './layers/GroundLayer';
import BuildingLayer from './layers/BuildingLayer';
import AvatarLayer from './layers/AvatarLayer';
import HUD from './hud/HUD';
import ControlsHint from './hud/ControlsHint';
import VideoManager from './media/VideoManager';
import MediaControls from './media/MediaControls';
import MeetingOverlay from './meeting/MeetingOverlay';
import { usePresence } from '../hooks/usePresence';
import { useGameLoop } from '../hooks/useGameLoop';
import { useCamera } from '../hooks/useCamera';
import { useTokenRefresh } from '../hooks/useTokenRefresh';
import { useMeetingRoom } from '../hooks/useMeetingRoom';
import { useCameraStore } from '../model/stores/cameraStore';

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
  });

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
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
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
      <MediaControls />
      {showMeeting && <MeetingOverlay onClose={() => setShowMeeting(false)} />}
    </div>
  );
};

export default OfficeCanvas;
