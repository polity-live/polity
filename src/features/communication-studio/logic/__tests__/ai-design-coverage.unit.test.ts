import { expect, it } from 'vitest';
import {
  compileStudioAiPlan,
  fitStudioAiThemeText,
  studioAiPlanSchema,
  type StudioAiLibrary,
} from '../ai-design';
import {
  createFrameNode,
  createStudioDocumentV5,
  richTextNodeSchema,
  shapeNodeSchema,
  mediaNodeSchema,
  type StudioDocumentV5,
  type StudioNode,
} from '../document-v3';
import { activePalette } from '../theme';
import { createStudioNodeFromElement } from '../create-studio-node';
import { element } from '../document';

const bounds = { x: 0.1, y: 0.1, width: 0.5, height: 0.2 };
function fixture() {
  const document = createStudioDocumentV5('Existing', 'single');
  const frame = createFrameNode('square');
  const text = richTextNodeSchema.parse({
    id: crypto.randomUUID(),
    type: 'richText',
    name: 'Selected text',
    zIndex: 0,
    style: { fill: '#12362D', stroke: null, strokeWidth: 0, opacity: 1 },
    parentFrameId: frame.id,
    transform: { x: 100, y: 100, width: 700, height: 300 },
    content: [
      {
        id: crypto.randomUUID(),
        type: 'p',
        children: [{ id: crypto.randomUUID(), text: 'Original', bold: true, fontSize: 48 }],
      },
    ],
    typography: { fontSize: 48 },
  });
  const shape = shapeNodeSchema.parse({
    id: crypto.randomUUID(),
    type: 'shape',
    shape: 'rectangle',
    name: 'Selected shape',
    zIndex: 0,
    style: { fill: '#12362D', stroke: null, strokeWidth: 0, opacity: 1 },
    parentFrameId: frame.id,
    transform: { x: 100, y: 500, width: 100, height: 100 },
  });
  const media = mediaNodeSchema.parse({
    id: crypto.randomUUID(),
    type: 'media',
    mediaType: 'image',
    name: 'Selected media',
    zIndex: 0,
    style: { fill: null, stroke: null, strokeWidth: 0, opacity: 1 },
    assetId: crypto.randomUUID(),
    parentFrameId: frame.id,
    transform: { x: 300, y: 500, width: 100, height: 100 },
  });
  document.nodes.push(frame, text, shape, media);
  return { document, frame, text, shape, media };
}
function compile(
  document: StudioDocumentV5,
  raw: unknown,
  options: Partial<Parameters<typeof compileStudioAiPlan>[0]> = {}
) {
  return compileStudioAiPlan({
    document,
    plan: studioAiPlanSchema.parse(raw),
    mode: 'free',
    format: 'square',
    kind: 'single',
    allowedNodeIds: new Set(),
    assetIds: new Set(),
    ...options,
  });
}
function selected() {
  const value = fixture();
  return {
    ...value,
    options: {
      allowedNodeIds: new Set([value.text.id, value.shape.id, value.media.id]),
      allowedFrameIds: new Set([value.frame.id]),
    },
  };
}

it.each(['text', 'box', 'color', 'size'] as const)(
  'accepts a patch with only %s and rejects an empty patch',
  field => {
    const values = { text: 'Changed', box: bounds, color: 'accent', size: 36 };
    expect(
      studioAiPlanSchema.safeParse({
        title: 'Patch',
        edits: [{ nodeId: crypto.randomUUID(), [field]: values[field] }],
      }).success
    ).toBe(true);
    expect(
      studioAiPlanSchema.safeParse({ title: 'Patch', edits: [{ nodeId: crypto.randomUUID() }] })
        .success
    ).toBe(false);
  }
);

it('rejects an empty design, mixed creation and edits, and creation during a selected edit', () => {
  const { document, text } = fixture();
  expect(() => compile(document, { title: 'Empty' })).toThrow('empty design');
  expect(() =>
    compile(document, {
      title: 'Mixed',
      frames: [{ headline: 'New' }],
      edits: [{ nodeId: text.id, text: 'Changed' }],
    })
  ).toThrow('mixed');
  expect(() =>
    compile(
      document,
      { title: 'Selected', frames: [{ headline: 'New' }] },
      { allowedNodeIds: new Set([text.id]) }
    )
  ).toThrow('existing nodes');
  expect(() =>
    compile(document, { title: 'Two', frames: [{ headline: 'First' }, { headline: 'Second' }] })
  ).toThrow('one frame');
  expect(() =>
    studioAiPlanSchema.parse({
      title: 'Too many',
      frames: Array.from({ length: 11 }, () => ({ headline: 'New' })),
    })
  ).toThrow();
});

it.each(['foreground', 'accent', 'muted'] as const)(
  'creates free text with the %s palette binding and matching color',
  color => {
    const document = createStudioDocumentV5('Empty', 'single');
    const result = compile(document, {
      title: 'New',
      frames: [
        {
          elements: [
            {
              kind: 'text',
              text: 'Alpha beta\nLongunbrokenwordforwrapping',
              box: { ...bounds, height: 0.5 },
              color,
              size: 32,
            },
          ],
        },
      ],
    });
    const node = result.nodes.find(node => node.type === 'richText')!;
    expect(node.type).toBe('richText');
    const role =
      color === 'accent'
        ? 'accentForeground'
        : color === 'muted'
          ? 'mutedForeground'
          : 'foreground';
    expect(node.style).toMatchObject({
      fillBinding: role,
      fill: activePalette(document.theme)[role],
    });
    expect(result.title).toBe('New');
    expect(document.nodes).toEqual([]);
  }
);

it.each(['foreground', 'accent', 'muted'] as const)(
  'creates filled and outlined %s shapes without painting line interiors',
  color => {
    const result = compile(createStudioDocumentV5('Empty', 'single'), {
      title: 'Shapes',
      frames: [
        {
          elements: ['rectangle', 'line', 'arrow'].map(shape => ({
            kind: 'shape',
            shape,
            color,
            box: bounds,
          })),
        },
      ],
    });
    const nodes = result.nodes.filter(node => node.type === 'shape');
    expect(nodes[0].style).toMatchObject({ fillBinding: color, stroke: null, strokeWidth: 0 });
    for (const node of nodes.slice(1))
      expect(node.style).toMatchObject({
        fill: null,
        fillBinding: null,
        strokeBinding: color,
        strokeWidth: 6,
      });
  }
);

it.each([
  { x: 0, y: 0, width: 0, height: 0.1 },
  { x: 0, y: 0, width: 0.1, height: 0 },
  { x: 0.9, y: 0, width: 0.2, height: 0.1 },
  { x: 0, y: 0.9, width: 0.1, height: 0.2 },
])('rejects elements outside the safe area %j', box => {
  expect(() =>
    compile(createStudioDocumentV5('Empty', 'single'), {
      title: 'Invalid',
      frames: [{ elements: [{ kind: 'shape', shape: 'rectangle', box }] }],
    })
  ).toThrow('safe area');
});

it('requires explicit free elements, authorized media and a known library revision', () => {
  const document = createStudioDocumentV5('Empty', 'single');
  expect(() => compile(document, { title: 'Empty', frames: [{}] })).toThrow('explicit elements');
  expect(() =>
    compile(document, {
      title: 'Media',
      frames: [{ elements: [{ kind: 'media', assetId: crypto.randomUUID(), box: bounds }] }],
    })
  ).toThrow('unavailable media');
  expect(() =>
    compile(document, {
      title: 'Library',
      frames: [{ elements: [{ kind: 'library', setId: crypto.randomUUID(), box: bounds }] }],
    })
  ).toThrow('unavailable library');
});

it('reserves missing facts on the first free frame and rejects overlap with that area', () => {
  const document = createStudioDocumentV5('Empty', 'carousel');
  const result = compile(
    document,
    {
      title: 'Facts',
      frames: [
        { elements: [{ kind: 'shape', shape: 'rectangle', box: bounds }] },
        {
          elements: [
            { kind: 'shape', shape: 'ellipse', box: { x: 0.1, y: 0.85, width: 0.2, height: 0.1 } },
          ],
        },
      ],
    },
    { kind: 'carousel', requiredPlaceholders: ['[Date]'] }
  );
  expect(result.nodes.filter(node => node.name === 'Missing facts')).toHaveLength(1);
  expect(() =>
    compile(
      document,
      {
        title: 'Overlap',
        frames: [
          {
            elements: [
              {
                kind: 'shape',
                shape: 'rectangle',
                box: { x: 0, y: 0.75, width: 0.1, height: 0.1 },
              },
            ],
          },
        ],
      },
      { requiredPlaceholders: ['[Date]'] }
    )
  ).toThrow('reserve');
});

it('adds template placeholders once and keeps an existing project title and kind', () => {
  const { document } = fixture();
  const result = compile(
    document,
    { title: 'Additional post', frames: [{ body: 'Already [Date]' }, { headline: 'Second' }] },
    { mode: 'template', kind: 'carousel', requiredPlaceholders: ['[Date]', '[Location]'] }
  );
  expect(result.title).toBe(document.title);
  expect(result.kind).toBe(document.kind);
  const body = result.nodes.find(node => node.name === 'Body');
  expect(
    body?.type === 'richText' &&
      body.content
        .map(block => block.children.map(child => ('text' in child ? child.text : '')).join(''))
        .join('\n')
  ).toBe('Already [Date]\n[Location]');
  expect(
    result.nodes.filter(node => node.type === 'frame').some(node => node.name === 'Frame 1')
  ).toBe(true);
});

it('fits text using theme typography, nested marks and line-breaking rules', () => {
  const document = createStudioDocumentV5('Empty', 'single');
  const style = document.theme.textStyles.find(style => style.name.toLowerCase() === 'headline')!;
  style.size = 150;
  style.bold = true;
  style.italic = true;
  style.underline = true;
  style.lineHeight = 1.5;
  style.letterSpacing = 2;
  style.align = 'center';
  const result = compile(
    document,
    {
      title: 'Theme',
      frames: [{ eyebrow: 'Notice', headline: 'Words '.repeat(12), body: 'Details', cta: 'Act' }],
    },
    { mode: 'template' }
  );
  const title = result.nodes.find(node => node.type === 'richText' && node.textRole === 'title')!;
  if (title.type !== 'richText') throw Error('Missing headline');
  expect(title.typography).toMatchObject({
    textStyleId: style.id,
    lineHeight: 1.5,
    letterSpacing: 2,
    horizontalAlign: 'center',
  });
  expect(title.typography.fontSize).toBeLessThan(150);
  expect(title.overrides).toContain('typography.fontSize');
  expect(title.content[0].children[0]).toMatchObject({ bold: true, italic: true, underline: true });
});

it('creates template text without matching theme styles and rejects impossible text fit', () => {
  const document = createStudioDocumentV5('Empty', 'single');
  document.theme.textStyles = [];
  const result = compile(
    document,
    {
      title: 'Default fonts',
      frames: [{ eyebrow: 'Notice', headline: 'Title', body: 'Details', cta: 'Act' }],
    },
    { mode: 'template' }
  );
  expect(result.nodes.filter(node => node.type === 'richText')).toHaveLength(4);
  expect(() =>
    compile(document, {
      title: 'Overflow',
      frames: [
        {
          elements: [
            {
              kind: 'text',
              text: 'Word '.repeat(100),
              box: { x: 0, y: 0, width: 0.01, height: 0.01 },
            },
          ],
        },
      ],
    })
  ).toThrow('too long');
});

it('rejects patching without a selected frame, an unknown node, an unselected node or a missing parent frame', () => {
  const { document, text, options } = selected();
  expect(() =>
    compile(document, { title: 'Patch', edits: [{ nodeId: text.id, text: 'New' }] })
  ).toThrow('Select a frame');
  expect(() =>
    compile(
      document,
      { title: 'Patch', edits: [{ nodeId: crypto.randomUUID(), text: 'New' }] },
      options
    )
  ).toThrow('unselected');
  expect(() =>
    compile(
      document,
      { title: 'Patch', edits: [{ nodeId: text.id, text: 'New' }] },
      { allowedNodeIds: new Set([crypto.randomUUID()]) }
    )
  ).toThrow('unselected');
  text.parentFrameId = null;
  expect(() =>
    compile(document, { title: 'Patch', edits: [{ nodeId: text.id, text: 'New' }] }, options)
  ).toThrow('editable frame');
});

it.each(['node', 'frame'] as const)('rejects edits and deletions when the %s is locked', target => {
  const { document, frame, text, options } = selected();
  (target === 'node' ? text : frame).locked = true;
  expect(() =>
    compile(document, { title: 'Patch', edits: [{ nodeId: text.id, text: 'New' }] }, options)
  ).toThrow('locked');
  expect(() => compile(document, { title: 'Delete', deletions: [text.id] }, options)).toThrow(
    'locked'
  );
});

it('moves and resizes selected elements in safe-area coordinates and preserves their rotation', () => {
  const { document, text, options } = selected();
  text.transform.rotation = 30;
  const result = compile(
    document,
    { title: 'Move', edits: [{ nodeId: text.id, box: bounds }] },
    options
  );
  expect(result.nodes.find(node => node.id === text.id)?.transform).toMatchObject({
    x: 151.2,
    y: 151.2,
    width: 486,
    height: 194.4,
    rotation: 30,
  });
});

it.each(['foreground', 'accent', 'muted'] as const)(
  'recolors %s text and shape strokes with palette bindings',
  color => {
    const { document, text, shape, options } = selected();
    shape.shape = 'arrow';
    text.content[0].children.push({
      id: crypto.randomUUID(),
      type: 'a',
      url: 'https://example.test',
      children: [{ id: crypto.randomUUID(), text: 'Link' }],
    });
    const result = compile(
      document,
      {
        title: 'Color',
        edits: [
          { nodeId: text.id, color },
          { nodeId: shape.id, color },
        ],
      },
      options
    );
    const changed = result.nodes.find(node => node.id === text.id)!;
    const role =
      color === 'accent'
        ? 'accentForeground'
        : color === 'muted'
          ? 'mutedForeground'
          : 'foreground';
    expect(changed.style).toMatchObject({
      fillBinding: role,
      fill: activePalette(document.theme)[role],
    });
    if (changed.type !== 'richText') throw Error('Missing text');
    expect(changed.content[0].children[0]).toMatchObject({ colorBinding: role });
    expect(changed.content[0].children[1]).toEqual(text.content[0].children[1]);
    expect(result.nodes.find(node => node.id === shape.id)?.style).toMatchObject({
      strokeBinding: color,
      stroke: activePalette(document.theme)[color],
    });
  }
);

it('recolors filled rectangles and lines and rejects recoloring media', () => {
  const { document, shape, media, options } = selected();
  expect(
    compile(
      document,
      { title: 'Fill', edits: [{ nodeId: shape.id, color: 'accent' }] },
      options
    ).nodes.find(node => node.id === shape.id)?.style.fillBinding
  ).toBe('accent');
  shape.shape = 'line';
  expect(
    compile(
      document,
      { title: 'Stroke', edits: [{ nodeId: shape.id, color: 'muted' }] },
      options
    ).nodes.find(node => node.id === shape.id)?.style.strokeBinding
  ).toBe('muted');
  expect(() =>
    compile(document, { title: 'Media', edits: [{ nodeId: media.id, color: 'accent' }] }, options)
  ).toThrow('cannot be recolored');
});

it('changes selected text and explicit inline sizes while retaining old marks', () => {
  const { document, text, options } = selected();
  const result = compile(
    document,
    { title: 'Text', edits: [{ nodeId: text.id, text: 'Changed\nSecond line', size: 36 }] },
    options
  );
  const changed = result.nodes.find(node => node.id === text.id)!;
  if (changed.type !== 'richText') throw Error('Missing text');
  expect(changed.name).toBe('Changed\nSecond line');
  expect(changed.typography.fontSize).toBe(36);
  expect(changed.content.map(block => block.children[0])).toEqual([
    expect.objectContaining({ text: 'Changed', bold: true }),
    expect.objectContaining({ text: 'Second line', bold: true }),
  ]);
});

it('fits a font-size-only patch and updates explicitly sized leaves without changing link children', () => {
  const { document, text, options } = selected();
  text.content[0].children.push({ id: crypto.randomUUID(), text: 'Unsized' });
  text.content[0].children.push({
    id: crypto.randomUUID(),
    type: 'a',
    url: 'https://example.test',
    children: [{ id: crypto.randomUUID(), text: 'Link' }],
  });
  const result = compile(
    document,
    { title: 'Size', edits: [{ nodeId: text.id, size: 60 }] },
    options
  );
  const changed = result.nodes.find(node => node.id === text.id)!;
  if (changed.type !== 'richText') throw Error('Missing text');
  expect(changed.content[0].children[0]).toMatchObject({ fontSize: changed.typography.fontSize });
  expect(changed.content[0].children[1]).toEqual(text.content[0].children[1]);
  expect(changed.content[0].children[2]).toEqual(text.content[0].children[2]);
});

it('rejects font and text patches on shapes and deletes only selected non-frame nodes', () => {
  const { document, frame, text, shape, options } = selected();
  expect(() =>
    compile(document, { title: 'Size', edits: [{ nodeId: shape.id, size: 36 }] }, options)
  ).toThrow('Only text');
  expect(() =>
    compile(document, { title: 'Text', edits: [{ nodeId: shape.id, text: 'New' }] }, options)
  ).toThrow('Only text');
  expect(() =>
    compile(document, { title: 'Missing', deletions: [crypto.randomUUID()] }, options)
  ).toThrow('unselected');
  expect(() =>
    compile(
      document,
      { title: 'Frame', deletions: [frame.id] },
      { allowedNodeIds: new Set([frame.id]) }
    )
  ).toThrow('unselected');
  expect(() =>
    compile(
      document,
      { title: 'Unselected', deletions: [text.id] },
      { allowedNodeIds: new Set([shape.id]) }
    )
  ).toThrow('unselected');
  expect(
    compile(document, { title: 'Delete', deletions: [text.id] }, options).nodes.some(
      node => node.id === text.id
    )
  ).toBe(false);
});

it('authorizes additions through a selected child and rejects unavailable, unselected or locked target frames', () => {
  const { document, frame, text, shape } = fixture();
  const addition = {
    title: 'Add',
    additions: [{ frameId: frame.id, element: { kind: 'shape', shape: 'ellipse', box: bounds } }],
  };
  const added = compile(document, addition, { allowedNodeIds: new Set([text.id]) });
  expect(added.nodes.at(-1)?.zIndex).toBe(1);
  expect(() =>
    compile(
      document,
      { ...addition, additions: [{ ...addition.additions[0], frameId: shape.id }] },
      { allowedFrameIds: new Set([shape.id]) }
    )
  ).toThrow('unavailable');
  expect(() =>
    compile(document, addition, { allowedFrameIds: new Set([crypto.randomUUID()]) })
  ).toThrow('unselected frame');
  frame.locked = true;
  expect(() => compile(document, addition, { allowedFrameIds: new Set([frame.id]) })).toThrow(
    'locked'
  );
});

it('inserts an addition in an empty selected frame at the first layer', () => {
  const { document, frame } = fixture();
  document.nodes = [frame];
  const result = compile(
    document,
    {
      title: 'Add',
      additions: [
        { frameId: frame.id, element: { kind: 'shape', shape: 'rectangle', box: bounds } },
      ],
    },
    { allowedFrameIds: new Set([frame.id]) }
  );
  expect(result.nodes.at(-1)?.zIndex).toBe(0);
});

function library(nodes: StudioNode[], width = 100, height = 100) {
  const setId = crypto.randomUUID();
  const libraries: StudioAiLibrary = new Map([
    [
      setId,
      {
        revisionId: crypto.randomUUID(),
        snapshot: { nodes, width, height, assets: [] },
        assetIds: {},
      },
    ],
  ]);
  return { setId, libraries };
}
it('scales library text, inline font sizes and strokes into the target box', () => {
  const { text, shape } = fixture();
  text.parentFrameId = shape.parentFrameId = null;
  text.transform = { x: 0, y: 0, width: 100, height: 100, rotation: 0, flipX: false, flipY: false };
  text.content[0].children.push({ id: crypto.randomUUID(), text: 'Unsized' });
  text.content[0].children.push({
    id: crypto.randomUUID(),
    type: 'a',
    url: 'https://example.test',
    children: [{ id: crypto.randomUUID(), text: 'Link' }],
  });
  shape.transform = { ...text.transform };
  shape.style.strokeWidth = 2;
  const { setId, libraries } = library([text, shape]);
  const result = compile(
    createStudioDocumentV5('Empty', 'single'),
    { title: 'Library', frames: [{ elements: [{ kind: 'library', setId, box: bounds }] }] },
    { libraries }
  );
  const changed = result.nodes.find(node => node.type === 'richText')!;
  if (changed.type !== 'richText') throw Error('Missing library text');
  expect(changed.typography.fontSize).toBeCloseTo(48 * 1.944);
  expect(changed.content[0].children[0]).toMatchObject({ fontSize: 48 * 1.944 });
  expect(changed.content[0].children[1]).toEqual(text.content[0].children[1]);
  expect(result.componentInstances).toHaveLength(1);
});

it('rejects unsupported library node kinds and library geometry outside its declared bounds', () => {
  const table = createStudioNodeFromElement(element('table'), crypto.randomUUID(), 0);
  table.parentFrameId = null;
  const unsupported = library([table]);
  expect(() =>
    compile(
      createStudioDocumentV5('Empty', 'single'),
      {
        title: 'Table',
        frames: [{ elements: [{ kind: 'library', setId: unsupported.setId, box: bounds }] }],
      },
      { libraries: unsupported.libraries }
    )
  ).toThrow('not supported');
  const { shape } = fixture();
  shape.parentFrameId = null;
  shape.transform.x = 1000;
  const overflow = library([shape]);
  expect(() =>
    compile(
      createStudioDocumentV5('Empty', 'single'),
      {
        title: 'Overflow',
        frames: [{ elements: [{ kind: 'library', setId: overflow.setId, box: bounds }] }],
      },
      { libraries: overflow.libraries }
    )
  ).toThrow('safe area');
  shape.transform.x = 0;
  shape.transform.y = 1000;
  const vertical = library([shape]);
  expect(() =>
    compile(
      createStudioDocumentV5('Empty', 'single'),
      {
        title: 'Overflow',
        frames: [{ elements: [{ kind: 'library', setId: vertical.setId, box: bounds }] }],
      },
      { libraries: vertical.libraries }
    )
  ).toThrow('safe area');
});

it.each([false, true])(
  'fits oversized theme text while preserving an existing size override %s',
  override => {
    const { document, text } = fixture();
    text.transform.width = 350;
    text.transform.height = 80;
    text.typography.fontSize = 100;
    text.content[0].children[0] = {
      id: crypto.randomUUID(),
      text: 'Several words wrapping onto lines',
      fontSize: 120,
    };
    text.content[0].children.push({ id: crypto.randomUUID(), text: ' unsized' });
    text.content[0].children.push({
      id: crypto.randomUUID(),
      type: 'a',
      url: 'https://example.test',
      children: [{ id: crypto.randomUUID(), text: 'Link' }],
    });
    if (override) text.overrides.push('typography.fontSize');
    fitStudioAiThemeText(document);
    expect(text.typography.fontSize).toBeLessThan(100);
    expect(text.overrides.filter(value => value === 'typography.fontSize')).toHaveLength(1);
    expect(text.content[0].children[0]).toEqual(
      expect.objectContaining({ fontSize: expect.any(Number) })
    );
    expect(text.content[0].children[1]).not.toHaveProperty('fontSize');
    expect(text.content[0].children[2]).toHaveProperty('url');
  }
);

it('keeps text that fits and rejects text that cannot fit at the minimum font size', () => {
  const { document, text } = fixture();
  const original = structuredClone(document);
  fitStudioAiThemeText(document);
  expect(document).toEqual(original);
  text.transform.width = 1;
  text.transform.height = 1;
  expect(() => fitStudioAiThemeText(document)).toThrow('too long');
});
