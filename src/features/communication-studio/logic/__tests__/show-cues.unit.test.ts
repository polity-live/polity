import { expect, it } from 'vitest';
import { showCueSchema } from '../live-contract';
import { audioEnvelope, cueChannel, cueFadeIn, cueFadeOut, conflictingCue } from '../show-cues';
import { createEventTemplate } from '../event-templates';
import { applyStudioCommandV3 } from '../commands-v3';
import { createStudioV3ClipboardPayload, pasteStudioV3Clipboard } from '../studio-clipboard';

const frameId = crypto.randomUUID();
const legacy = {
  id: crypto.randomUUID(),
  frameId,
  trigger: 'enter',
  builtin: 'cinematic-sequence',
  action: 'play',
  volume: 0.9,
  loop: true,
  fadeSeconds: 2,
};
it('retains legacy settings and validates independent global transition rules', () => {
  const cue = showCueSchema.parse(legacy);
  expect(cueChannel(cue)).toBe('music');
  expect(cueFadeIn(cue)).toBe(2);
  expect(cueFadeOut(cue)).toBe(2);
  expect(cue).toEqual(legacy);
  const global = showCueSchema.parse({
    ...legacy,
    channel: 'transition',
    scope: 'global',
    frameId: undefined,
    durationSeconds: 3,
  });
  expect(global.loop).toBe(false);
  expect(showCueSchema.safeParse({ ...global, channel: 'music' }).success).toBe(false);
  expect(showCueSchema.safeParse({ ...global, trigger: 'final' }).success).toBe(false);
  expect(showCueSchema.safeParse({ ...legacy, assetId: crypto.randomUUID() }).success).toBe(false);
  expect(showCueSchema.safeParse({ ...legacy, builtin: undefined, action: 'pause' }).success).toBe(
    true
  );
  expect(showCueSchema.safeParse({ ...legacy, builtin: undefined, action: 'play' }).success).toBe(
    false
  );
});
it('scales both fades for short clips and ends rather than repeating a transition', () => {
  expect(audioEnvelope(0, 3, 1, 1)).toBe(0);
  expect(audioEnvelope(0.5, 3, 1, 1)).toBe(0.5);
  expect(audioEnvelope(1.5, 3, 1, 1)).toBe(1);
  expect(audioEnvelope(2.5, 3, 1, 1)).toBe(0.5);
  expect(audioEnvelope(3, 3, 1, 1)).toBe(0);
  expect(audioEnvelope(0.5, 2, 5, 5)).toBe(0.5);
  expect(audioEnvelope(1, 2, 5, 5)).toBe(1);
});
it('identifies duplicates by channel, scope and trigger, preserving local overrides', () => {
  const cue = showCueSchema.parse(legacy);
  const transition = showCueSchema.parse({
    ...legacy,
    id: crypto.randomUUID(),
    channel: 'transition',
  });
  expect(conflictingCue([cue], transition)).toBeUndefined();
  const duplicate = { ...cue, id: crypto.randomUUID() };
  expect(conflictingCue([cue], duplicate)).toBe(cue);
});
it('copies local rules with frames and retains exactly one global rule', () => {
  let doc = createEventTemplate('cover', crypto.randomUUID());
  const source = doc.nodes[0].id;
  if (doc.nodes[0].type === 'frame') delete doc.nodes[0].eventSource;
  const local = showCueSchema.parse({ ...legacy, frameId: source });
  const global = showCueSchema.parse({
    ...legacy,
    id: crypto.randomUUID(),
    frameId: undefined,
    channel: 'transition',
    scope: 'global',
  });
  doc.show!.cues = [local, global];
  doc = applyStudioCommandV3(doc, { type: 'duplicateNodes', nodeIds: [source] });
  const copy = doc.nodes.find(n => n.type === 'frame' && n.id !== source)!;
  expect(doc.show!.cues.filter(c => c.frameId === copy.id)).toHaveLength(1);
  expect(doc.show!.cues.filter(c => c.scope === 'global')).toEqual([global]);
  doc = applyStudioCommandV3(doc, { type: 'deleteNodes', nodeIds: [copy.id] });
  expect(doc.show!.cues).toEqual([local, global]);
  const payload = createStudioV3ClipboardPayload({
    document: doc,
    projectId: 'project',
    selectedNodeIds: [source],
  })!;
  expect(payload.cues).toEqual([local]);
  const pasted = pasteStudioV3Clipboard({
    document: doc,
    projectId: 'project',
    payload,
    targetFrameId: null,
  });
  expect(pasted.document.show!.cues).toHaveLength(3);
  expect(pasted.document.show!.cues.filter(c => c.scope === 'global')).toHaveLength(1);
});
