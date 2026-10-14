import { expect, it } from 'vitest';
import { presentationCommandSchema } from '../presentation-schema';
import {
  liveBindingSchema,
  showCueSchema,
} from '@/features/communication-studio/logic/live-contract';
it('validates entity bindings and bounded shared show commands and music cues', () => {
  const id = crypto.randomUUID();
  expect(
    liveBindingSchema.parse({ sourceId: id, sourceType: 'vote', field: 'results' }).format
  ).toBe('text');
  expect(
    showCueSchema.safeParse({ id, frameId: id, assetId: id, trigger: 'final', volume: 2 }).success
  ).toBe(false);
  expect(
    presentationCommandSchema.parse({
      operationId: id,
      eventId: id,
      deviceId: id,
      action: 'control',
      audio: { status: 'paused' },
    }).audio
  ).toEqual({ status: 'paused' });
  expect(
    presentationCommandSchema.safeParse({
      operationId: id,
      eventId: id,
      deviceId: id,
      action: 'control',
      audio: { status: 'playing', volume: 2 },
    }).success
  ).toBe(false);
});
it('accepts only the bundled test tone and rejects ambiguous or arbitrary built-in audio sources', () => {
  const id = crypto.randomUUID();
  const input = { operationId: id, eventId: id, deviceId: id, action: 'control' };
  expect(
    presentationCommandSchema.parse({
      ...input,
      audio: { builtin: 'test-tone', status: 'playing' },
    }).audio
  ).toEqual({ builtin: 'test-tone', status: 'playing' });
  expect(
    presentationCommandSchema.safeParse({
      ...input,
      audio: { builtin: 'https://example.com/audio', status: 'playing' },
    }).success
  ).toBe(false);
  expect(
    presentationCommandSchema.safeParse({
      ...input,
      audio: { builtin: 'test-tone', assetId: id, status: 'playing' },
    }).success
  ).toBe(false);
});
