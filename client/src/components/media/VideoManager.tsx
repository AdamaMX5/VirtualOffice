/**
 * VideoManager – ersetzt VideoGrid.
 * Rendert versteckte <video>/<audio>-Elemente für alle LiveKit-Teilnehmer,
 * hängt Tracks an und aktualisiert das videoRegistry.
 * Kein sichtbares UI – der Avatar-Layer liest die Video-Elemente direkt.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Participant, ParticipantEvent, Track } from 'livekit-client';
import { useLiveKitStore } from '../../model/stores/liveKitStore';
import { getRoom } from '../../hooks/useLiveKit';
import { videoRegistry, registerReloadAll } from '../../services/videoRegistry';

// ── ParticipantMedia ──────────────────────────────────────────────────────────

interface MediaProps {
  participant: Participant;
  isLocal: boolean;
  speakerEnabled: boolean;
  reloadKey: number;
}

const ParticipantMedia: React.FC<MediaProps> = ({ participant, isLocal, speakerEnabled, reloadKey }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const videoEl = videoRef.current;
    const audioEl = audioRef.current;
    const name    = participant.name || participant.identity;

    if (videoEl) videoRegistry.setVideo(name, videoEl);

    const reattach = () => {
      const camPub = participant.getTrackPublication(Track.Source.Camera);
      const micPub = participant.getTrackPublication(Track.Source.Microphone);
      const hasCam = !!(camPub?.track);

      if (videoEl) {
        if (hasCam) {
          (camPub!.track as { attach(el: HTMLVideoElement): void }).attach(videoEl);
          // Mehrfach versuchen: sofort, bei canplay und nach 300 ms
          const tryPlay = () => videoEl.play().catch(() => {});
          tryPlay();
          videoEl.addEventListener('canplay', tryPlay, { once: true });
          setTimeout(tryPlay, 300);
        } else if (camPub?.track) {
          (camPub.track as { detach(el: HTMLVideoElement): void }).detach(videoEl);
        }
      }
      if (audioEl && micPub?.track) {
        (micPub.track as { attach(el: HTMLAudioElement): void }).attach(audioEl);
      }

      videoRegistry.setActive(name, hasCam);
      useLiveKitStore.getState().bumpTrackVersion();
    };

    reattach();

    const events = [
      ParticipantEvent.TrackSubscribed,
      ParticipantEvent.TrackUnsubscribed,
      ParticipantEvent.TrackMuted,
      ParticipantEvent.TrackUnmuted,
      ParticipantEvent.TrackPublished,
      ParticipantEvent.TrackUnpublished,
    ];
    events.forEach((ev) => participant.on(ev as never, reattach as never));

    return () => {
      events.forEach((ev) => participant.off(ev as never, reattach as never));
      const camPub = participant.getTrackPublication(Track.Source.Camera);
      const micPub = participant.getTrackPublication(Track.Source.Microphone);
      if (camPub?.track && videoEl) (camPub.track as { detach(el: HTMLVideoElement): void }).detach(videoEl);
      if (micPub?.track && audioEl) (micPub.track as { detach(el: HTMLAudioElement): void }).detach(audioEl);
      videoRegistry.removeVideo(name);
      useLiveKitStore.getState().bumpTrackVersion();
    };
  }, [participant, reloadKey]); // reloadKey erzwingt vollständiges Re-Attach

  // Audio-Mute synchron halten
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isLocal || !speakerEnabled;
    }
  }, [speakerEnabled, isLocal]);

  return (
    <>
      {/* Explizite Größe damit der Browser Video-Frames wirklich dekodiert */}
      <video ref={videoRef} autoPlay playsInline muted={isLocal} width={2} height={2} />
      <audio ref={audioRef} autoPlay muted={isLocal || !speakerEnabled} />
    </>
  );
};

// ── VideoManager ──────────────────────────────────────────────────────────────

const VideoManager: React.FC = () => {
  const status         = useLiveKitStore((s) => s.status);
  const participantIds = useLiveKitStore((s) => s.participantIds);
  const speakerEnabled = useLiveKitStore((s) => s.speakerEnabled);
  const [reloadKey, setReloadKey] = useState(0);

  // Reload-Funktion registrieren (wird von MediaControls aufgerufen)
  useEffect(() => {
    registerReloadAll(() => setReloadKey((k) => k + 1));
  }, []);

  if (status !== 'connected') return null;
  const room = getRoom();
  if (!room) return null;

  const remoteParticipants = participantIds
    .map((id) => room.remoteParticipants.get(id))
    .filter((p): p is NonNullable<typeof p> => p != null);

  // Versteckter Container außerhalb des sichtbaren Bereichs
  return (
    <div style={{ position: 'fixed', left: -9999, top: -9999, width: 1, height: 1, overflow: 'hidden' }}>
      <ParticipantMedia
        participant={room.localParticipant}
        isLocal
        speakerEnabled={speakerEnabled}
        reloadKey={reloadKey}
      />
      {remoteParticipants.map((p) => (
        <ParticipantMedia
          key={p.identity}
          participant={p}
          isLocal={false}
          speakerEnabled={speakerEnabled}
          reloadKey={reloadKey}
        />
      ))}
    </div>
  );
};

export default VideoManager;
