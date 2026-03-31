/**
 * useRecording – Aufzeichnung aller LiveKit-Teilnehmer als einzelne WebM-Dateien.
 *
 * Format: WebM (VP9 + Opus) – der einzige native Browser-Standard für MediaRecorder.
 * MP4 wäre möglich mit `mp4-muxer` (WebCodecs), aber unnötig komplex.
 * Konvertierung falls nötig: ffmpeg -i input.webm output.mp4
 *
 * Synchronisation: Alle Recorder starten im selben synchronen JS-Loop-Tick
 * (kein await dazwischen) → frame-genaue Synchronität.
 * Gemeinsamer Session-Timestamp im Dateinamen dient als Referenz.
 */
import { useRef, useState, useCallback } from 'react';
import { Track } from 'livekit-client';
import { getRoom } from './useLiveKit';
import { useLiveKitStore } from '../model/stores/liveKitStore';
import { apiPost } from '../services/apiClient';

interface ParticipantRecording {
  recorder: MediaRecorder;
  chunks: Blob[];
  safeName: string;
  hasVideo: boolean;
}

export function useRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const recordingsRef = useRef<ParticipantRecording[]>([]);
  const sessionIdRef  = useRef('');
  const egressIdRef   = useRef<string | null>(null);

  const startRecording = useCallback(async () => {
    const room = getRoom();
    if (!room || isRecording) return;

    // Session-ID = ISO-Zeitstempel ohne Sonderzeichen → Dateiname-sicher
    const sessionId = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    sessionIdRef.current = sessionId;

    const recordings: ParticipantRecording[] = [];
    const allParticipants = [
      room.localParticipant,
      ...Array.from(room.remoteParticipants.values()),
    ];

    for (const participant of allParticipants) {
      const tracks: MediaStreamTrack[] = [];
      let hasVideo = false;

      const camPub = participant.getTrackPublication(Track.Source.Camera);
      if (camPub?.track?.mediaStreamTrack) {
        tracks.push(camPub.track.mediaStreamTrack);
        hasVideo = true;
      }

      const micPub = participant.getTrackPublication(Track.Source.Microphone);
      if (micPub?.track?.mediaStreamTrack) {
        tracks.push(micPub.track.mediaStreamTrack);
      }

      if (tracks.length === 0) continue;

      const stream   = new MediaStream(tracks);
      const mimeType = hasVideo
        ? (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
            ? 'video/webm;codecs=vp9,opus'
            : 'video/webm')
        : 'audio/webm;codecs=opus';

      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

      const safeName = (participant.name || participant.identity).replace(/[^a-zA-Z0-9_-]/g, '_');
      recordings.push({ recorder, chunks, safeName, hasVideo });
    }

    // ── Alle Recorder synchron starten (kein await!) ──────────────────────────
    recordings.forEach((r) => r.recorder.start(1000)); // 1s-Chunks
    recordingsRef.current = recordings;
    setIsRecording(true);

    // ── Server-seitige LiveKit-Aufnahme starten (optional, kann fehlen) ───────
    const roomName = useLiveKitStore.getState().roomName;
    if (roomName) {
      try {
        const { egressId } = await apiPost<{ egressId: string }>(
          '/api/livekit/egress/start',
          { room: roomName },
        );
        egressIdRef.current = egressId;
      } catch {
        egressIdRef.current = null; // Egress nicht verfügbar – lokal reicht
      }
    }
  }, [isRecording]);

  const stopRecording = useCallback(async () => {
    const recordings = recordingsRef.current;
    const sessionId  = sessionIdRef.current;

    recordings.forEach(({ recorder, chunks, safeName, hasVideo }) => {
      recorder.onstop = () => {
        const mimeType = hasVideo ? 'video/webm' : 'audio/webm';
        const blob = new Blob(chunks, { type: mimeType });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `${sessionId}_${safeName}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      };
      recorder.stop();
    });

    recordingsRef.current = [];
    setIsRecording(false);

    // ── Server-seitige Aufnahme stoppen ───────────────────────────────────────
    if (egressIdRef.current) {
      try {
        await apiPost('/api/livekit/egress/stop', { egressId: egressIdRef.current });
      } catch {
        // Ignorieren – Aufnahme auf dem Server läuft bis zum Timeout
      }
      egressIdRef.current = null;
    }
  }, []);

  return { isRecording, startRecording, stopRecording };
}
