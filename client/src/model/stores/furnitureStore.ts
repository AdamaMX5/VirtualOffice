import { create } from 'zustand';

export interface CatalogItem {
  id: string;
  name: string;
  /** 'desk' | 'todo_board' | 'chair' | 'decoration' | beliebig */
  type: string;
  imageUrl: string;
  defaultWidth: number;   // Tile-Einheiten
  defaultHeight: number;
  group: string;
}

export interface PlacedItem {
  id: string;
  x: number;             // Mittelpunkt in Tile-Einheiten
  y: number;
  width: number;         // Tile-Einheiten
  height: number;
  rotation: number;      // Grad
  type: string;
  imageUrl: string;
  catalogItemId: string;
  roomId?: string;
  ownerId: string;
  ownerName?: string;
}

interface FurnitureState {
  catalogItems: CatalogItem[];
  placedItems: PlacedItem[];
  furnitureModeActive: boolean;
  selectedId: string | null;
  /** Katalog-Item, das als nächstes auf die Karte geklickt wird */
  pendingCatalogItem: CatalogItem | null;

  setCatalogItems: (items: CatalogItem[]) => void;
  setPlacedItems: (items: PlacedItem[]) => void;
  addCatalogItem:    (item: CatalogItem) => void;
  updateCatalogItem: (id: string, item: CatalogItem) => void;
  removeCatalogItem: (id: string) => void;
  addPlacedItem: (item: PlacedItem) => void;
  updatePlacedItem: (id: string, patch: Partial<PlacedItem>) => void;
  removePlacedItem: (id: string) => void;
  toggleFurnitureMode: () => void;
  selectItem: (id: string | null) => void;
  setPendingCatalogItem: (item: CatalogItem | null) => void;
}

export const useFurnitureStore = create<FurnitureState>((set) => ({
  catalogItems: [],
  placedItems: [],
  furnitureModeActive: false,
  selectedId: null,
  pendingCatalogItem: null,

  setCatalogItems: (items) => set({ catalogItems: items }),
  setPlacedItems:  (items) => set({ placedItems: items }),

  addCatalogItem:    (item) => set((s) => ({ catalogItems: [...s.catalogItems, item] })),
  updateCatalogItem: (id, item) => set((s) => ({
    catalogItems: s.catalogItems.map((i) => (i.id === id ? item : i)),
  })),
  removeCatalogItem: (id)   => set((s) => ({ catalogItems: s.catalogItems.filter((i) => i.id !== id) })),

  addPlacedItem: (item) => set((s) => ({ placedItems: [...s.placedItems, item] })),
  updatePlacedItem: (id, patch) => set((s) => ({
    placedItems: s.placedItems.map((i) => (i.id === id ? { ...i, ...patch } : i)),
  })),
  removePlacedItem: (id) => set((s) => ({
    placedItems: s.placedItems.filter((i) => i.id !== id),
    selectedId: s.selectedId === id ? null : s.selectedId,
  })),

  toggleFurnitureMode: () => set((s) => ({
    furnitureModeActive: !s.furnitureModeActive,
    selectedId: null,
    pendingCatalogItem: null,
  })),
  selectItem:            (id)   => set({ selectedId: id }),
  setPendingCatalogItem: (item) => set({ pendingCatalogItem: item }),
}));
