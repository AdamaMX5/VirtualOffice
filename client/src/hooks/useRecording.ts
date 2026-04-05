/**
 * useRecording – Nimmt das Meeting als eine einzige WebM-Datei auf.
 *
 * Ansatz: offscreen <canvas> compositet alle Teilnehmer-Videos frame-genau.
 * → kein Mauszeiger, keine HUD-Elemente (ContextMenus, Einstellungen).
 * Audio: AudioContext mischt alle Mikrofon-Tracks zu einer Spur (mit GainNodes
 * pro Teilnehmer, die live auf den participantVolumeStore reagieren).
 *
 * Datei-Ausgabe:
 *   Primär: File System Access API (showSaveFilePicker) → wachsende Datei,
 *            jeder 1s-Chunk wird sofort auf Disk geschrieben.
 *   Fallback (Firefox/Safari): Chunks im Speicher, Download beim Stoppen.
 *
 * Tab-Warnung: tabHidden wird true, wenn der Tab inaktiv wird (canvas friert ein).
 */
import { useRef, useState, useCallback, useEffect } from 'react';
import { Track } from 'livekit-client';
import { getRoom } from './useLiveKit';
import { useParticipantVolumeStore } from '../model/stores/participantVolumeStore';

function gridDims(n: number): { cols: number; rows: number } {
  if (n <= 1) return { cols: 1, rows: 1 };
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  return { cols, rows };
}

const hasFilePicker = typeof window !== 'undefined' && 'showSaveFilePicker' in window;

export function useRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const [tabHidden, setTabHidden]     = useState(false);

  const recorderRef    = useRef<MediaRecorder | null>(null);
  const sessionIdRef   = useRef('');
  const rafRef         = useRef<number>(0);
  const audioCtxRef    = useRef<AudioContext | null>(null);
  const videoElsRef    = useRef<HTMLVideoElement[]>([]);
  const gainNodesRef   = useRef<Record<string, GainNode>>({});
  const unsubVolumeRef = useRef<(() => void) | null>(null);

  // File System Access API (wachsende Datei)
  const writableRef    = useRef<FileSystemWritableFileStream | null>(null);
  // Fallback: In-Memory-Chunks
  const chunksRef      = useRef<Blob[]>([]);

  // ── Tab-Sichtbarkeit ────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = () => setTabHidden(document.hidden);
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  // ── Aufnahme starten ────────────────────────────────────────────────────────
  const startRecording = useCallback(async (bgUrl?: string | null) => {
    const room = getRoom();
    if (!room || isRecording) return;

    const sessionId = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    sessionIdRef.current = sessionId;

    // ── Datei öffnen (primär: File System Access API) ──────────────────────
    if (hasFilePicker) {
      try {
        const handle = await (window as Window & typeof globalThis & {
          showSaveFilePicker(opts?: object): Promise<FileSystemFileHandle>;
        }).showSaveFilePicker({
          suggestedName: `${sessionId}_meeting.webm`,
          types: [{ description: 'WebM Video', accept: { 'video/webm': ['.webm'] } }],
        });
        writableRef.current = await handle.createWritable();
      } catch {
        // Nutzer hat den Dialog abgebrochen
        return;
      }
    } else {
      chunksRef.current = [];
    }

    const allParticipants = [
      room.localParticipant,
      ...Array.from(room.remoteParticipants.values()),
    ];

    // ── Offscreen-Videoelemente ─────────────────────────────────────────────
    const videoEls: HTMLVideoElement[] = [];
    for (const participant of allParticipants) {
      const camPub = participant.getTrackPublication(Track.Source.Camera);
      if (!camPub?.track?.mediaStreamTrack) continue;
      const el = document.createElement('video');
      el.autoplay  = true;
      el.muted     = true;
      el.srcObject = new MediaStream([camPub.track.mediaStreamTrack]);
      await el.play().catch(() => {});
      videoEls.push(el);
    }
    videoElsRef.current = videoEls;

    // ── Offscreen-Canvas ────────────────────────────────────────────────────
    const canvas = document.createElement('canvas');
    canvas.width  = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d')!;
    const n = videoEls.length || 1;
    const { cols, rows } = gridDims(n);

    // Mirror MeetingOverlay: 1.5% padding + 1.5% gaps
    const PAD  = Math.round(canvas.width  * 0.015);
    const GAP  = Math.round(canvas.width  * 0.015);
    const GAP_V = Math.round(canvas.height * 0.015);
    const gridW = canvas.width  - 2 * PAD - (cols - 1) * GAP;
    const gridH = canvas.height - 2 * PAD - (rows - 1) * GAP_V;
    const tileW = Math.floor(gridW / cols);
    const tileH = Math.floor(gridH / rows);

    // Load background image once
    let bgImg: HTMLImageElement | null = null;
    if (bgUrl) {
      bgImg = new Image();
      await new Promise<void>((resolve) => {
        bgImg!.onload = () => resolve();
        bgImg!.onerror = () => { bgImg = null; resolve(); };
        bgImg!.src = bgUrl;
      });
    }

    const render = () => {
      // Background
      if (bgImg) {
        // cover-scale: fill canvas, crop centre
        const imgAspect = bgImg.width / bgImg.height;
        const canAspect = canvas.width / canvas.height;
        let sx = 0, sy = 0, sw = bgImg.width, sh = bgImg.height;
        if (imgAspect > canAspect) {
          sw = bgImg.height * canAspect;
          sx = (bgImg.width - sw) / 2;
        } else {
          sh = bgImg.width / canAspect;
          sy = (bgImg.height - sh) / 2;
        }
        ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      } else {
        ctx.fillStyle = '#0a0a0f';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      videoEls.forEach((el, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = PAD + col * (tileW + GAP);
        const y = PAD + row * (tileH + GAP_V);

        if (el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          // objectFit: cover — crop video to fill 16:9 tile
          const vw = el.videoWidth  || tileW;
          const vh = el.videoHeight || tileH;
          const tileAspect = tileW / tileH;
          const vidAspect  = vw / vh;
          let sx = 0, sy = 0, sw = vw, sh = vh;
          if (vidAspect > tileAspect) {
            sw = vh * tileAspect;
            sx = (vw - sw) / 2;
          } else {
            sh = vw / tileAspect;
            sy = (vh - sh) / 2;
          }
          ctx.save();
          // rounded rect clip (matches borderRadius: 10 → ~10/1080 of height)
          const r = Math.round(canvas.height * 10 / 1080);
          ctx.beginPath();
          ctx.roundRect(x, y, tileW, tileH, r);
          ctx.clip();
          ctx.drawImage(el, sx, sy, sw, sh, x, y, tileW, tileH);
          ctx.restore();
        } else {
          // placeholder when no video
          ctx.save();
          const r = Math.round(canvas.height * 10 / 1080);
          ctx.beginPath();
          ctx.roundRect(x, y, tileW, tileH, r);
          ctx.clip();
          ctx.fillStyle = '#111';
          ctx.fillRect(x, y, tileW, tileH);
          ctx.fillStyle = 'rgba(255,255,255,0.2)';
          ctx.font = `${tileH * 0.4}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('👤', x + tileW / 2, y + tileH / 2);
          ctx.restore();
        }
      });
      rafRef.current = requestAnimationFrame(render);
    };
    rafRef.current = requestAnimationFrame(render);

    // ── AudioContext + GainNodes ────────────────────────────────────────────
    const audioCtx    = new AudioContext();
    audioCtxRef.current = audioCtx;
    const destination = audioCtx.createMediaStreamDestination();
    const gainNodes: Record<string, GainNode> = {};

    for (const participant of allParticipants) {
      const micPub = participant.getTrackPublication(Track.Source.Microphone);
      if (!micPub?.track?.mediaStreamTrack) continue;
      const src  = audioCtx.createMediaStreamSource(new MediaStream([micPub.track.mediaStreamTrack]));
      const gain = audioCtx.createGain();
      gain.gain.value = useParticipantVolumeStore.getState().getVolume(participant.identity);
      src.connect(gain);
      gain.connect(destination);
      gainNodes[participant.identity] = gain;
    }
    gainNodesRef.current = gainNodes;

    unsubVolumeRef.current = useParticipantVolumeStore.subscribe((state) => {
      for (const [identity, gainNode] of Object.entries(gainNodesRef.current)) {
        gainNode.gain.value = state.getVolume(identity);
      }
    });

    // ── MediaRecorder ───────────────────────────────────────────────────────
    const videoTrack = canvas.captureStream(30).getVideoTracks()[0];
    const combined   = new MediaStream([videoTrack, ...destination.stream.getAudioTracks()]);
    const mimeType   = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : 'video/webm';

    const recorder = new MediaRecorder(combined, { mimeType });

    if (writableRef.current) {
      // Streaming: jeden Chunk sofort auf Disk schreiben
      const writable = writableRef.current;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) writable.write(e.data);
      };
      recorder.onstop = () => {
        writable.close();
        writableRef.current = null;
      };
    } else {
      // Fallback: In-Memory + Download
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `${sessionIdRef.current}_meeting.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      };
    }

    recorder.start(1000);
    recorderRef.current = recorder;
    setIsRecording(true);
  }, [isRecording]);

  // ── Aufnahme stoppen ────────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder) return;

    recorder.stop(); // löst onstop aus (schließt Datei oder triggert Download)

    cancelAnimationFrame(rafRef.current);
    unsubVolumeRef.current?.();
    unsubVolumeRef.current = null;
    gainNodesRef.current   = {};
    audioCtxRef.current?.close();
    audioCtxRef.current = null;

    videoElsRef.current.forEach((el) => { el.srcObject = null; });
    videoElsRef.current = [];

    recorderRef.current = null;
    setIsRecording(false);
    setTabHidden(false);
  }, []);

  return { isRecording, startRecording, stopRecording, tabHidden };
}
