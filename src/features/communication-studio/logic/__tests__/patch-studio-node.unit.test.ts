import { describe, expect, it } from 'vitest';
import { defaultBrand, element } from '../document';
import { createStudioTemplateDocumentV5 } from '../templates-v5';
import { formatStudioRichText, patchStudioNode } from '../patch-studio-node';
import { createDocument } from '../templates';
import { legacyDocumentToV3, v3DocumentToLegacy } from '../v3-adapter';

it('keeps Plate marks and shape geometry when panel properties change', () => {
  const document = createStudioTemplateDocumentV5('single', 'Properties', defaultBrand);
  const text = document.nodes.find(node => node.type === 'richText');
  const shape = document.nodes.find(node => node.type === 'shape');
  if (!text || !shape) throw new Error('Missing template nodes');
  text.content = [
    {
      id: crypto.randomUUID(),
      type: 'p',
      children: [
        { id: crypto.randomUUID(), text: 'Bold', bold: true },
        { id: crypto.randomUUID(), text: ' normal', color: '#ff0000' },
      ],
    },
  ];
  shape.shape = 'diamond';
  patchStudioNode(text, { x: 120, opacity: 0.7 });
  patchStudioNode(shape, { fill: '#ff0000' });
  expect(text.content[0].children).toMatchObject([
    { text: 'Bold', bold: true },
    { text: ' normal', color: '#ff0000' },
  ]);
  expect(shape.shape).toBe('diamond');
  const restored = legacyDocumentToV3(v3DocumentToLegacy(document), document);
  expect(restored.nodes.find(node => node.id === text.id)).toMatchObject({ content: text.content });
  expect(restored.nodes.find(node => node.id === shape.id)).toMatchObject({ shape: 'diamond' });
});

describe('Studio node property patches', () => {
  it('applies explicit geometry, ordering, visibility, locks and style without conflating false or zero with missing values', () => {
    const document = createStudioTemplateDocumentV5('single', 'Properties', defaultBrand);
    const node = document.nodes.find(node => node.type === 'shape')!;
    node.style.fillBinding = 'foreground';
    node.style.strokeBinding = 'accent';
    patchStudioNode(node, {
      x: 0,
      y: 1,
      width: 80,
      height: 90,
      rotation: 0,
      flipX: true,
      flipY: false,
      order: 0,
      visible: false,
      locked: true,
      animation: 'fade',
      opacity: 0,
      strokeWidth: 0,
      fill: '#123456',
      stroke: '#654321',
    });
    expect(node).toMatchObject({
      transform: { x: 0, y: 1, width: 80, height: 90, rotation: 0, flipX: true, flipY: false },
      zIndex: 0,
      visible: false,
      locked: true,
      animation: 'fade',
      style: {
        opacity: 0,
        strokeWidth: 0,
        fill: '#123456',
        stroke: '#654321',
        fillBinding: null,
        strokeBinding: null,
      },
    });
    const before = structuredClone(node);
    patchStudioNode(node, {});
    expect(node).toEqual(before);
  });
  it('patches text content, typography and marks through nested links while retaining unrelated leaf formatting', () => {
    const document = createStudioTemplateDocumentV5('single', 'Properties', defaultBrand);
    const node = document.nodes.find(node => node.type === 'richText')!;
    patchStudioNode(node, {
      text: 'First\nSecond',
      font: 'Manrope',
      fontSize: 28,
      lineHeight: 1.4,
      align: 'center',
      verticalAlign: 'middle',
    });
    expect(node.content.map(block => block.children[0])).toMatchObject([
      { text: 'First' },
      { text: 'Second' },
    ]);
    expect(node.typography).toMatchObject({
      fontFamily: 'Manrope',
      fontSize: 28,
      lineHeight: 1.4,
      horizontalAlign: 'center',
      verticalAlign: 'middle',
    });
    node.content[0].children.push({
      id: crypto.randomUUID(),
      type: 'a',
      url: 'https://example.com',
      children: [{ id: crypto.randomUUID(), text: 'Linked', color: '#123456', bold: true }],
    });
    patchStudioNode(node, { bold: false, italic: true, underline: true, strikethrough: false });
    expect(node.content[0].children[0]).toMatchObject({
      bold: false,
      italic: true,
      underline: true,
      strikethrough: false,
    });
    const link = node.content[0].children[1];
    expect(link).toMatchObject({
      url: 'https://example.com',
      children: [{ text: 'Linked', color: '#123456', bold: false, italic: true, underline: true }],
    });
  });
  it('retains provided paragraph IDs and optional alignment and list data when importing legacy rich text', () => {
    const node = createStudioTemplateDocumentV5('single', 'Properties', defaultBrand).nodes.find(
      node => node.type === 'richText'
    )!;
    const first = crypto.randomUUID(),
      second = crypto.randomUUID();
    patchStudioNode(node, {
      richText: [
        {
          id: first,
          type: 'p',
          align: 'right',
          list: 'bullet',
          children: [{ text: 'Marked', bold: true }],
        },
        { id: second, type: 'p', children: [{ text: 'Plain' }] },
      ],
    });
    expect(node.content).toMatchObject([
      { id: first, align: 'right', list: 'bullet', children: [{ text: 'Marked', bold: true }] },
      { id: second, children: [{ text: 'Plain' }] },
    ]);
    expect(node.content[1]).not.toHaveProperty('align');
    expect(node.content[1]).not.toHaveProperty('list');
    expect(node.content[0].children[0].id).not.toBe(node.content[1].children[0].id);
  });
  it('patches media, tables and charts through their specific data fields', () => {
    const legacy = createDocument('single', 'Properties');
    legacy.pages[0].elements.push(
      element('video', { assetId: crypto.randomUUID() }),
      element('table'),
      element('chart')
    );
    const document = legacyDocumentToV3(legacy);
    const media = document.nodes.find(node => node.type === 'media')!;
    const crop = {
      x: 0.1,
      y: 0.2,
      width: 0.5,
      height: 0.5,
      naturalWidth: 1000,
      naturalHeight: 1000,
    };
    patchStudioNode(media, { fit: 'cover', cropX: 0, cropY: 1, crop, trimStart: 2, muted: false });
    expect(media).toMatchObject({
      fit: 'cover',
      focus: { x: 0, y: 1 },
      crop,
      trim: { start: 2 },
      muted: false,
    });
    patchStudioNode(media, { crop: null });
    expect(media.crop).toBeNull();
    patchStudioNode(media, {});
    const table = document.nodes.find(node => node.type === 'table')!;
    const chart = document.nodes.find(node => node.type === 'chart')!;
    const tableData = structuredClone(table.data),
      chartData = structuredClone(chart.data);
    tableData.rows[0].cells[0].text = 'Edited';
    chartData.labels[0] = 'Edited';
    patchStudioNode(table, { table: tableData });
    patchStudioNode(chart, { chart: chartData });
    expect(table.data).toEqual(tableData);
    expect(chart.data).toEqual(chartData);
    patchStudioNode(table, {});
    patchStudioNode(chart, {});
  });
  it.each(['bold', 'italic', 'underline', 'strikethrough', 'fill'] as const)(
    'formats every nested leaf for %s and clears a superseded text style binding',
    key => {
      const node = createStudioTemplateDocumentV5('single', 'Properties', defaultBrand).nodes.find(
        node => node.type === 'richText'
      )!;
      node.content = [
        {
          id: crypto.randomUUID(),
          type: 'p',
          children: [
            {
              id: crypto.randomUUID(),
              type: 'a',
              url: 'https://example.com',
              children: [
                { id: crypto.randomUUID(), text: 'Linked', textStyleId: crypto.randomUUID() },
              ],
            },
          ],
        },
      ];
      formatStudioRichText(node, key, key === 'fill' ? '#123456' : true);
      expect(node.content[0].children[0]).toMatchObject({
        children: [
          {
            text: 'Linked',
            [key === 'fill' ? 'color' : key]: key === 'fill' ? '#123456' : true,
            textStyleId: undefined,
          },
        ],
      });
    }
  );
  it.each(['bullet', 'number', null])('sets or removes paragraph list formatting %s', value => {
    const node = createStudioTemplateDocumentV5('single', 'Properties', defaultBrand).nodes.find(
      node => node.type === 'richText'
    )!;
    formatStudioRichText(node, 'list', value);
    expect(node.content[0].list).toBe(value ?? undefined);
  });
  it.each(['https://example.com', 'http://example.com', 'javascript:alert(1)', null])(
    'retains only HTTP links for %s',
    value => {
      const node = createStudioTemplateDocumentV5('single', 'Properties', defaultBrand).nodes.find(
        node => node.type === 'richText'
      )!;
      formatStudioRichText(node, 'url', value);
      expect(node.content[0].url).toBe(
        typeof value === 'string' && value.startsWith('http') ? value : undefined
      );
    }
  );
  it('sets font, size and paragraph alignment independently of inline marks', () => {
    const node = createStudioTemplateDocumentV5('single', 'Properties', defaultBrand).nodes.find(
      node => node.type === 'richText'
    )!;
    formatStudioRichText(node, 'font', 'Manrope');
    formatStudioRichText(node, 'fontSize', 36);
    formatStudioRichText(node, 'align', 'right');
    expect(node.typography).toMatchObject({
      fontFamily: 'Manrope',
      fontSize: 36,
      horizontalAlign: 'right',
    });
  });
});
