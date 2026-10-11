import type { FrameNode, StudioNode } from './document-v3';

export const INTRO_CYCLE_MS = 90_000;
export const defaultEventIntro = { mode: 'spatial', assetId: null, intensity: 0.45 } as const;

export function frameIntro(frame: FrameNode): FrameNode['intro'] {
  return frame.intro ?? (frame.eventSource?.template === 'cover' ? defaultEventIntro : undefined);
}

/** Absolute time, rather than accumulated deltas, keeps long-running screens in step. */
export function introElapsed(intro: NonNullable<FrameNode['intro']>, now = Date.now()) {
  return (intro.snapshotAt ?? now) - (intro.epochMs ?? 0);
}
export function introPhase(elapsedMs: number) {
  return (((elapsedMs % INTRO_CYCLE_MS) + INTRO_CYCLE_MS) % INTRO_CYCLE_MS) / INTRO_CYCLE_MS;
}

/** Keep every document asset reference in one place, including background videos. */
export function studioNodeAssetIds(node: StudioNode): string[] {
  if (node.type === 'media') return [node.assetId];
  if (node.type === 'chart' && node.sourceAssetId) return [node.sourceAssetId];
  if (node.type === 'frame' && node.intro?.mode === 'video' && node.intro.assetId)
    return [node.intro.assetId];
  return [];
}
