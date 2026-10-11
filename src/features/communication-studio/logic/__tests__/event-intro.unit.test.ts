import { expect, it } from 'vitest';
import { createEventTemplate } from '../event-templates';
import { frameNodeSchema } from '../document-v3';
import { frameIntro, introElapsed, introPhase, studioNodeAssetIds } from '../event-intro';
import { countdownText, projectLiveDocument } from '../live-projection';
import { createLiveSnapshot } from '../live-snapshot';

const event = crypto.randomUUID();
it('keeps a seamless 90-second phase after a day and validates background configuration', () => {
  const frame = createEventTemplate('cover', event).nodes[0];
  if (frame.type !== 'frame') throw new Error('cover');
  expect(frame.intro?.mode).toBe('spatial');
  expect(frame.showAnimation?.preset).toBe('none');
  expect(frame.duration).toBe(5);
  expect(introPhase(0)).toBe(introPhase(90000));
  expect(introPhase(-1000)).toBeCloseTo(introPhase(89000));
  for (let hour = 0; hour <= 24; hour++) expect(introPhase(hour * 3600000 + 45000)).toBe(0.5);
  expect(
    frameNodeSchema.safeParse({ ...frame, intro: { mode: 'spatial', intensity: 2 } }).success
  ).toBe(false);
  expect(frameNodeSchema.safeParse({ ...frame, intro: { mode: 'unknown' } }).success).toBe(false);
  for (const scene of ['architecture', 'democracy-illustrated', 'democracy-sculptural']) {
    const parsed = frameNodeSchema.parse(
      JSON.parse(JSON.stringify({ ...frame, intro: { ...frame.intro, scene } }))
    );
    expect(parsed.intro?.scene).toBe(scene);
  }
  expect(frameNodeSchema.safeParse({ ...frame, intro: { scene: 'unknown' } }).success).toBe(false);
  delete frame.intro;
  expect(frameIntro(frame)?.mode).toBe('spatial');
});
it('freezes the intro and live countdown without changing editable cover content or layout', () => {
  const doc = createEventTemplate('cover', event);
  const canonical = JSON.stringify(doc);
  const epoch = 1800000000000;
  const sources = [
    {
      source_type: 'event' as const,
      source_id: event,
      payload: { start_time: epoch, title: 'An exceptionally long event title '.repeat(8) },
    },
  ];
  for (const remaining of [90000, 7200000, 90000000]) {
    const projected = projectLiveDocument(doc, sources, { now: epoch - remaining });
    const frame = projected.nodes[0];
    expect(frame.type === 'frame' && frame.intro?.epochMs).toBe(epoch);
    const counter = projected.nodes.find(n => n.liveBinding?.field === 'countdown');
    expect(counter?.type === 'richText' && counter.content[0].children[0]).toMatchObject({
      text: countdownText(epoch, epoch - remaining),
    });
  }
  expect(countdownText(epoch, epoch - 90000000)).toBe('1d 01:00:00');
  const snapshot = createLiveSnapshot(doc, sources, {
    now: epoch + 12000,
    portrait: true,
  }).document;
  const frame = snapshot.nodes[0];
  expect(frame.type === 'frame' && frame.intro).toMatchObject({
    epochMs: epoch,
    snapshotAt: epoch + 12000,
  });
  expect(frame.type === 'frame' && introElapsed(frame.intro!, epoch + 86400000)).toBe(12000);
  expect(frame.transform).toMatchObject({ width: 1080, height: 1920 });
  expect(
    snapshot.nodes.some(
      n =>
        n.type === 'richText' &&
        n.content[0].children.some(c => 'text' in c && c.text === 'Starting soon')
    )
  ).toBe(true);
  expect(snapshot.nodes.every(n => !n.liveBinding && !n.showAnimation)).toBe(true);
  expect(JSON.stringify(doc)).toBe(canonical);
});
it('includes only an active background video in document asset references', () => {
  const frame = createEventTemplate('cover', event).nodes[0];
  if (frame.type !== 'frame') throw new Error('cover');
  const asset = crypto.randomUUID();
  frame.intro = { mode: 'video', intensity: 0.45, assetId: asset };
  expect(studioNodeAssetIds(frame)).toEqual([asset]);
  frame.intro.mode = 'static';
  expect(studioNodeAssetIds(frame)).toEqual([]);
});
