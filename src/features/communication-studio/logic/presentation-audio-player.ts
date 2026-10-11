import type { PresentationAudioState, ShowState } from './live-contract';
import { getPresentationBuiltin, presentationSequenceVoices } from './presentation-audio';
import { audioDuration, audioEnvelope, audioPosition } from './show-cues';

interface Group {
  spec: PresentationAudioState;
  key: string;
  slots: number[];
  started: number;
  retiring?: number;
  quick?: boolean;
}

/** Bounded two-lane mixer, shared by the audience output and local Studio previews.
 * Each music source has two voices for the catalog sequence; a retiring source
 * overlaps its replacement. Transition sounds have their own two voice slots. */
export type PresentationAudioFailure = 'blocked' | 'media';

export function classifyPresentationAudioFailure(error: unknown): PresentationAudioFailure {
  return typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'NotAllowedError'
    ? 'blocked'
    : 'media';
}

export function createPresentationAudioPlayer(
  onError: (failed: boolean, reason?: PresentationAudioFailure) => void
) {
  const players = Array.from({ length: 6 }, () => new Audio());
  const pending = new Map<number, object>();
  const failed = new Set<string>();
  let groups: Group[] = [];
  let disposed = false;
  let activating = false;
  let allowed = false;
  let offset = 0;
  let lease = Infinity;
  let audio: ShowState['audio'] = {};
  const now = () => Date.now() + offset;
  const clearSlot = (index: number) => {
    pending.delete(index);
    players[index].pause();
    players[index].volume = 0;
  };
  const release = (group: Group) => group.slots.forEach(clearSlot);
  const sourceKey = (spec: PresentationAudioState) =>
    `${spec.builtin ?? spec.assetId ?? ''}:${spec.cueId ?? ''}`;
  const laneSlots = (transition: boolean) =>
    transition
      ? [[4], [5]]
      : [
          [1, 0],
          [3, 2],
        ];
  const reconcile = (spec: PresentationAudioState, transition: boolean) => {
    if (transition || spec.builtin === 'test-tone') spec = { ...spec, loop: false };
    const slots = laneSlots(transition);
    const belongs = (g: Group) => g.slots[0] >= 4 === transition;
    const current = groups.find(g => belongs(g) && g.retiring === undefined);
    const key = sourceKey(spec);
    if (current && current.key === key && spec.status === 'playing') {
      current.spec = spec;
      return;
    }
    if (current) {
      current.retiring = performance.now();
      current.quick = transition;
      if (spec.status !== 'playing')
        current.spec = {
          ...current.spec,
          fadeOutSeconds:
            spec.fadeOutSeconds ??
            spec.fadeSeconds ??
            current.spec.fadeOutSeconds ??
            current.spec.fadeSeconds,
        };
      if ((current.spec.fadeOutSeconds ?? current.spec.fadeSeconds ?? 1) === 0) {
        release(current);
        if (spec.status === 'stopped')
          current.slots.forEach(i => {
            if (players[i].readyState >= 1) players[i].currentTime = 0;
          });
        groups = groups.filter(g => g !== current);
      }
    }
    if (spec.status !== 'playing' || (!spec.builtin && !spec.assetId)) return;
    const older = groups.filter(g => belongs(g) && g !== current);
    older.forEach(release);
    groups = groups.filter(g => !older.includes(g));
    const free = slots.find(s => !groups.some(g => g.slots[0] === s[0])) ?? slots[0];
    groups.push({ spec, key, slots: free, started: performance.now() });
  };
  const tick = () => {
    if (disposed || activating) return;
    for (const key of failed)
      if (!groups.some(group => key.startsWith(`${group.key}:`))) failed.delete(key);
    if (!allowed || lease <= now()) {
      players.forEach(p => p.pause());
      return;
    }
    for (const group of [...groups]) {
      const transition = group.slots[0] >= 4;
      const spec = group.spec;
      const time = audioPosition(spec, now());
      const builtin = getPresentationBuiltin(spec.builtin);
      const first = players[group.slots[0]];
      const duration = audioDuration(
        spec,
        Number.isFinite(first.duration) ? first.duration : undefined
      );
      const fadeIn = spec.fadeInSeconds ?? spec.fadeSeconds ?? 1;
      const fadeOut = spec.fadeOutSeconds ?? spec.fadeSeconds ?? 1;
      const retiring =
        group.retiring === undefined
          ? 1
          : Math.max(
              0,
              1 -
                (performance.now() - group.retiring) /
                  (Math.max(0.01, group.quick ? Math.min(0.15, fadeOut) : fadeOut) * 1000)
            );
      if (retiring === 0 || time >= duration) {
        release(group);
        groups = groups.filter(g => g !== group);
        continue;
      }
      const envelope = audioEnvelope(time, duration, transition ? fadeIn : 0, fadeOut);
      const ramp =
        transition || !fadeIn
          ? 1
          : Math.min(1, (performance.now() - group.started) / (fadeIn * 1000));
      const voices =
        spec.builtin === 'cinematic-sequence'
          ? presentationSequenceVoices(time, !!spec.loop, spec.sequenceEndPosition).map(v => ({
              url: v.track.url,
              position: v.position,
              gain: v.gain,
            }))
          : [
              {
                url:
                  builtin && 'url' in builtin ? builtin.url : `/api/studio/media/${spec.assetId}`,
                position: time,
                gain: 1,
              },
            ];
      // Match loaded voices first, preserving the outgoing track through sequence overlaps.
      const used = new Set<number>();
      const assigned = voices.map(voice => {
        const index = group.slots.find(i => !used.has(i) && players[i].src.endsWith(voice.url));
        if (index !== undefined) used.add(index);
        return { voice, index };
      });
      for (const entry of assigned) {
        const index = entry.index ?? group.slots.find(i => !used.has(i));
        if (index === undefined) continue;
        used.add(index);
        const player = players[index];
        const { voice } = entry;
        if (!player.src.endsWith(voice.url)) {
          player.pause();
          player.src = voice.url;
          player.load();
          pending.delete(index);
        }
        player.loop =
          spec.builtin !== 'cinematic-sequence' &&
          spec.builtin !== 'test-tone' &&
          !!spec.loop &&
          !transition;
        player.volume = Math.max(
          0,
          Math.min(1, (spec.volume ?? 0.65) * voice.gain * envelope * ramp * retiring)
        );
        if (player.readyState < 1) continue;
        const target =
          player.loop && Number.isFinite(player.duration) && player.duration > 0
            ? voice.position % player.duration
            : voice.position;
        if (player.paused || Math.abs(player.currentTime - target) > 0.3)
          player.currentTime = spec.builtin
            ? target
            : Math.min(target, Number.isFinite(player.duration) ? player.duration : target);
        const failureKey = `${group.key}:${index}`;
        if (player.paused && !pending.has(index) && !failed.has(failureKey)) {
          const attempt = {};
          pending.set(index, attempt);
          void player
            .play()
            .then(() => {
              if (pending.get(index) !== attempt) {
                if (disposed || !allowed || lease <= now()) player.pause();
                return;
              }
              pending.delete(index);
              if (
                disposed ||
                !allowed ||
                lease <= now() ||
                (!groups.includes(group) && !groups.some(g => g.slots.includes(index)))
              )
                player.pause();
              else if (!failed.size) onError(false);
            })
            .catch(error => {
              if (pending.get(index) !== attempt) return;
              pending.delete(index);
              if (disposed || !allowed || lease <= now() || !groups.includes(group)) return;
              failed.add(failureKey);
              onError(true, classifyPresentationAudioFailure(error));
            });
        }
      }
      if (spec.builtin === 'cinematic-sequence' && voices.length === 1) {
        const next = presentationSequenceVoices(
          time + 5,
          !!spec.loop,
          spec.sequenceEndPosition
        ).find(v => v.track.url !== voices[0].url);
        const index = group.slots.find(i => !used.has(i));
        if (next && index !== undefined) {
          used.add(index);
          const player = players[index];
          player.pause();
          player.volume = 0;
          if (!player.src.endsWith(next.track.url)) {
            player.src = next.track.url;
            player.load();
          }
        }
      }
      group.slots.filter(i => !used.has(i)).forEach(clearSlot);
    }
  };
  const mediaError = () => {
    if (!disposed) onError(true, 'media');
  };
  players.forEach(p => {
    p.addEventListener('loadedmetadata', tick);
    p.addEventListener('error', mediaError);
  });
  const timer = setInterval(tick, 100);
  window.addEventListener('focus', tick);
  document.addEventListener('visibilitychange', tick);
  return {
    async activate() {
      activating = true;
      try {
        await Promise.all(
          players.map(async player => {
            // Keep this unmuted: a muted probe can succeed while audible playback is blocked.
            player.volume = 1;
            player.src =
              'data:audio/wav;base64,UklGRiUAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQEAAACA';
            await player.play();
            player.pause();
            if (disposed) player.src = '';
          })
        );
      } finally {
        activating = false;
      }
    },
    update(next: ShowState['audio'], enabled: boolean, clockOffset = 0, leaseUntil = Infinity) {
      audio = next;
      offset = clockOffset;
      lease = leaseUntil;
      allowed = enabled;
      if (!allowed) {
        failed.clear();
        groups.forEach(release);
        groups = [];
      } else {
        reconcile(audio, false);
        reconcile(audio.transition ?? {}, true);
      }
      tick();
    },
    dispose() {
      disposed = true;
      clearInterval(timer);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', tick);
      players.forEach(player => {
        player.removeEventListener('loadedmetadata', tick);
        player.removeEventListener('error', mediaError);
        player.pause();
        player.src = '';
      });
      groups = [];
    },
  };
}
