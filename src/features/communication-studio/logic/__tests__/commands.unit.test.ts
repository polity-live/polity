import { expect, it } from 'vitest';
import { createDocument } from '../templates';
import { element, formats } from '../document';
import { applyStudioCommand, elementBounds } from '../commands';
function fixture() {
  const document = createDocument('single', 'Command fixture');
  document.pages[0].elements = [0, 80, 250].map((position, index) =>
    element('rect', { x: position, y: position, width: 20, height: 30, order: index })
  );
  const page = document.pages[0];
  return { document, page, target: { pageId: page.id, elementIds: page.elements.map(e => e.id) } };
}
it.each(['left', 'center', 'right', 'top', 'middle', 'bottom'] as const)(
  'aligns %s against the page and selection using transformed bounds',
  direction => {
    const { document, page, target } = fixture();
    const original = structuredClone(document);
    const vertical = ['top', 'middle', 'bottom'].includes(direction);
    for (const reference of ['page', 'selection'] as const) {
      const changed = applyStudioCommand(document, 'studio_align_elements', {
        ...target,
        direction,
        reference,
      });
      const bounds = changed.pages[0].elements.map(elementBounds);
      const [width, height] = formats[page.format];
      const start = 0;
      const end = reference === 'page' ? (vertical ? height : width) : vertical ? 280 : 270;
      const size = vertical ? 30 : 20;
      const expected = ['left', 'top'].includes(direction)
        ? start
        : ['right', 'bottom'].includes(direction)
          ? end - size
          : (start + end - size) / 2;
      expect(
        bounds.every(bound => Math.abs((vertical ? bound.y : bound.x) - expected) < 0.001)
      ).toBe(true);
    }
    expect(document).toEqual(original);
  }
);
it('selects page and selection alignment defaults and accounts for rotated geometry', () => {
  const { document, page, target } = fixture();
  page.elements[0].rotation = 90;
  expect(elementBounds(page.elements[0]).width).toBeCloseTo(30);
  expect(elementBounds(page.elements[0]).height).toBeCloseTo(20);
  const single = applyStudioCommand(document, 'studio_align_elements', {
    ...target,
    elementIds: [target.elementIds[0]],
    direction: 'left',
  });
  expect(elementBounds(single.pages[0].elements[0]).x).toBeCloseTo(0);
  const multiple = applyStudioCommand(document, 'studio_align_elements', {
    ...target,
    direction: 'left',
  });
  expect(
    multiple.pages[0].elements.map(elementBounds).every(bound => Math.abs(bound.x + 30) < 0.001)
  ).toBe(true);
});
it.each(['horizontal', 'vertical'] as const)(
  'distributes %s elements with equal gaps and preserves the outer endpoints',
  axis => {
    const { document, target } = fixture();
    const result = applyStudioCommand(document, 'studio_distribute_elements', { ...target, axis })
      .pages[0].elements;
    const key = axis === 'horizontal' ? 'x' : 'y';
    expect(result.map(e => e[key])).toEqual([0, 125, 250]);
    expect(() =>
      applyStudioCommand(document, 'studio_distribute_elements', {
        ...target,
        elementIds: target.elementIds.slice(0, 2),
        axis,
      })
    ).toThrow('at least three');
  }
);
it.each([
  ['front', [1, 2, 0]],
  ['back', [0, 1, 2]],
  ['forward', [1, 0, 2]],
  ['backward', [0, 1, 2]],
] as const)(
  'arranges an element %s while preserving the relative order of unselected elements',
  (action, order) => {
    const { document, page, target } = fixture();
    const changed = applyStudioCommand(document, 'studio_arrange_elements', {
      ...target,
      elementIds: [target.elementIds[0]],
      action,
    });
    const ordered = [...changed.pages[0].elements]
      .sort((a, b) => a.order - b.order)
      .map(e => page.elements.findIndex(p => p.id === e.id));
    expect(ordered).toEqual(order);
  }
);
it('groups, ungroups, locks and unlocks selected elements and duplicates with fresh identities', () => {
  const { document, target } = fixture();
  let changed = applyStudioCommand(document, 'studio_arrange_elements', {
    ...target,
    action: 'group',
  });
  expect(new Set(changed.pages[0].elements.map(e => e.group)).size).toBe(1);
  expect(changed.pages[0].elements[0].group).toBeTruthy();
  changed = applyStudioCommand(changed, 'studio_arrange_elements', {
    ...target,
    action: 'ungroup',
  });
  expect(changed.pages[0].elements.every(e => e.group === null)).toBe(true);
  changed = applyStudioCommand(changed, 'studio_arrange_elements', { ...target, action: 'lock' });
  expect(changed.pages[0].elements.every(e => e.locked)).toBe(true);
  expect(() =>
    applyStudioCommand(changed, 'studio_arrange_elements', { ...target, action: 'delete' })
  ).toThrow('locked');
  changed = applyStudioCommand(changed, 'studio_arrange_elements', { ...target, action: 'unlock' });
  expect(changed.pages[0].elements.every(e => !e.locked)).toBe(true);
  changed = applyStudioCommand(changed, 'studio_arrange_elements', {
    ...target,
    action: 'duplicate',
  });
  expect(changed.pages[0].elements).toHaveLength(6);
  expect(new Set(changed.pages[0].elements.map(e => e.id)).size).toBe(6);
  expect(changed.pages[0].elements[3]).toMatchObject({ x: 30, y: 30, group: null, order: 3 });
  const removed = applyStudioCommand(changed, 'studio_arrange_elements', {
    ...target,
    action: 'delete',
  });
  expect(removed.pages[0].elements).toHaveLength(3);
});
it('rejects nonexistent pages, duplicate and unknown element IDs, and incompatible text targets', () => {
  const { document, target } = fixture();
  expect(() =>
    applyStudioCommand(document, 'studio_format_text', {
      ...target,
      pageId: crypto.randomUUID(),
      patch: {},
    })
  ).toThrow('Page not found');
  expect(() =>
    applyStudioCommand(document, 'studio_format_text', {
      ...target,
      elementIds: [target.elementIds[0], target.elementIds[0]],
      patch: {},
    })
  ).toThrow('Duplicate element');
  expect(() =>
    applyStudioCommand(document, 'studio_format_text', {
      ...target,
      elementIds: [crypto.randomUUID()],
      patch: {},
    })
  ).toThrow('Element not found');
  expect(() =>
    applyStudioCommand(document, 'studio_format_text', { ...target, patch: {} })
  ).toThrow('Select text');
});
it.each(['table', 'chart'] as const)(
  'updates native %s data and rejects incompatible targets',
  type => {
    const { document, page, target } = fixture();
    const data = element(type)[type]!;
    expect(() =>
      applyStudioCommand(
        document,
        type === 'table' ? 'studio_update_table' : 'studio_update_chart',
        { ...target, [type]: data }
      )
    ).toThrow(type === 'table' ? 'Select a table' : 'Select a chart');
    page.elements = [element(type)];
    const updated = applyStudioCommand(
      document,
      type === 'table' ? 'studio_update_table' : 'studio_update_chart',
      { pageId: page.id, elementIds: [page.elements[0].id], [type]: data }
    );
    expect(updated.pages[0].elements[0][type]).toEqual(data);
    expect(updated.pages[0].elements[0][type]).not.toBe(data);
  }
);
it('formats a text range without changing surrounding runs or paragraphs and applies links and list modes', () => {
  const { document, page } = fixture();
  const paragraph = crypto.randomUUID();
  page.elements = [
    element('text', {
      text: 'Before middle after',
      richText: [
        {
          id: paragraph,
          type: 'p',
          children: [{ text: 'Before ' }, { text: 'middle' }, { text: ' after' }],
        },
        { id: crypto.randomUUID(), type: 'p', children: [{ text: 'Untouched' }] },
      ],
    }),
  ];
  const target = { pageId: page.id, elementIds: [page.elements[0].id] };
  const changed = applyStudioCommand(document, 'studio_format_text', {
    ...target,
    range: { paragraphId: paragraph, start: 8, end: 12 },
    list: 'bullet',
    url: 'https://example.org',
    patch: {
      bold: true,
      italic: true,
      underline: true,
      strikethrough: true,
      fontSize: 40,
      fill: '#FF0000',
      font: 'Inter',
      align: 'right',
    },
  });
  const richText = changed.pages[0].elements[0].richText;
  expect(richText[0].children[2]).toMatchObject({
    text: 'iddl',
    bold: true,
    fontFamily: 'Inter',
    color: '#FF0000',
    url: 'https://example.org',
  });
  expect(richText[0]).toMatchObject({ list: 'bullet', align: 'right' });
  expect(richText[1]).toEqual(page.elements[0].richText[1]);
  const cleared = applyStudioCommand(changed, 'studio_format_text', {
    ...target,
    list: 'none',
    url: null,
    patch: {},
  });
  expect(
    cleared.pages[0].elements[0].richText.every(p => !p.list && p.children.every(run => !run.url))
  ).toBe(true);
});
it('initializes rich text, replaces a supplied rich-text payload and rejects invalid ranges and executable links', () => {
  const { document, page } = fixture();
  page.elements = [element('text', { text: 'First\nSecond' })];
  const target = { pageId: page.id, elementIds: [page.elements[0].id] };
  const initialized = applyStudioCommand(document, 'studio_format_text', {
    ...target,
    list: 'number',
    patch: { bold: true },
  });
  expect(initialized.pages[0].elements[0].richText).toHaveLength(2);
  const richText = [
    { id: crypto.randomUUID(), type: 'p' as const, children: [{ text: 'Replacement' }] },
  ];
  expect(
    applyStudioCommand(document, 'studio_format_text', { ...target, patch: { richText } }).pages[0]
      .elements[0].richText
  ).toEqual(richText);
  for (const range of [
    { paragraphId: richText[0].id, start: 1, end: 1 },
    { paragraphId: richText[0].id, start: 0, end: 2 },
    { paragraphId: initialized.pages[0].elements[0].richText[0].id, start: 0, end: 99 },
  ])
    expect(() =>
      applyStudioCommand(initialized, 'studio_format_text', { ...target, range, patch: {} })
    ).toThrow();
  expect(() =>
    applyStudioCommand(document, 'studio_format_text', {
      ...target,
      url: 'javascript:alert(1)',
      patch: {},
    })
  ).toThrow();
});
it('changes inline styling without replacing the paragraph list mode', () => {
  const { document, page } = fixture();
  page.elements = [
    element('text', {
      text: 'Existing',
      richText: [
        { id: crypto.randomUUID(), type: 'p', list: 'bullet', children: [{ text: 'Existing' }] },
      ],
    }),
  ];
  const changed = applyStudioCommand(document, 'studio_format_text', {
    pageId: page.id,
    elementIds: [page.elements[0].id],
    patch: { italic: true },
  });
  expect(changed.pages[0].elements[0].richText[0]).toMatchObject({
    list: 'bullet',
    children: [{ text: 'Existing', italic: true }],
  });
});
