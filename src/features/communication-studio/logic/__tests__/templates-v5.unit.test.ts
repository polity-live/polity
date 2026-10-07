import { describe, expect, it } from 'vitest';
import { defaultBrand } from '../document';
import { studioDocumentV5Schema } from '../document-v3';
import { createStudioTemplateDocumentV5 } from '../templates-v5';

describe('Durable Studio starter templates', () => {
  it.each([
    ['single', 1, 'portrait', 'single'],
    ['event', 1, 'portrait', 'single'],
    ['carousel', 5, 'portrait', 'carousel'],
    ['story', 3, 'story', 'story'],
    ['video', 5, 'story', 'video'],
    ['presentation', 3, 'widescreen', 'presentation'],
  ] as const)(
    'creates %s as %i persistent %s frames with a %s deliverable',
    (kind, count, preset, deliverableKind) => {
      const document = createStudioTemplateDocumentV5(kind, 'Starter', defaultBrand);
      expect(studioDocumentV5Schema.parse(document)).toEqual(document);
      const frames = document.nodes.filter(node => node.type === 'frame');
      expect(frames).toHaveLength(count);
      expect(frames.every(frame => frame.preset === preset)).toBe(true);
      expect(document.deliverables).toHaveLength(1);
      expect(document.deliverables[0]).toMatchObject({
        kind: deliverableKind,
        frameIds: frames.map(frame => frame.id),
        channel: kind === 'presentation' ? 'custom' : 'instagram',
      });
      if (count > 1) expect(frames.at(-1)?.name).toBe('Gemeinsam den nächsten Schritt gehen');
      if (count > 3) expect(frames[2].name).toBe('Starter · 3');
      expect(document.frameDefaults.background).toBe(defaultBrand.background);
    }
  );
  it.each([
    'announcement',
    'invitation',
    'editorial',
    'explanation',
    'quote',
    'checklist',
    'blank',
  ])('creates a usable %s design while retaining frame metadata', template => {
    const document = createStudioTemplateDocumentV5('single', 'Starter', defaultBrand, 4, template);
    expect(studioDocumentV5Schema.safeParse(document).success).toBe(true);
    const text = document.nodes.filter(node => node.type === 'richText');
    expect(text).toHaveLength(template === 'blank' ? 0 : 3);
    if (template === 'quote') {
      expect(text[1].content[0].children[0]).toMatchObject({ text: '„Starter“' });
      expect(text[1].typography.horizontalAlign).toBe('center');
    }
    if (template === 'explanation')
      expect(text[0].content[0].children[0]).toMatchObject({ text: 'SCHRITT 01' });
    const accent = document.nodes.find(node => node.type === 'shape');
    if (template !== 'blank')
      expect(accent?.transform).toMatchObject({
        width: template === 'explanation' ? 220 : 910,
        height: template === 'invitation' ? 12 : 4,
      });
  });
  it.each(['story', 'single'] as const)(
    'creates positioned logo assets in a %s template without duplicating asset IDs',
    kind => {
      const logoAssetId = crypto.randomUUID();
      const document = createStudioTemplateDocumentV5(kind, 'Logo', {
        ...defaultBrand,
        logoAssetId,
      });
      const images = document.nodes.filter(node => node.type === 'media');
      expect(images).toHaveLength(kind === 'story' ? 3 : 1);
      expect(images.every(node => node.assetId === logoAssetId && node.mediaType === 'image')).toBe(
        true
      );
      expect(images[0].transform).toMatchObject({
        x: 860,
        y: kind === 'story' ? 250 : 70,
        width: 140,
        height: 100,
      });
      expect(new Set(images.map(node => node.id)).size).toBe(images.length);
    }
  );
  it('cycles campaign formats, schedules core posts and stories and wraps the workspace frame grid', () => {
    const document = createStudioTemplateDocumentV5('campaign', 'Campaign', defaultBrand);
    expect(document.deliverables).toHaveLength(20);
    expect(document.deliverables.slice(0, 5).map(post => post.kind)).toEqual([
      'carousel',
      'video',
      'single',
      'story',
      'story',
    ]);
    expect(document.deliverables.slice(0, 5).map(post => post.dayOffset)).toEqual([0, 2, 4, 1, 3]);
    expect(document.deliverables[5]).toMatchObject({ code: 'W2-1', dayOffset: 7 });
    const frames = document.nodes.filter(node => node.type === 'frame');
    expect(frames[4].transform.x).toBe(0);
    expect(frames[4].transform.y).toBeGreaterThan(0);
    expect(frames.slice(0, 3).map(frame => frame.style.fill)).toEqual([
      defaultBrand.foreground,
      defaultBrand.background,
      defaultBrand.background,
    ]);
  });
  it.each([0, 20])(
    'clamps campaign weeks %i while retaining one persistent frame per core post',
    weeks => {
      const document = createStudioTemplateDocumentV5(
        'campaign',
        'Campaign',
        defaultBrand,
        weeks,
        'blank',
        { core: 1, stories: 0 }
      );
      expect(document.deliverables).toHaveLength(weeks === 0 ? 1 : 12);
      expect(document.nodes.every(node => node.type === 'frame')).toBe(true);
    }
  );
  it('caps crowded campaign day offsets at the last day of the week', () => {
    const document = createStudioTemplateDocumentV5(
      'campaign',
      'Campaign',
      defaultBrand,
      1,
      'blank',
      { core: 5, stories: 5 }
    );
    expect(document.deliverables.map(post => post.dayOffset)).toEqual([
      0, 2, 4, 6, 6, 1, 3, 5, 6, 6,
    ]);
  });
  it('rejects an empty title before creating persistent starter content', () => {
    expect(() => createStudioTemplateDocumentV5('single', '', defaultBrand)).toThrow();
  });
});
