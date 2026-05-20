/**
 * useMapLoader – lädt beim App-Start den gespeicherten Grundriss
 * aus dem ObjectService und schreibt ihn in den mapStore.
 * Fällt auf mapData.ts-Defaults zurück wenn kein Eintrag vorhanden.
 */
import { useEffect } from 'react';
import { useMapStore } from '../model/stores/mapStore';
import { useDesignerStore } from '../model/stores/designerStore';
import { listObjects } from '../services/objectClient';
import type { Room, Wall } from '../model/types';

export function useMapLoader(): void {
  useEffect(() => {
    listObjects('floor_plans', { app: 'VirtualOffice', limit: '20' })
      .then((docs) => {
        if (!docs.length) {
          useMapStore.getState().resetToDefault();
          return;
        }
        // Neuestes Dokument: MongoDB-ObjectIDs sind zeitgeordnet → größte ID = neuestes
        const sorted = [...docs].sort((a, b) => b._id.localeCompare(a._id));
        const doc    = sorted[0];

        // Beim nächsten Designer-Save den gleichen Eintrag updaten
        useDesignerStore.getState().setSavedId(doc._id);

        const rooms = doc.data.rooms as Room[] | undefined;
        const walls = doc.data.walls as Wall[] | undefined;
        if (Array.isArray(rooms) && Array.isArray(walls) && rooms.length > 0) {
          useMapStore.getState().setMap(rooms, walls);
        } else {
          useMapStore.getState().resetToDefault();
        }
      })
      .catch(() => useMapStore.getState().resetToDefault());
  }, []);
}
