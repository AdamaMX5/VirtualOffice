import { useCallback } from 'react';
import { useCameraStore } from '../model/stores/cameraStore';
import { usePlayerStore } from '../model/stores/playerStore';
import { P, ZOOM_MAX } from '../model/constants';

function minScale(stageWidth: number, stageHeight: number): number {
  const mapW = 120 * P;
  const mapH = 100 * P;
  return Math.max(stageWidth / mapW, stageHeight / mapH, 0.15);
}

export function useCamera(stageWidth: number, stageHeight: number) {
  const { scale, offset, setScale, setOffset, setFollow } = useCameraStore();
  const { wx, wy } = usePlayerStore();

  const handleWheel = useCallback(
    (e: WheelEvent, pointerX: number, pointerY: number) => {
      e.preventDefault();
      const oldScale = scale;
      const zoomIn = e.deltaY < 0;
      const min = minScale(stageWidth, stageHeight);
      const newScale = Math.max(min, Math.min(ZOOM_MAX, oldScale * (zoomIn ? 1.1 : 0.91)));

      if (newScale === oldScale) return;
      setScale(newScale);

      const refX = zoomIn ? pointerX : stageWidth  / 2;
      const refY = zoomIn ? pointerY : stageHeight / 2;

      setOffset({
        x: refX - (refX - offset.x) / oldScale * newScale,
        y: refY - (refY - offset.y) / oldScale * newScale,
      });
    },
    [scale, offset, stageWidth, stageHeight, setScale, setOffset]
  );

  const followPlayer = useCallback(() => {
    setOffset({
      x: stageWidth  / 2 - wx * P * scale,
      y: stageHeight / 2 - wy * P * scale,
    });
  }, [stageWidth, stageHeight, wx, wy, scale, setOffset]);

  const startDrag = useCallback(
    (clientX: number, clientY: number): { startOffset: { x: number; y: number }; startClient: { x: number; y: number } } => {
      setFollow(false);
      return {
        startOffset: { ...offset },
        startClient: { x: clientX, y: clientY },
      };
    },
    [offset, setFollow]
  );

  const updateDrag = useCallback(
    (
      clientX: number,
      clientY: number,
      startOffset: { x: number; y: number },
      startClient: { x: number; y: number }
    ) => {
      setOffset({
        x: startOffset.x + (clientX - startClient.x),
        y: startOffset.y + (clientY - startClient.y),
      });
    },
    [setOffset]
  );

  return { scale, offset, handleWheel, followPlayer, startDrag, updateDrag };
}
