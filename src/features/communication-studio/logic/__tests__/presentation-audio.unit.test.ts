import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { showCueSchema } from '../live-contract';
import { studioDocumentV3Schema } from '../document-v3';
import { createEventTemplate } from '../event-templates';
import { presentationCommandSchema } from '@/zero/communication-studio/presentation-schema';
import {
  getPresentationBuiltin,
  normalizePresentationAudioPosition,
  parsePresentationBuiltinSelection,
  presentationMusic,
  presentationMusicCredits,
  presentationSequence,
  presentationSequenceVoices,
  presentationSequenceEnd,
} from '../presentation-audio';

it('ships original music with verified bytes, complete attribution and only allowlisted local sources', () => {
  const hashes = [
    'c270fb44a69828f6cae7412e077a38b92d55015d30ced549d0d477f864e7e41e',
    '8243572fc2e082252f5286692d639906799eacd1586f55866a42f60d91c4a569',
    'b410a6e67dfd23868ac3a4f892226ef2d0933b7846d66f8d8472377a1fde36a5',
  ];
  presentationMusic.forEach((track, index) => {
    expect(
      createHash('sha256')
        .update(readFileSync(`public${track.url}`))
        .digest('hex')
    ).toBe(hashes[index]);
    expect(track.duration).toBeGreaterThan(200);
    expect(getPresentationBuiltin(track.id)).toBe(track);
    expect(parsePresentationBuiltinSelection(`builtin:${track.id}`)).toBe(track.id);
    expect(presentationMusicCredits()).toContain(track.title);
    expect(presentationMusicCredits()).toContain(track.source);
  });
  expect(presentationMusicCredits()).toContain('Kevin MacLeod');
  expect(presentationMusicCredits()).toContain('https://creativecommons.org/licenses/by/4.0/');
  expect(parsePresentationBuiltinSelection('builtin:unknown')).toBeUndefined();
  expect(parsePresentationBuiltinSelection('cinematic-hope')).toBeUndefined();
  expect(getPresentationBuiltin('unknown')).toBeUndefined();
  expect(getPresentationBuiltin('test-tone')?.duration).toBe(3);
});

it('validates exclusive cue sources and preserves integrated cues when saving, copying and reopening', () => {
  const doc = createEventTemplate('cover', crypto.randomUUID());
  const cue = { id: crypto.randomUUID(), frameId: doc.nodes[0].id, trigger: 'enter' as const };
  for (const track of [...presentationMusic, presentationSequence]) {
    const parsed = showCueSchema.parse({ ...cue, builtin: track.id });
    expect(parsed.assetId).toBeUndefined();
    expect(parsed).toMatchObject({ builtin: track.id, volume: 0.65, fadeSeconds: 1, loop: true });
    doc.show!.cues = [parsed];
    const copy = structuredClone(studioDocumentV3Schema.parse(JSON.parse(JSON.stringify(doc))));
    expect(studioDocumentV3Schema.parse(copy).show?.cues).toEqual([parsed]);
  }
  expect(showCueSchema.safeParse(cue).success).toBe(false);
  expect(showCueSchema.safeParse({ ...cue, builtin: 'unknown' }).success).toBe(false);
  expect(
    showCueSchema.safeParse({ ...cue, builtin: 'cinematic-hope', assetId: crypto.randomUUID() })
      .success
  ).toBe(false);
  expect(showCueSchema.parse({ ...cue, assetId: crypto.randomUUID() }).loop).toBe(false);
  const command = {
    operationId: crypto.randomUUID(),
    eventId: crypto.randomUUID(),
    deviceId: crypto.randomUUID(),
    action: 'control',
  };
  expect(
    presentationCommandSchema.safeParse({
      ...command,
      audio: { status: 'paused', position: 172800 },
    }).success
  ).toBe(true);
  expect(
    presentationCommandSchema.safeParse({
      ...command,
      audio: { status: 'playing', builtin: 'unknown' },
    }).success
  ).toBe(false);
});

it('retains loop phase across days and bounds completed one-shot audio without changing upload positions', () => {
  for (const track of presentationMusic) {
    for (const cycles of [0, 1, 1000, 10000]) {
      expect(
        normalizePresentationAudioPosition(
          { builtin: track.id, loop: true },
          track.duration * cycles + 12
        )
      ).toBeCloseTo(12, 7);
    }
    expect(normalizePresentationAudioPosition({ builtin: track.id }, 86401)).toBe(track.duration);
  }
  expect(normalizePresentationAudioPosition({ builtin: 'test-tone', loop: true }, 100)).toBe(3);
  expect(normalizePresentationAudioPosition({}, 172800)).toBe(172800);
  expect(normalizePresentationAudioPosition({}, -1)).toBe(0);
});

it('resolves all sequence transitions and daily loop positions without restarting the first pass', () => {
  const sequence = presentationSequence;
  expect(sequence.tracks.map(track => track.id)).toEqual([
    'cinematic-atmosphere',
    'cinematic-thriller',
    'cinematic-hope',
  ]);
  expect(sequence.duration).toBeCloseTo(748.604399);
  expect(presentationSequenceVoices(0, true).map(v => v.track.id)).toEqual([
    'cinematic-atmosphere',
  ]);
  const boundaries = [
    sequence.tracks[0].duration - 3,
    sequence.tracks[0].duration + sequence.tracks[1].duration - 6,
    sequence.cycleDuration,
  ];
  for (const [index, boundary] of boundaries.entries()) {
    const mix = presentationSequenceVoices(boundary + 1.5, true);
    expect(mix.map(v => v.track.id)).toEqual([
      sequence.tracks[index].id,
      sequence.tracks[(index + 1) % 3].id,
    ]);
    expect(mix.map(v => v.gain)).toEqual([expect.closeTo(0.5, 6), expect.closeTo(0.5, 6)]);
  }
  for (const cycle of [1, 1000, 10000]) {
    const position = cycle * sequence.cycleDuration + 40;
    expect(normalizePresentationAudioPosition({ builtin: sequence.id, loop: true }, position)).toBe(
      position
    );
    const mix = presentationSequenceVoices(position, true);
    expect(mix).toHaveLength(1);
    expect(mix[0].position).toBeCloseTo(40, 6);
  }
});

it('finishes the current sequence after disabling repetition, including during the wrap overlap', () => {
  for (const position of [
    20,
    presentationSequence.cycleDuration - 1,
    presentationSequence.cycleDuration + 1.5,
    172800,
  ]) {
    const end = presentationSequenceEnd(position);
    expect(
      presentationSequenceVoices(position, false, end).map(v => [v.track.id, v.position, v.gain])
    ).toEqual(
      presentationSequenceVoices(position, true).map(v => [v.track.id, v.position, v.gain])
    );
    const last = presentationSequenceVoices(end - 0.1, false, end);
    expect(last).toHaveLength(1);
    expect(last[0].track.id).toBe('cinematic-hope');
    expect(last[0].gain).toBe(1);
    expect(presentationSequenceVoices(end, false, end)).toEqual([]);
  }
  expect(presentationSequenceVoices(presentationSequence.duration, false)).toEqual([]);
});
