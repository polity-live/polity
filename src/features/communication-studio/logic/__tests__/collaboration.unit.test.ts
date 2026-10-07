import { describe, expect, it } from 'vitest';
import { createDocument, makePage } from '../templates';
import { defaultBrand, element } from '../document';
import {
  addPage,
  applyBrand,
  insertElement,
  patchElement,
  patchPage,
  patchPost,
  removeElement,
} from '../collaboration';
describe('Studio collaboration document patches', () => {
  it('clones new pages and elements and ignores stale page references', () => {
    const document = createDocument('single', 'Collaboration');
    const page = makePage('Added', 'square');
    addPage(document, page);
    expect(document.pages[1]).toEqual(page);
    expect(document.pages[1]).not.toBe(page);
    const shape = element('rect');
    insertElement(document, page.id, shape);
    expect(document.pages[1].elements.at(-1)).toEqual(shape);
    shape.x = 900;
    expect(document.pages[1].elements.at(-1)?.x).not.toBe(900);
    insertElement(document, 'missing', shape);
    patchPage(document, 'missing', { name: 'Stale' });
    patchPage(document, page.id, { id: page.id, name: 'Renamed' });
    expect(document.pages[1].name).toBe('Renamed');
    expect(() => patchPage(document, page.id, { id: crypto.randomUUID() })).toThrow(
      'Stable page ID'
    );
  });
  it('preserves locked elements during edits and deletion while allowing explicit unlocking', () => {
    const document = createDocument('single', 'Locked');
    const page = document.pages[0];
    const shape = element('rect', { locked: true });
    page.elements = [shape];
    patchElement(document, page.id, shape.id, { x: 800 });
    expect(shape.x).not.toBe(800);
    removeElement(document, page.id, shape.id);
    expect(page.elements).toEqual([shape]);
    patchElement(document, page.id, shape.id, { locked: false });
    expect(shape.locked).toBe(false);
    patchElement(document, page.id, shape.id, { id: shape.id, x: 800 });
    expect(shape.x).toBe(800);
    removeElement(document, 'missing', shape.id);
    removeElement(document, page.id, 'missing');
    expect(page.elements).toEqual([shape]);
    removeElement(document, page.id, shape.id);
    expect(page.elements).toEqual([]);
    patchElement(document, 'missing', shape.id, { x: 1 });
    patchElement(document, page.id, 'missing', { x: 1 });
    expect(() => patchElement(document, page.id, shape.id, { id: crypto.randomUUID() })).toThrow(
      'Stable element ID'
    );
  });
  it('applies text formatting through real commands, resets marks on plain replacement and retains explicit rich content', () => {
    const document = createDocument('single', 'Text');
    const page = document.pages[0];
    const text = element('text', {
      text: 'Hello',
      richText: [
        { id: crypto.randomUUID(), type: 'p', children: [{ text: 'Hello', bold: false }] },
      ],
    });
    page.elements = [text];
    patchElement(document, page.id, text.id, { bold: true });
    expect(text.bold).toBe(true);
    expect(text.richText.flatMap(paragraph => paragraph.children).every(run => run.bold)).toBe(
      true
    );
    patchElement(document, page.id, text.id, { x: 200 });
    expect(text.richText).toHaveLength(1);
    patchElement(document, page.id, text.id, { text: 'New' });
    expect(text).toMatchObject({ text: 'New', richText: [] });
    const richText = [
      { id: crypto.randomUUID(), type: 'p' as const, children: [{ text: 'Styled', italic: true }] },
    ];
    patchElement(document, page.id, text.id, {
      text: 'Styled',
      richText,
    });
    expect(text.richText).toEqual(richText);
  });
  it('merges partial captions independently and accepts non-caption post patches', () => {
    const document = createDocument('single', 'Captions');
    const post = document.posts[0];
    post.captions = { instagram: 'IG', linkedin: 'LI', facebook: 'FB' };
    patchPost(document, post.id, { title: 'Updated', captions: { instagram: 'New' } });
    expect(post).toMatchObject({
      title: 'Updated',
      captions: { instagram: 'New', linkedin: 'LI', facebook: 'FB' },
    });
    patchPost(document, post.id, { action: 'Join' });
    expect(post.action).toBe('Join');
    patchPost(document, 'missing', { captions: { facebook: 'Stale' } });
    expect(post.captions.facebook).toBe('FB');
  });
  it('remaps brand colors and fonts while retaining independently styled pages and elements', () => {
    const document = createDocument('single', 'Brand');
    document.posts = [];
    document.pages = [defaultBrand.background, defaultBrand.foreground, '#010203'].map(
      background => ({ ...makePage('Brand', 'square'), background })
    );
    document.pages[0].elements = [
      element('rect', { fill: defaultBrand.background, font: defaultBrand.font }),
      element('rect', { fill: defaultBrand.foreground, font: defaultBrand.bodyFont }),
      element('rect', { fill: defaultBrand.accent, font: 'Inter' }),
      element('rect', { fill: '#010203', font: 'Inter' }),
    ];
    const brand = {
      ...defaultBrand,
      background: '#101010',
      foreground: '#202020',
      accent: '#303030',
      font: 'Inter' as const,
      bodyFont: 'Manrope' as const,
    };
    applyBrand(document, brand);
    expect(document.pages.map(page => page.background)).toEqual(['#101010', '#202020', '#010203']);
    expect(document.pages[0].elements.map(node => node.fill)).toEqual([
      '#101010',
      '#202020',
      '#303030',
      '#010203',
    ]);
    expect(document.pages[0].elements.map(node => node.font)).toEqual([
      'Inter',
      'Manrope',
      'Inter',
      'Inter',
    ]);
    expect(document.brand).toEqual(brand);
    expect(document.brand).not.toBe(brand);
  });
});
