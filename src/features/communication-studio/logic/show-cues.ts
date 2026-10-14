import type { ShowCue, PresentationAudioState } from './live-contract';
import { getPresentationBuiltin } from './presentation-audio';

export const cueChannel = (cue: ShowCue) => cue.channel ?? 'music';
export const cueScope = (cue: ShowCue) => cue.scope ?? 'frame';
export const cueFadeIn = (cue: ShowCue) => cue.fadeInSeconds ?? cue.fadeSeconds;
export const cueFadeOut = (cue: ShowCue) => cue.fadeOutSeconds ?? cue.fadeSeconds;
export function cueConflictKey(cue: ShowCue) {
  return `${cueChannel(cue)}:${cueScope(cue)}:${cueScope(cue) === 'global' ? '' : cue.frameId}:${cue.trigger}`;
}
export function conflictingCue(cues: ShowCue[], cue: ShowCue) {
  return cues.find(other => other.id !== cue.id && cueConflictKey(other) === cueConflictKey(cue));
}
/** Blend lengths are scaled together if the sound is shorter than their sum. */
export function audioEnvelope(position: number, duration: number, fadeIn: number, fadeOut: number) {
  if (position < 0 || position >= duration) return 0;
  const scale = Math.min(1, duration / Math.max(0.000001, fadeIn + fadeOut));
  const enter = fadeIn * scale;
  const leave = fadeOut * scale;
  return Math.max(
    0,
    Math.min(1, enter ? position / enter : 1, leave ? (duration - position) / leave : 1)
  );
}
export function audioPosition(spec: PresentationAudioState, now: number) {
  return (
    (spec.position ?? 0) +
    (spec.status === 'playing' ? Math.max(0, (now - (spec.at ?? now)) / 1000) : 0)
  );
}
export function audioDuration(spec: PresentationAudioState, mediaDuration?: number) {
  const sourceDuration =
    getPresentationBuiltin(spec.builtin)?.duration ?? mediaDuration ?? Infinity;
  return Math.min(
    spec.durationSeconds ?? Infinity,
    spec.loop ? Infinity : (spec.sequenceEndPosition ?? sourceDuration)
  );
}
