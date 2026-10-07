import { expect, it, vi } from 'vitest';
import { defaultBrand, element } from '../document';
import { createStudioTemplateDocumentV5 } from '../templates-v5';
import {
  studioDocumentV3Schema,
  type StudioDocumentV3,
  type StudioPlateElement,
} from '../document-v3';
import {
  createStudioCanvasNode,
  changeStudioCanvasText,
  formatStudioCanvasText,
} from '../studio-canvas-commands';

function fixture() {
  const document = createStudioTemplateDocumentV5('single', 'Canvas commands', defaultBrand);
  const transact = vi.fn((change: (document: StudioDocumentV3) => void) => change(document));
  return { document, transact };
}

it.each(['missing document', 'readonly'] as const)(
  'does not create or transact with a %s',
  reason => {
    const { document, transact } = fixture();
    const before = structuredClone(document);
    expect(
      createStudioCanvasNode({
        document: reason === 'missing document' ? null : document,
        canEdit: reason !== 'readonly',
        tool: 'rectangle',
        start: { x: 80, y: 80 },
        end: { x: 180, y: 180 },
        rounded: false,
        transact,
      })
    ).toBeNull();
    expect(document).toEqual(before);
    expect(transact).not.toHaveBeenCalled();
  }
);

it.each([
  'frame',
  'text',
  'draw',
  'laser',
  'rectangle',
  'arrow',
  'ellipse',
  'line',
  'diamond',
] as const)(
  'creates a canonical %s node through one transaction and preserves existing content',
  tool => {
    const { document, transact } = fixture();
    const before = structuredClone(document.nodes);
    const id = createStudioCanvasNode({
      document,
      canEdit: true,
      brandForeground: '#123456',
      tool,
      start: { x: 180, y: 160 },
      end: { x: 80, y: 80 },
      rounded: false,
      points: [
        [180, 160],
        [80, 80],
      ],
      transact,
    });
    expect(transact).toHaveBeenCalledOnce();
    expect(document.nodes.slice(0, -1)).toEqual(before);
    const node = document.nodes.at(-1)!;
    expect(node.id).toBe(id);
    expect(node.transform.x).toBe(80);
    expect(node.transform.y).toBe(80);
    expect(node.parentFrameId).toBe(
      tool === 'frame' ? null : before.find(node => node.type === 'frame')!.id
    );
    if (tool === 'text') {
      expect(node.type).toBe('richText');
      expect(node.transform.width).toBe(700);
      expect(node.transform.height).toBe(180);
      expect(node.style.fill).toBe('#123456');
    } else if (tool === 'frame') {
      expect(node.type).toBe('frame');
      expect(node.transform.width).toBe(200);
      expect(node.transform.height).toBe(200);
    } else if (node.type === 'drawing')
      expect(node.points).toEqual([
        [100, 80],
        [0, 0],
      ]);
    else {
      expect(node.type).toBe('shape');
      expect(node.transform.width).toBe(100);
      expect(node.transform.height).toBe(80);
    }
    studioDocumentV3Schema.parse(document);
  }
);

it('creates a rounded root shape outside all frames using the default foreground', () => {
  const { document, transact } = fixture();
  createStudioCanvasNode({
    document,
    canEdit: true,
    tool: 'rectangle',
    start: { x: -200, y: -200 },
    end: { x: -100, y: -100 },
    rounded: true,
    transact,
  });
  const node = document.nodes.at(-1)!;
  expect(node.parentFrameId).toBeNull();
  expect(node.style.stroke).toBe('#12362D');
  expect(node.style.cornerRadius).toBe(24);
  expect(node.type === 'shape' && node.shape).toBe('rounded-rectangle');
  studioDocumentV3Schema.parse(document);
});

it.each(['missing', 'wrong type'] as const)('ignores a text change targeting a %s node', reason => {
  const { document, transact } = fixture();
  const before = structuredClone(document);
  changeStudioCanvasText({
    id:
      reason === 'missing'
        ? crypto.randomUUID()
        : document.nodes.find(node => node.type === 'frame')!.id,
    content: [],
    transact,
  });
  expect(document).toEqual(before);
});

it.each(['visible text', 'empty text', 'inline link'] as const)(
  'updates the real rich text content and its label with %s',
  kind => {
    const { document, transact } = fixture();
    const node = document.nodes.find(node => node.type === 'richText')!;
    const text = kind === 'visible text' ? 'Renamed from canvas' : '';
    const content: StudioPlateElement[] = [
      {
        id: crypto.randomUUID(),
        type: 'p',
        children:
          kind === 'inline link'
            ? [
                {
                  id: crypto.randomUUID(),
                  type: 'a',
                  url: 'https://polity.live',
                  children: [{ id: crypto.randomUUID(), text: 'Link' }],
                },
              ]
            : [{ id: crypto.randomUUID(), text }],
      },
    ];
    changeStudioCanvasText({ id: node.id, content, transact });
    expect(node.type === 'richText' && node.content).toEqual(content);
    expect(node.name).toBe(text || 'Text');
    studioDocumentV3Schema.parse(document);
  }
);

it.each(['missing selection', 'shape selection'] as const)(
  'does not format a %s as rich text',
  reason => {
    const { document, transact } = fixture();
    const before = structuredClone(document);
    formatStudioCanvasText({
      active: reason === 'missing selection' ? null : element('rect'),
      property: 'bold',
      value: true,
      transact,
    });
    expect(transact).not.toHaveBeenCalled();
    expect(document).toEqual(before);
  }
);

it.each(['missing', 'wrong type', 'rich text'] as const)(
  'formats only a current %s canonical target',
  kind => {
    const { document, transact } = fixture();
    const target =
      kind === 'rich text'
        ? document.nodes.find(node => node.type === 'richText')!
        : document.nodes.find(node => node.type === 'frame')!;
    const before = structuredClone(document);
    formatStudioCanvasText({
      active: element('text', { id: kind === 'missing' ? crypto.randomUUID() : target.id }),
      property: 'bold',
      value: true,
      transact,
    });
    if (target.type === 'richText' && kind === 'rich text')
      expect(target.content[0].children[0]).toMatchObject({ bold: true });
    else expect(document).toEqual(before);
    studioDocumentV3Schema.parse(document);
  }
);
