/**
 * PixiCanvas – experimenteller WebGL-Renderer (display-only, kein Furniture-Edit).
 * Liest aus denselben Zustand-Stores wie OfficeCanvas; Camera-Events werden
 * von OfficeCanvas via DOM-Listener + cameraStore gesteuert.
 */
import { useEffect, useRef } from 'react';
import {
  Application, Assets, Container, Graphics, Sprite, Text, TextStyle,
} from 'pixi.js';
import { useCameraStore }   from '../model/stores/cameraStore';
import { usePlayerStore }   from '../model/stores/playerStore';
import { usePresenceStore } from '../model/stores/presenceStore';
import { useFurnitureStore } from '../model/stores/furnitureStore';
import { useMapStore }       from '../model/stores/mapStore';
import type { Room, Wall }  from '../model/types';
import { P, MAP }           from '../model/constants';

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

const hex = (s: string): number => parseInt(s.replace('#', ''), 16);

// ── Statischer Layer (Boden + Räume + Wände) ──────────────────────────────────

function buildStaticScene(rooms: Room[], walls: Wall[]): Container {
  const c = new Container();

  // Hintergrund
  const bg = new Graphics();
  bg.rect(0, 0, MAP.w * P, MAP.h * P).fill(0x0f1a10);
  c.addChild(bg);

  // Raumflächen
  const roomGfx = new Graphics();
  for (const room of rooms) {
    roomGfx.poly(room.pts.map((v) => v * P)).fill(hex(room.fill));
  }
  c.addChild(roomGfx);

  // Raum-Labels
  const labelStyle = new TextStyle({ fontSize: 11, fill: 0xffffff, align: 'center' });
  for (const room of rooms) {
    const xs = room.pts.filter((_, i) => i % 2 === 0);
    const ys = room.pts.filter((_, i) => i % 2 === 1);
    const cx = ((Math.min(...xs) + Math.max(...xs)) / 2) * P;
    const cy = ((Math.min(...ys) + Math.max(...ys)) / 2) * P;
    const lbl = new Text({ text: room.label, style: labelStyle });
    lbl.anchor.set(0.5);
    lbl.position.set(cx, cy);
    lbl.alpha = 0.35;
    c.addChild(lbl);
  }

  // Wände (nach Typ gruppiert → ein Draw-Call pro Typ)
  const wallGfx   = new Graphics();
  const sharedGfx = new Graphics();
  const doorGfx   = new Graphics();

  for (const w of walls) {
    const x1 = w.f[0] * P, y1 = w.f[1] * P;
    const x2 = w.t[0] * P, y2 = w.t[1] * P;
    if (w.type === 'wall')   wallGfx  .moveTo(x1, y1).lineTo(x2, y2);
    if (w.type === 'shared') sharedGfx.moveTo(x1, y1).lineTo(x2, y2);
    if (w.type === 'door')   doorGfx  .moveTo(x1, y1).lineTo(x2, y2);
  }

  wallGfx  .stroke({ width: 6, color: 0x0d0d0d, cap: 'round' });
  sharedGfx.stroke({ width: 2, color: 0xffffff, alpha: 0.10 });
  doorGfx  .stroke({ width: 2, color: 0xffffff, alpha: 0.25 });

  c.addChild(wallGfx);
  c.addChild(sharedGfx);
  c.addChild(doorGfx);

  return c;
}

// ── Avatar-Grafik (Smiley, kein Video) ────────────────────────────────────────

function buildAvatarGfx(isPlayer: boolean, isBot: boolean): Graphics {
  const fillColor   = isPlayer ? 0xfacc15 : isBot ? 0x4ade80 : 0x60a5fa;
  const strokeColor = isPlayer ? 0xca8a04 : isBot ? 0x16a34a : 0x2563eb;

  const g = new Graphics();
  // Schatten
  g.circle(-2, 4, 16).fill({ color: 0x000000, alpha: 0.18 });
  // Gesicht
  g.circle(0, 0, 16).fill(fillColor);
  g.circle(0, 0, 16).stroke({ width: 2, color: strokeColor });
  // Augen
  g.circle(-5, -5, 2.5).fill(0x1e293b);
  g.circle(5,  -5, 2.5).fill(0x1e293b);
  // Spieler-Ring
  if (isPlayer) {
    g.circle(0, 0, 21).stroke({ width: 1.5, color: 0xfde68a, alpha: 0.7 });
  }
  return g;
}

// ── Avatar-Eintrag (Container + Label) ───────────────────────────────────────

interface AvatarEntry {
  container: Container;
  label: Text;
  lastName: string;
}

const NAME_STYLE        = new TextStyle({ fontSize: 10, fill: 0xdbeafe, align: 'center' });
const PLAYER_NAME_STYLE = new TextStyle({ fontSize: 10, fill: 0xfef9c3, fontWeight: 'bold', align: 'center' });
const BOT_NAME_STYLE    = new TextStyle({ fontSize: 10, fill: 0xdcfce7, fontWeight: 'bold', align: 'center' });

function createAvatar(
  isPlayer: boolean, isBot: boolean, name: string,
): AvatarEntry {
  const container = new Container();
  container.addChild(buildAvatarGfx(isPlayer, isBot));

  const style = isPlayer ? PLAYER_NAME_STYLE : isBot ? BOT_NAME_STYLE : NAME_STYLE;
  const label = new Text({ text: name, style });
  label.anchor.set(0.5, 0);
  label.position.set(0, 21);
  container.addChild(label);

  return { container, label, lastName: name };
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────

const PixiCanvas = () => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    let alive = true;
    const app = new Application();

    // Sprite-Maps (außerhalb der async-Funktion, damit cleanup Zugriff hat)
    const furnitureSprites = new Map<string, Sprite>();
    const pendingUrls      = new Set<string>();
    const avatarMap        = new Map<string, AvatarEntry>();
    let   avatarLayer: Container;
    let   furnitureLayer: Container;

    // ── Async-Init ────────────────────────────────────────────────────────
    (async () => {
      await app.init({
        width:           el.clientWidth  || window.innerWidth,
        height:          el.clientHeight || window.innerHeight,
        backgroundColor: 0x0f1a10,
        antialias:       true,
        resolution:      Math.min(window.devicePixelRatio || 1, 2),
        autoDensity:     true,
      });
      if (!alive) { app.destroy(true); return; }

      el.appendChild(app.canvas);

      // Welt-Container bekommt Camera-Transform
      const world = new Container();
      app.stage.addChild(world);

      const { rooms, walls } = useMapStore.getState();
      world.addChild(buildStaticScene(rooms, walls));

      furnitureLayer = new Container();
      avatarLayer    = new Container();
      world.addChild(furnitureLayer);
      world.addChild(avatarLayer);

      // ── Möbel-Sync ──────────────────────────────────────────────────────
      async function syncFurniture() {
        const items = useFurnitureStore.getState().placedItems;
        const ids   = new Set(items.map((i) => i.id));

        // Entfernte Items löschen
        for (const [id, sprite] of furnitureSprites) {
          if (!ids.has(id)) {
            furnitureLayer.removeChild(sprite);
            sprite.destroy();
            furnitureSprites.delete(id);
          }
        }

        // Neue Items hinzufügen / Positionen aktualisieren
        for (const item of items) {
          let sprite = furnitureSprites.get(item.id);
          if (!sprite) {
            if (pendingUrls.has(item.imageUrl)) continue;
            pendingUrls.add(item.imageUrl);
            const texture = await Assets.load(item.imageUrl).catch(() => null);
            pendingUrls.delete(item.imageUrl);
            if (!alive || !texture) continue;
            sprite = new Sprite(texture);
            sprite.anchor.set(0.5);
            furnitureLayer.addChild(sprite);
            furnitureSprites.set(item.id, sprite);
          }
          sprite.position.set(item.x * P, item.y * P);
          sprite.width  = item.width  * P;
          sprite.height = item.height * P;
          sprite.angle  = item.rotation;
        }
      }

      // ── Avatar-Sync ──────────────────────────────────────────────────────
      function getOrUpdateAvatar(
        id: string, isPlayer: boolean, isBot: boolean, name: string,
      ): Container {
        let entry = avatarMap.get(id);
        if (!entry) {
          entry = createAvatar(isPlayer, isBot, name);
          avatarLayer.addChild(entry.container);
          avatarMap.set(id, entry);
        } else if (entry.lastName !== name) {
          entry.label.text = name;
          entry.lastName   = name;
        }
        return entry.container;
      }

      // ── Ticker: Camera + Player + Remote-Avatare ─────────────────────────
      app.ticker.add(() => {
        // Camera
        const { scale, offset } = useCameraStore.getState();
        world.position.set(offset.x, offset.y);
        world.scale.set(scale);

        // Eigener Spieler
        const { wx, wy, name } = usePlayerStore.getState();
        getOrUpdateAvatar('__self__', true, false, name).position.set(wx * P, wy * P);

        // Remote-User
        const remoteUsers = usePresenceStore.getState().remoteUsers;
        const activeIds   = new Set<string>(['__self__']);

        for (const user of Object.values(remoteUsers)) {
          activeIds.add(user.user_id);
          const isBot = user.user_id.startsWith('bot_') || user.name.endsWith('_Bot');
          const label = (!isBot && user.department)
            ? `${user.name} · ${user.department}`
            : user.name;
          getOrUpdateAvatar(user.user_id, false, isBot, label)
            .position.set(user.x * P, user.y * P);
        }

        // Abgemeldete User entfernen
        for (const [id, entry] of avatarMap) {
          if (!activeIds.has(id)) {
            avatarLayer.removeChild(entry.container);
            entry.container.destroy({ children: true });
            avatarMap.delete(id);
          }
        }
      });

      // ── Möbel bei Store-Änderung aktualisieren ───────────────────────────
      const unsubFurniture = useFurnitureStore.subscribe((state, prev) => {
        if (state.placedItems !== prev.placedItems) syncFurniture();
      });

      // ── Resize ───────────────────────────────────────────────────────────
      const onResize = () => {
        if (alive) app.renderer.resize(el.clientWidth, el.clientHeight);
      };
      window.addEventListener('resize', onResize);

      // Initialer Möbel-Load
      await syncFurniture();

      // Cleanup speichern
      (app as unknown as { _cleanupExtra?: () => void })._cleanupExtra = () => {
        unsubFurniture();
        window.removeEventListener('resize', onResize);
      };
    })();

    return () => {
      alive = false;
      const extra = (app as unknown as { _cleanupExtra?: () => void })._cleanupExtra;
      extra?.();
      app.destroy(true, { children: true });
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    />
  );
};

export default PixiCanvas;
