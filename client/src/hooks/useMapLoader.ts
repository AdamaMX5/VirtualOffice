import { useEffect } from 'react';
import { useMapStore } from '../model/stores/mapStore';
import { useDesignerStore } from '../model/stores/designerStore';
import { listObjects } from '../services/objectClient';
import { parseMapDocument } from '../model/mapData';
import type { Room, Wall, MapDocument } from '../model/types';

function isMapDocument(data: unknown): data is MapDocument {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.points === 'object' && d.points !== null &&
    Array.isArray(d.walls) &&
    Array.isArray(d.rooms)
  );
}

export function useMapLoader(): void {
  useEffect(() => {
    listObjects('floor_plans', { app: 'VirtualOffice', limit: '20' })
      .then((docs) => {
        if (!docs.length) { useMapStore.getState().resetToDefault(); return; }

        const sorted = [...docs].sort((a, b) => b._id.localeCompare(a._id));
        const doc    = sorted[0];

        useDesignerStore.getState().setSavedId(doc._id);

        if (isMapDocument(doc.data)) {
          // Neues Format
          const { rooms, walls, spawnPoint } = parseMapDocument(doc.data);
          useMapStore.getState().setMap(rooms, walls, spawnPoint);
          useDesignerStore.getState().setSpawnPoint(spawnPoint);
        } else {
          // Altes Format { rooms: Room[], walls: Wall[] }
          const rooms = doc.data.rooms as Room[] | undefined;
          const walls = doc.data.walls as Wall[] | undefined;
          if (Array.isArray(rooms) && Array.isArray(walls) && rooms.length > 0) {
            useMapStore.getState().setMap(rooms, walls);
          } else {
            useMapStore.getState().resetToDefault();
          }
        }
      })
      .catch(() => useMapStore.getState().resetToDefault());
  }, []);
}
