import { expect, it } from 'vitest';
import { canvasElementSchema, type CanvasScene } from '../canvas-schema';
import { element, formats } from '../document';
import { createDocument } from '../templates';
import {
  createFrameNode,
  createStudioDocumentV3,
  framePresetRegistry,
  type StudioNode,
} from '../document-v3';
import {
  frameSize,
  isStudioDocumentV3,
  legacyDocumentToV3,
  legacyFormatSize,
  nativeCanvasNodeId,
  requireStudioDocumentV3,
  semanticElement,
  v3DocumentToLegacy,
} from '../v3-adapter';

function legacyFixture() {
  const document = createDocument('single', 'Adapter boundary');
  document.pages[0].elements = [];
  return document;
}

function sceneElement(
  type: CanvasScene['elements'][number]['type'],
  extras: Record<string, unknown> = {}
) {
  return canvasElementSchema.parse({
    id: crypto.randomUUID(),
    type,
    x: 10,
    y: 20,
    width: 100,
    height: 80,
    angle: 0,
    isDeleted: false,
    ...extras,
  });
}

function nativeFixture(item: CanvasScene['elements'][number]) {
  const legacy = legacyFixture();
  legacy.pages[0].canvas = { version: 1, elements: [item], files: {} };
  const document = legacyDocumentToV3(legacy);
  const node = document.nodes.find(node => node.id !== legacy.pages[0].id)!;
  return { legacy, document, node };
}

it('validates public canonical document boundaries and rejects incomplete records', () => {
  const document = createStudioDocumentV3('Validated');
  expect(isStudioDocumentV3(document)).toBe(true);
  expect(requireStudioDocumentV3(document)).toEqual(document);
  expect(isStudioDocumentV3({ schemaVersion: 3 })).toBe(false);
  expect(() => requireStudioDocumentV3({ schemaVersion: 5 })).toThrow();
});

it.each(Object.keys(formats) as (keyof typeof formats)[])(
  'returns the legacy format dimensions for %s',
  format => {
    expect(legacyFormatSize(format)).toEqual(formats[format]);
  }
);

it('resolves preset dimensions independently of transforms and uses actual dimensions for custom frames', () => {
  const frame = createFrameNode('story');
  frame.transform.width = 900;
  expect(frameSize(frame)).toEqual([
    framePresetRegistry.story.width,
    framePresetRegistry.story.height,
  ]);
  const custom = createFrameNode('custom', {
    transform: { ...frame.transform, width: 713, height: 421 },
  });
  expect(frameSize(custom)).toEqual([713, 421]);
});

it('derives deterministic native canvas IDs scoped to their containing frame', () => {
  const frame = crypto.randomUUID();
  const id = nativeCanvasNodeId(frame, 'external-scene-id');
  expect(nativeCanvasNodeId(frame, 'external-scene-id')).toBe(id);
  expect(nativeCanvasNodeId(crypto.randomUUID(), 'external-scene-id')).not.toBe(id);
  expect(nativeCanvasNodeId(frame, 'other-scene-id')).not.toBe(id);
  expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/);
});

it.each([
  'rectangle',
  'diamond',
  'ellipse',
  'line',
  'arrow',
  'freedraw',
  'text',
  'image',
  'frame',
  'magicframe',
] as const)('imports the native %s canvas record into its canonical node kind', type => {
  const { legacy, node } = nativeFixture(sceneElement(type));
  const expected =
    type === 'frame' || type === 'magicframe'
      ? 'frame'
      : type === 'freedraw'
        ? 'drawing'
        : type === 'text'
          ? 'richText'
          : type === 'image'
            ? 'embed'
            : 'shape';
  expect(node.type).toBe(expected);
  expect(node.parentFrameId).toBe(legacy.pages[0].id);
  expect(node.transform).toMatchObject({ x: 10, y: 20, width: 100, height: 80 });
  if (node.type === 'shape') expect(node.shape).toBe(type);
  if (node.type === 'drawing') expect(node.points).toEqual([]);
  if (node.type === 'embed') expect(node.value).toBe('excalidraw-image');
});

it('imports native geometry, reflected axes, color, opacity, grouping and stroke metadata', () => {
  const outer = crypto.randomUUID(),
    inner = crypto.randomUUID();
  const { node } = nativeFixture(
    sceneElement('arrow', {
      name: 'Imported arrow',
      angle: Math.PI / 2,
      width: 0,
      height: 0,
      scale: [-1, 1],
      backgroundColor: '#ABCDEF',
      strokeColor: '#FEDCBA',
      strokeWidth: 3,
      strokeStyle: 'dotted',
      roughness: 2,
      opacity: 50,
      locked: true,
      groupIds: [outer, inner],
      startArrowhead: 'arrow',
      endArrowhead: 'arrow',
      customData: { polityOrder: 7 },
    })
  );
  expect(node).toMatchObject({
    name: 'Imported arrow',
    locked: true,
    zIndex: 7,
    groupIds: [inner, outer],
    startArrowhead: 'arrow',
    endArrowhead: 'arrow',
    transform: { width: 1, height: 1, rotation: 90, flipX: true, flipY: false },
    style: {
      fill: '#ABCDEF',
      stroke: '#FEDCBA',
      strokeWidth: 3,
      strokeStyle: 'dotted',
      roughness: 2,
      opacity: 0.5,
    },
  });
});

it('uses safe defaults for unsupported native appearance values and filters malformed freehand points', () => {
  const { node } = nativeFixture(
    sceneElement('freedraw', {
      name: '',
      scale: [1, -1],
      backgroundColor: 'transparent',
      strokeColor: 'red',
      strokeWidth: 'invalid',
      strokeStyle: 'invalid',
      roughness: null,
      opacity: null,
      groupIds: ['outer-group', 7],
      points: [[1, 2], [3, 4, 5], null, [6, 'invalid'], [8, 9]],
    })
  );
  expect(node).toMatchObject({
    name: 'freedraw',
    points: [
      [1, 2],
      [8, 9],
    ],
    transform: { flipX: false, flipY: true },
    style: {
      fill: null,
      stroke: null,
      strokeWidth: 0,
      strokeStyle: 'solid',
      roughness: 0,
      opacity: 1,
    },
  });
  expect(node.groupIds).toHaveLength(2);
  expect(node.groupIds.every(id => /^[0-9a-f-]{36}$/.test(id))).toBe(true);
});

it.each(['center', 'right', 'justify'] as const)(
  'imports native text alignment %s and multiline content with durable paragraph IDs',
  align => {
    const source = sceneElement('text', {
      text: 'First\nSecond',
      fontSize: 51,
      lineHeight: 1.7,
      textAlign: align,
      verticalAlign: align === 'center' ? 'middle' : align === 'right' ? 'bottom' : 'invalid',
    });
    const { legacy, document, node } = nativeFixture(source);
    expect(node).toMatchObject({
      typography: {
        fontSize: 51,
        lineHeight: 1.7,
        horizontalAlign: align === 'justify' ? 'left' : align,
        verticalAlign: align === 'center' ? 'middle' : align === 'right' ? 'bottom' : 'top',
      },
    });
    if (node.type !== 'richText') throw new Error('Missing native text');
    expect(node.content.map(block => block.children[0])).toEqual([
      expect.objectContaining({ text: 'First' }),
      expect.objectContaining({ text: 'Second' }),
    ]);
    const second = legacyDocumentToV3(legacy, document).nodes.find(
      candidate => candidate.id === node.id
    );
    expect(second?.type === 'richText' && second.content.map(block => block.id)).toEqual(
      node.content.map(block => block.id)
    );
  }
);

it('falls back to plain native text defaults for missing or malformed optional fields', () => {
  const { node } = nativeFixture(
    sceneElement('text', { text: 4, fontSize: 'invalid', lineHeight: null })
  );
  expect(node).toMatchObject({
    content: [{ children: [{ text: '' }] }],
    typography: { fontSize: 42, lineHeight: 1.2, horizontalAlign: 'left', verticalAlign: 'top' },
  });
});

it.each([
  null,
  [],
  'invalid',
  { polityRoot: false },
  { polityRoot: true, polityNode: 'invalid' },
  { polityRoot: true, polityNode: 3 },
])(
  'handles native root metadata %j without accepting an invalid persistent node identity',
  customData => {
    const { legacy, node } = nativeFixture(sceneElement('rectangle', { customData }));
    expect(node.parentFrameId).toBe(
      customData &&
        !Array.isArray(customData) &&
        typeof customData === 'object' &&
        customData.polityRoot === true
        ? null
        : legacy.pages[0].id
    );
    expect(node.id).toMatch(/^[0-9a-f-]{36}$/);
  }
);

it('retains a valid persistent native root ID and ignores nonnumeric root layer metadata', () => {
  const id = crypto.randomUUID();
  const { node } = nativeFixture(
    sceneElement('rectangle', {
      customData: { polityRoot: true, polityNode: id, polityOrder: 'invalid' },
    })
  );
  expect(node).toMatchObject({ id, parentFrameId: null, zIndex: 0 });
});

it('preserves constraints and palette bindings on a persistent native root across scene updates', () => {
  const id = crypto.randomUUID();
  const source = sceneElement('rectangle', {
    backgroundColor: '#123456',
    strokeColor: '#654321',
    customData: { polityRoot: true, polityNode: id },
  });
  const { legacy, document, node } = nativeFixture(source);
  node.constraints = { horizontal: 'center', vertical: 'bottom' };
  node.style.fillBinding = 'primary';
  node.style.strokeBinding = 'accent';
  const result = legacyDocumentToV3(legacy, document).nodes.find(candidate => candidate.id === id)!;
  expect(result.constraints).toEqual(node.constraints);
  expect(result.style).toMatchObject({ fillBinding: 'primary', strokeBinding: 'accent' });
});

it('parents native records to imported nested frames and keeps attached files in the canonical document', () => {
  const legacy = legacyFixture();
  const frame = sceneElement('frame'),
    text = sceneElement('text', { frameId: frame.id, text: 'Nested' });
  const file = {
    id: 'file',
    mimeType: 'image/png' as const,
    dataURL: 'data:image/png;base64,YQ==',
    created: 1,
  };
  legacy.pages[0].canvas = { version: 1, elements: [frame, text], files: { file } };
  const result = legacyDocumentToV3(legacy);
  const importedFrame = result.nodes.find(node => node.name === 'frame')!;
  const importedText = result.nodes.find(node => node.type === 'richText')!;
  expect(importedText.parentFrameId).toBe(importedFrame.id);
  expect(result.files).toEqual({ file });
});

it('preserves native frame configuration and text-style identity across an imported scene update', () => {
  const legacy = legacyFixture();
  const frame = sceneElement('frame', {
    backgroundColor: '#123456',
    strokeColor: '#654321',
    strokeStyle: 'dashed',
  });
  const text = sceneElement('text', { text: 'Bound native text' });
  legacy.pages[0].canvas = { version: 1, elements: [frame, text], files: {} };
  const previous = legacyDocumentToV3(legacy);
  const oldFrame = previous.nodes.find(
    node => node.type === 'frame' && node.id !== legacy.pages[0].id
  )!;
  if (oldFrame.type !== 'frame') throw new Error('Missing imported frame');
  oldFrame.duration = 9;
  oldFrame.transition = 'fade';
  oldFrame.clipContent = false;
  oldFrame.safeAreas.top = 12;
  oldFrame.grid.size = 13;
  oldFrame.layout.padding = 17;
  oldFrame.style.fillBinding = 'primary';
  oldFrame.style.strokeBinding = 'accent';
  oldFrame.constraints = { horizontal: 'right', vertical: 'bottom' };
  oldFrame.overrides = ['style.stroke'];
  const oldText = previous.nodes.find(node => node.type === 'richText')!;
  if (oldText.type !== 'richText') throw new Error('Missing imported text');
  oldText.textRole = 'body';
  oldText.typography.textStyleId = crypto.randomUUID();
  const result = legacyDocumentToV3(legacy, previous);
  expect(result.nodes.find(node => node.id === oldFrame.id)).toMatchObject({
    duration: 9,
    transition: 'fade',
    clipContent: false,
    safeAreas: { top: 12 },
    grid: { size: 13 },
    layout: { padding: 17 },
    constraints: oldFrame.constraints,
    style: { fillBinding: 'primary', strokeBinding: 'accent' },
    overrides: ['style.stroke'],
  });
  expect(result.nodes.find(node => node.id === oldText.id)).toMatchObject({
    textRole: 'body',
    typography: { textStyleId: oldText.typography.textStyleId },
  });
  legacy.pages[0].canvas.elements[0].backgroundColor = '#ABCDEF';
  legacy.pages[0].canvas.elements[0].strokeColor = '#FEDCBA';
  const changed = legacyDocumentToV3(legacy, previous).nodes.find(node => node.id === oldFrame.id)!;
  expect(changed.style).toMatchObject({ fillBinding: null, strokeBinding: null });
  expect(changed.overrides).toEqual(['style.stroke', 'style.fill']);
});

it.each([false, true])(
  'removes deleted native root records when persistent metadata is %s',
  persistent => {
    const id = crypto.randomUUID();
    const source = sceneElement('rectangle', {
      customData: persistent ? { polityRoot: true, polityNode: id } : { polityRoot: true },
    });
    const { legacy, document, node } = nativeFixture(source);
    legacy.pages[0].canvas!.elements[0].isDeleted = true;
    expect(
      legacyDocumentToV3(legacy, document).nodes.some(candidate => candidate.id === node.id)
    ).toBe(false);
  }
);

it('avoids duplicating a native record that is already represented by a semantic legacy element', () => {
  const legacy = legacyFixture();
  const rect = element('rect');
  legacy.pages[0].elements = [rect];
  legacy.pages[0].canvas = {
    version: 1,
    elements: [sceneElement('rectangle', { id: rect.id })],
    files: {},
  };
  expect(legacyDocumentToV3(legacy).nodes).toHaveLength(2);
});

it.each(['image', 'video'] as const)(
  'rejects a semantic %s element whose referenced media asset is missing',
  type => {
    const legacy = legacyFixture();
    const media = element(type);
    legacy.pages[0].elements = [media];
    expect(() => legacyDocumentToV3(legacy)).toThrow(`Media element ${media.id} has no asset`);
  }
);

it.each(['table', 'chart'] as const)(
  'rejects a legacy %s element whose required typed data is absent',
  type => {
    const legacy = legacyFixture();
    const source = element(type);
    if (type === 'table') source.table = undefined;
    else source.chart = undefined;
    legacy.pages[0].elements = [source];
    expect(() => legacyDocumentToV3(legacy)).toThrow('Element data missing');
  }
);

it('flattens nested text links and retains explicit links without losing visible text or marks', () => {
  const legacy = legacyFixture();
  legacy.pages[0].elements = [
    element('text', {
      text: 'Text',
      bold: true,
      italic: true,
      underline: true,
      strikethrough: true,
    }),
  ];
  const document = legacyDocumentToV3(legacy);
  const node = document.nodes.find(node => node.type === 'richText')!;
  if (node.type !== 'richText') throw new Error('Missing rich text');
  node.content = [
    {
      id: crypto.randomUUID(),
      type: 'p',
      url: 'https://example.org/outer',
      align: 'right',
      list: 'bullet',
      children: [
        {
          id: crypto.randomUUID(),
          text: 'Outer ',
          bold: true,
          italic: true,
          underline: true,
          strikethrough: true,
        },
        {
          id: crypto.randomUUID(),
          type: 'a',
          url: 'https://example.org/inner',
          children: [
            {
              id: crypto.randomUUID(),
              text: 'Inner',
              bold: true,
              italic: true,
              underline: true,
              strikethrough: true,
            },
          ],
        },
      ],
    },
  ];
  const projected = semanticElement(node)!;
  expect(projected.text).toBe('Outer Inner');
  expect(projected).toMatchObject({
    bold: true,
    italic: true,
    underline: true,
    strikethrough: true,
  });
  expect(projected.richText[0]).toMatchObject({
    align: 'right',
    list: 'bullet',
    children: [
      { text: 'Outer ', url: 'https://example.org/outer' },
      { text: 'Inner', url: 'https://example.org/inner' },
    ],
  });
  legacy.pages[0].elements = [projected];
  expect(
    legacyDocumentToV3(legacy, document).nodes.find(candidate => candidate.id === node.id)
  ).toMatchObject({ content: node.content });
});

it('preserves nested group identities and marks manually changed semantic colors as overrides', () => {
  const legacy = legacyFixture();
  const rect = element('rect', { text: '', group: crypto.randomUUID() });
  legacy.pages[0].elements = [rect];
  const previous = legacyDocumentToV3(legacy);
  const node = previous.nodes.find(node => node.id === rect.id)!;
  node.groupIds.push(crypto.randomUUID());
  node.style.fillBinding = 'primary';
  node.style.strokeBinding = 'accent';
  rect.fill = '#ABCDEF';
  rect.stroke = '#FEDCBA';
  const result = legacyDocumentToV3(legacy, previous).nodes.find(
    candidate => candidate.id === rect.id
  )!;
  expect(result.groupIds).toEqual(node.groupIds);
  expect(result.name).toBe('rect');
  expect(result.style).toMatchObject({ fillBinding: null, strokeBinding: null });
  expect(result.overrides).toEqual(['style.fill', 'style.stroke']);
  rect.group = 'imported-non-uuid';
  const updated = legacyDocumentToV3(legacy, previous).nodes.find(
    candidate => candidate.id === rect.id
  )!;
  expect(updated.groupIds).toHaveLength(1);
  expect(updated.groupIds).not.toEqual(node.groupIds);
});

it.each(['diamond', 'rounded-rectangle'] as const)(
  'retains the canonical %s shape when its legacy projection is edited',
  shape => {
    const legacy = legacyFixture();
    const rect = element('rect');
    legacy.pages[0].elements = [rect];
    const previous = legacyDocumentToV3(legacy);
    const node = previous.nodes.find(node => node.id === rect.id)!;
    if (node.type !== 'shape') throw new Error('Missing shape');
    node.shape = shape;
    expect(
      legacyDocumentToV3(legacy, previous).nodes.find(candidate => candidate.id === rect.id)
    ).toMatchObject({ shape });
  }
);

it.each(['audio', 'file'] as const)(
  'leaves canonical %s media outside the supported legacy element projection',
  mediaType => {
    const legacy = legacyFixture();
    legacy.pages[0].elements = [element('image', { assetId: crypto.randomUUID() })];
    const node = legacyDocumentToV3(legacy).nodes.find(node => node.type === 'media')!;
    expect(
      semanticElement({ ...node, mediaType } as StudioNode as Exclude<
        StudioNode,
        { type: 'frame' }
      >)
    ).toBeNull();
  }
);

it('projects long canonical videos only when explicitly permitted and preserves the video deliverable kind', () => {
  const legacy = createDocument('video', 'Long video');
  const document = legacyDocumentToV3(legacy);
  document.nodes
    .filter(node => node.type === 'frame')
    .forEach(node => {
      node.duration = 35;
    });
  expect(() => v3DocumentToLegacy(document)).toThrow();
  const projected = v3DocumentToLegacy(document, { allowLongVideo: true });
  expect(projected.posts[0].kind).toBe('video');
  expect(projected.pages.reduce((duration, frame) => duration + frame.duration, 0)).toBeGreaterThan(
    60
  );
});

it('does not restore a root frame that was deleted from the legacy document without a master layout', () => {
  const legacy = legacyFixture();
  const previous = legacyDocumentToV3(legacy);
  legacy.pages = [];
  legacy.posts = [];
  expect(legacyDocumentToV3(legacy, previous).nodes).toEqual([]);
});

it.each(['table', 'chart', 'ellipse', 'line', 'arrow', 'image', 'video'] as const)(
  'round-trips supported semantic %s content and metadata',
  type => {
    const legacy = legacyFixture();
    const source = element(
      type,
      type === 'image' || type === 'video'
        ? {
            assetId: crypto.randomUUID(),
            text: 'Media alt text',
            cropX: 0.3,
            cropY: 0.7,
            trimStart: 1.5,
            muted: false,
          }
        : {}
    );
    legacy.pages[0].elements = [source];
    const document = legacyDocumentToV3(legacy);
    const projected = v3DocumentToLegacy(document).pages[0].elements[0];
    expect(projected.type).toBe(type);
    expect(projected.id).toBe(source.id);
    if (type === 'table') expect(projected.table).toEqual(source.table);
    if (type === 'chart') expect(projected.chart).toEqual(source.chart);
    if (type === 'image' || type === 'video')
      expect(projected).toMatchObject({
        assetId: source.assetId,
        text: 'Media alt text',
        cropX: 0.3,
        cropY: 0.7,
        trimStart: 1.5,
        muted: false,
      });
  }
);

it('preserves existing run IDs when rich text changes and retains paragraph alignment and lists', () => {
  const legacy = legacyFixture();
  const source = element('text', { text: 'Old text' });
  legacy.pages[0].elements = [source];
  const previous = legacyDocumentToV3(legacy);
  const old = previous.nodes.find(node => node.type === 'richText')!;
  if (old.type !== 'richText') throw new Error('Missing text');
  const runId = old.content[0].children[0].id;
  source.text = 'New text';
  source.richText = [
    {
      id: old.content[0].id,
      type: 'p',
      align: 'center',
      list: 'number',
      children: [{ text: 'New text' }],
    },
  ];
  const result = legacyDocumentToV3(legacy, previous).nodes.find(node => node.id === source.id)!;
  expect(result).toMatchObject({
    content: [{ align: 'center', list: 'number', children: [{ id: runId, text: 'New text' }] }],
  });
  old.content[0].children = [
    {
      id: crypto.randomUUID(),
      type: 'a',
      children: [{ id: crypto.randomUUID(), text: 'Nested old text' }],
    },
  ];
  const nested = legacyDocumentToV3(legacy, previous).nodes.find(node => node.id === source.id)!;
  if (nested.type !== 'richText') throw new Error('Missing changed text');
  expect(nested.content[0].children[0].id).not.toBe(old.content[0].children[0].id);
});

it('rebuilds rich text when its legacy element replaces a different canonical node kind', () => {
  const legacy = legacyFixture();
  const source = element('text', { text: 'Changed node kind' });
  const old = element('rect', { id: source.id });
  legacy.pages[0].elements = [old];
  const previous = legacyDocumentToV3(legacy);
  legacy.pages[0].elements = [source];
  expect(
    legacyDocumentToV3(legacy, previous).nodes.find(node => node.id === source.id)
  ).toMatchObject({ type: 'richText', content: [{ children: [{ text: 'Changed node kind' }] }] });
});

it('inherits nested links and uses legacy fallback colors for canonical null fills and strokes', () => {
  const legacy = legacyFixture();
  legacy.pages[0].elements = [element('text')];
  const node = legacyDocumentToV3(legacy).nodes.find(node => node.type === 'richText')!;
  if (node.type !== 'richText') throw new Error('Missing text');
  node.style.fill = null;
  node.style.stroke = null;
  node.content = [
    {
      id: crypto.randomUUID(),
      type: 'p',
      url: 'https://example.org/parent',
      children: [
        {
          id: crypto.randomUUID(),
          type: 'a',
          children: [{ id: crypto.randomUUID(), text: 'Inherited link' }],
        },
      ],
    },
  ];
  expect(semanticElement(node)).toMatchObject({
    fill: '#12362D',
    stroke: '#12362D',
    text: 'Inherited link',
    richText: [{ children: [{ url: 'https://example.org/parent' }] }],
  });
});

it('projects nested frames, null strokes and stable root ordering without changing the canonical document', () => {
  const document = createStudioDocumentV3('Nested frames');
  const first = createFrameNode('custom', {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'First',
    zIndex: 1,
  });
  const second = createFrameNode('square', {
    id: '00000000-0000-4000-8000-000000000002',
    name: 'Second',
    zIndex: 1,
  });
  const child = createFrameNode('custom', { parentFrameId: first.id, name: 'Child' });
  child.style.stroke = null;
  const grandchild = createFrameNode('custom', { parentFrameId: child.id, name: 'Grandchild' });
  document.nodes = [second, first, child, grandchild];
  const before = structuredClone(document);
  const projected = v3DocumentToLegacy(document);
  expect(projected.pages.map(page => page.name)).toEqual(['First', 'Second']);
  expect(projected.pages[0].format).toBe('square');
  expect(projected.pages[0].canvas?.elements.map(node => node.name)).toEqual([
    'Child',
    'Grandchild',
  ]);
  expect(projected.pages[0].canvas?.elements[0].strokeColor).toBe('#888888');
  expect(document).toEqual(before);
});

it.each(['width', 'height'] as const)(
  'uses the custom legacy format fallback when preset %s no longer matches',
  field => {
    const document = createStudioDocumentV3('Resized preset');
    const frame = createFrameNode('portrait');
    frame.transform[field] += 1;
    document.nodes = [frame];
    expect(v3DocumentToLegacy(document).pages[0].format).toBe('square');
  }
);

it('scales explicit master text run sizes and frame groups while excluding hidden master content', () => {
  const legacy = legacyFixture();
  legacy.pages[0].elements = [element('text', { text: 'Master text' })];
  const document = legacyDocumentToV3(legacy);
  const root = document.nodes.find(node => node.type === 'frame')!;
  const text = document.nodes.find(node => node.type === 'richText')!;
  if (root.type !== 'frame' || text.type !== 'richText') throw new Error('Missing master fixture');
  const master = createFrameNode('square');
  text.parentFrameId = master.id;
  const run = text.content[0].children[0];
  if (!('text' in run)) throw new Error('Missing text run');
  run.fontSize = 24;
  const group = crypto.randomUUID();
  const child = createFrameNode('custom', {
    parentFrameId: master.id,
    groupIds: [group],
    name: 'Master frame',
    transform: { ...root.transform, width: 80, height: 40 },
  });
  const hidden = createFrameNode('custom', {
    parentFrameId: master.id,
    visible: false,
    name: 'Hidden master',
  });
  document.nodes.push(master, child, hidden);
  document.masterLayout = { frameId: master.id, placements: {} };
  const projected = v3DocumentToLegacy(document, { includeMaster: true });
  expect(projected.pages[0].elements[0].richText[0].children[0].fontSize).toBeCloseTo(
    24 *
      Math.min(
        root.transform.width / master.transform.width,
        root.transform.height / master.transform.height
      )
  );
  expect(projected.pages[0].canvas?.elements).toHaveLength(1);
  expect(projected.pages[0].canvas?.elements[0].groupIds).toHaveLength(1);
  const projectedGroups = projected.pages[0].canvas?.elements[0].groupIds as string[] | undefined;
  expect(projectedGroups?.[0]).not.toBe(group);
});

it('retains unprojected descendants inside the canonical master across a legacy transaction', () => {
  const legacy = legacyFixture();
  const previous = legacyDocumentToV3(legacy);
  const master = createFrameNode('square');
  const child = createFrameNode('custom', { parentFrameId: master.id });
  const audioLegacy = legacyFixture();
  audioLegacy.pages[0].elements = [element('image', { assetId: crypto.randomUUID() })];
  const audio = legacyDocumentToV3(audioLegacy).nodes.find(node => node.type === 'media')!;
  if (audio.type !== 'media') throw new Error('Missing audio fixture');
  audio.mediaType = 'audio';
  audio.parentFrameId = child.id;
  previous.nodes.push(master, child, audio);
  previous.masterLayout = { frameId: master.id, placements: {} };
  const result = legacyDocumentToV3(legacy, previous);
  expect(result.nodes.find(node => node.id === audio.id)).toEqual(audio);
  expect(result.nodes.find(node => node.id === child.id)).toEqual(child);
});

it('retains imported nested scene nodes without duplicating their preserved canonical descendants', () => {
  const legacy = legacyFixture();
  const frame = sceneElement('frame');
  const drawing = sceneElement('freedraw', {
    frameId: frame.id,
    points: [
      [1, 2],
      [3, 4],
    ],
  });
  legacy.pages[0].canvas = { version: 1, elements: [frame, drawing], files: {} };
  const previous = legacyDocumentToV3(legacy);
  expect(legacyDocumentToV3(legacy, previous).nodes).toEqual(previous.nodes);
});

it('keeps short videos and nonvideo deliverables unchanged when long-video compatibility is enabled', () => {
  for (const kind of ['video', 'single'] as const) {
    const document = legacyDocumentToV3(createDocument(kind, 'Short export'));
    expect(v3DocumentToLegacy(document, { allowLongVideo: true }).posts[0].kind).toBe(kind);
  }
});

it('rejects a legacy video projection that references a nested frame outside the exported page list', () => {
  const document = legacyDocumentToV3(createDocument('video', 'Nested video'));
  const root = document.nodes.find(node => node.type === 'frame')!;
  const nested = createFrameNode('custom', { parentFrameId: root.id });
  document.nodes.push(nested);
  document.deliverables[0].frameIds = [nested.id];
  expect(() => v3DocumentToLegacy(document, { allowLongVideo: true })).toThrow();
});
