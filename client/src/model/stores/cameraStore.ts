import { create } from 'zustand';
import type { CameraOffset } from '../types';

interface CameraState {
  scale: number;
  offset: CameraOffset;
  follow: boolean;
  // Actions
  setScale: (scale: number) => void;
  setOffset: (offset: CameraOffset) => void;
  setFollow: (follow: boolean) => void;
}

export const useCameraStore = create<CameraState>((set) => ({
  scale: 1.5,
  offset: { x: 0, y: 0 },
  follow: true,

  setScale: (scale) => set({ scale }),
  setOffset: (offset) => set({ offset }),
  setFollow: (follow) => set({ follow }),
}));
