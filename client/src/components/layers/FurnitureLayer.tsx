import React, { useRef, useEffect, useState } from 'react';
import { Layer, Image as KonvaImage, Transformer } from 'react-konva';
import type KonvaType from 'konva';
import { useFurnitureStore, PlacedItem } from '../../model/stores/furnitureStore';
import { useAuthStore } from '../../model/stores/authStore';
import { getJwtUserId } from '../../services/objectClient';
import { moveItem, resizeItem, rotateItem } from '../../services/furnitureService';
import { P } from '../../model/constants';

// ── Bild-Cache (modul-weit, überlebt Re-Renders) ──────────────────────────────
const imgCache = new Map<string, HTMLImageElement>();

function loadImg(url: string, onLoad: () => void): HTMLImageElement | undefined {
  if (!url) return undefined;
  const cached = imgCache.get(url);
  if (cached) return cached.complete && cached.naturalWidth > 0 ? cached : undefined;
  const img = new window.Image();
  img.crossOrigin = 'anonymous';
  imgCache.set(url, img);
  img.onload  = () => onLoad();
  img.onerror = () => onLoad();
  img.src = url;
  return undefined;
}

// ── Einzelne Kachel ───────────────────────────────────────────────────────────

interface TileProps {
  item: PlacedItem;
  image: HTMLImageElement | undefined;
  furnitureModeActive: boolean;
  isSelected: boolean;
  canEdit: boolean;
  onSelect: () => void;
  trRef: React.RefObject<KonvaType.Transformer | null>;
}

const FurnitureTile: React.FC<TileProps> = ({
  item, image, furnitureModeActive, isSelected, canEdit, onSelect, trRef,
}) => {
  const imgRef = useRef<KonvaType.Image>(null);

  const w  = item.width  * P;
  const h  = item.height * P;
  // x/y ist Mittelpunkt → Konva offsetX/Y auf halbe Breite/Höhe setzen
  const cx = item.x * P;
  const cy = item.y * P;

  // Transformer an dieses Image hängen, wenn selektiert
  useEffect(() => {
    if (!isSelected || !trRef.current || !imgRef.current) return;
    trRef.current.nodes([imgRef.current]);
    trRef.current.getLayer()?.batchDraw();
  }, [isSelected, image]); // image als Dep: nach Laden neu andocken

  const handleDragEnd = (e: KonvaType.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    // node.x()/y() ist der neue Mittelpunkt in Layer-Koordinaten
    moveItem(item.id, node.x() / P, node.y() / P);
  };

  const handleTransformEnd = () => {
    const node = imgRef.current;
    if (!node) return;
    // Transformer ändert scaleX/Y – wir wandeln das in echte tile-Größen um
    const newW = Math.max(0.5, (node.width()  * node.scaleX()) / P);
    const newH = Math.max(0.5, (node.height() * node.scaleY()) / P);
    node.scaleX(1);
    node.scaleY(1);
    node.width(newW  * P);
    node.height(newH * P);
    node.offsetX(newW * P / 2);
    node.offsetY(newH * P / 2);
    rotateItem(item.id, node.rotation());
    resizeItem(item.id, newW, newH);
  };

  return (
    <KonvaImage
      ref={imgRef}
      image={image}
      x={cx} y={cy}
      width={w} height={h}
      offsetX={w / 2} offsetY={h / 2}
      rotation={item.rotation}
      draggable={furnitureModeActive && canEdit}
      onClick={() => { if (furnitureModeActive && canEdit) onSelect(); }}
      onTap={()   => { if (furnitureModeActive && canEdit) onSelect(); }}
      onDragEnd={handleDragEnd}
      onTransformEnd={handleTransformEnd}
    />
  );
};

// ── FurnitureLayer ────────────────────────────────────────────────────────────

interface LayerProps {
  x: number; y: number; scaleX: number; scaleY: number;
}

const FurnitureLayer: React.FC<LayerProps> = ({ x, y, scaleX, scaleY }) => {
  const { placedItems, furnitureModeActive, selectedId, selectItem } = useFurnitureStore();
  const authStatus = useAuthStore((s) => s.authStatus);
  const isAdmin    = useAuthStore((s) => {
    if (!s.jwt) return false;
    try {
      const p = JSON.parse(atob(s.jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return Array.isArray(p.roles) && p.roles.includes('admin');
    } catch { return false; }
  });

  const [, setTick] = useState(0); // Re-Render-Trigger für Bild-Loads
  const forceUpdate = () => setTick((n) => n + 1);

  const trRef = useRef<KonvaType.Transformer>(null);

  // Bilder laden (alle eindeutigen URLs)
  useEffect(() => {
    const urls = [...new Set(placedItems.map((i) => i.imageUrl).filter(Boolean))];
    urls.forEach((url) => loadImg(url, forceUpdate));
  }, [placedItems]);

  // Transformer leeren, wenn Auswahl aufgehoben wird
  useEffect(() => {
    if (!selectedId && trRef.current) {
      trRef.current.nodes([]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [selectedId]);

  const ownerId = getJwtUserId();

  return (
    <Layer x={x} y={y} scaleX={scaleX} scaleY={scaleY}>
      {placedItems.map((item) => {
        const img     = imgCache.get(item.imageUrl);
        const loaded  = img?.complete && (img.naturalWidth ?? 0) > 0 ? img : undefined;
        const canEdit = isAdmin || item.ownerId === ownerId;
        return (
          <FurnitureTile
            key={item.id}
            item={item}
            image={loaded}
            furnitureModeActive={furnitureModeActive}
            isSelected={selectedId === item.id}
            canEdit={canEdit}
            onSelect={() => selectItem(item.id)}
            trRef={trRef}
          />
        );
      })}

      {/* Transformer für Rotation (PowerPoint-Stil: Kreis über Auswahl) */}
      <Transformer
        ref={trRef}
        resizeEnabled={false}
        rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
        rotationSnapTolerance={8}
        borderStroke="rgba(99,179,237,0.85)"
        borderStrokeWidth={2}
        borderDash={[6, 3]}
        anchorSize={0}
      />
    </Layer>
  );
};

export default FurnitureLayer;
