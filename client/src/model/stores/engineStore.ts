import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type RenderEngine = 'konva' | 'pixi';

interface EngineState {
  engine: RenderEngine;
  toggle: () => void;
}

export const useEngineStore = create<EngineState>()(
  persist(
    (set) => ({
      engine: 'konva',
      toggle: () => set((s) => ({ engine: s.engine === 'konva' ? 'pixi' : 'konva' })),
    }),
    { name: 'vo_engine' },
  ),
);
