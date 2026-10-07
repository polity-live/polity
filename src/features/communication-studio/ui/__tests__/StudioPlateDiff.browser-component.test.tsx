import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { StudioPlateDiff, studioText } from '../StudioPlateDiff';
import { defaultBrand } from '../../logic/document';
import { createStudioTemplateDocumentV5 } from '../../logic/templates-v5';
import { richTextNodeSchema } from '../../logic/document-v3';

it('keeps unchanged text readable without inserting suggestion marks', () => {
  const view = render(<StudioPlateDiff before="Unchanged wording" after="Unchanged wording" />);
  expect(screen.getByText('Unchanged wording')).toBeTruthy();
  expect(view.container.querySelector('.line-through')).toBeNull();
});

it('renders a valid empty Plate value when both versions are empty', () => {
  const view = render(<StudioPlateDiff before="" after="" />);
  expect(view.container.querySelector('[contenteditable]')).toBeTruthy();
  expect(view.container.textContent?.trim()).toBe('');
});

it('retains common prefixes and suffixes around changed wording', () => {
  const view = render(<StudioPlateDiff before="Shared old ending" after="Shared new ending" />);
  expect(view.container.textContent).toBe('Shared oldnew ending');
});

it('reads text recursively from valid linked Plate content and keeps paragraph boundaries', () => {
  const document = createStudioTemplateDocumentV5('single', 'Nested text', defaultBrand);
  const source = document.nodes.find(node => node.type === 'richText')!;
  const node = richTextNodeSchema.parse({
    ...source,
    content: [
      {
        id: crypto.randomUUID(),
        type: 'p',
        children: [
          { id: crypto.randomUUID(), text: 'Before ' },
          {
            id: crypto.randomUUID(),
            type: 'a',
            url: 'https://example.org',
            children: [{ id: crypto.randomUUID(), text: 'linked text' }],
          },
        ],
      },
      {
        id: crypto.randomUUID(),
        type: 'p',
        children: [{ id: crypto.randomUUID(), text: 'Next paragraph' }],
      },
    ],
  });
  expect(studioText(node)).toBe('Before linked text\nNext paragraph');
});
