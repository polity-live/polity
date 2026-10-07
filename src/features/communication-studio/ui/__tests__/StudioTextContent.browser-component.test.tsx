import { expect, it, vi } from 'vitest';
import { normalizeStudioTextContent } from '../StudioInlineTextEditor';
import { normalizeStudioLegacyParagraphs } from '../StudioTextEditor';

it('normalizes incomplete pasted native blocks and leaves while retaining supported content fields', () => {
  const content = normalizeStudioTextContent([
    null,
    { type: 42, children: [] },
    {
      children: [{ text: 'Pasted', bold: true, color: '#112233', extra: 'discarded' }],
      align: 'center',
      extra: true,
    },
    {
      id: crypto.randomUUID(),
      type: 'p',
      children: [{ id: crypto.randomUUID(), text: 'Known', italic: false }],
    },
  ]);
  expect(
    content
      .slice(0, 2)
      .every(
        block =>
          block.type === 'p' &&
          block.children.length === 1 &&
          'text' in block.children[0] &&
          block.children[0].text === ''
      )
  ).toBe(true);
  expect(content[2]).toMatchObject({
    type: 'p',
    align: 'center',
    children: [{ text: 'Pasted', bold: true, color: '#112233' }],
  });
  expect(content[2]).not.toHaveProperty('extra');
  expect(content[2].children[0]).not.toHaveProperty('extra');
  expect(content[3].children[0]).toMatchObject({ text: 'Known', italic: false });
  expect(
    content.every(
      block =>
        /^[0-9a-f-]{36}$/.test(block.id) &&
        block.children.every(child => /^[0-9a-f-]{36}$/.test(child.id))
    )
  ).toBe(true);
});

it('rejects malformed native content and retains nested supported paragraph and leaf metadata', () => {
  const parentId = crypto.randomUUID();
  const leafId = crypto.randomUUID();
  expect(
    normalizeStudioTextContent([
      {
        id: parentId,
        type: 'p',
        children: [{ type: 'p', children: [{ id: leafId, text: 'Nested', highlight: true }] }],
        list: 'bullet',
        url: 'https://polity.live',
      },
    ])[0]
  ).toMatchObject({
    id: parentId,
    list: 'bullet',
    url: 'https://polity.live',
    children: [{ type: 'p', children: [{ id: leafId, text: 'Nested', highlight: true }] }],
  });
  expect(() =>
    normalizeStudioTextContent([{ id: 'invalid', children: [{ text: 'Bad identity' }] }])
  ).toThrow();
  expect(normalizeStudioTextContent([])).toEqual([]);
});

it('repairs only missing, empty and duplicate legacy paragraph identities without mutating the input', () => {
  const id = crypto.randomUUID();
  const input = [
    { id, type: 'p', children: [{ text: 'Known', bold: true }] },
    { id, children: [{ text: 'Duplicate' }] },
    { children: [{ text: 'Missing' }] },
    { id: '', children: [{ text: 'Empty' }] },
  ];
  const saved = structuredClone(input);
  const repair = vi.fn();
  const normalized = normalizeStudioLegacyParagraphs(input, repair);
  expect(input).toEqual(saved);
  expect(normalized[0]).toMatchObject(input[0]);
  expect(new Set(normalized.map(block => block.id)).size).toBe(4);
  expect(repair.mock.calls).toEqual(
    normalized.slice(1).map((block, index) => [block.id, index + 1])
  );
  expect(normalized.every(block => block.type === 'p')).toBe(true);
});
