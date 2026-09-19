import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { createDocument, makePage } from '../templates';
import { documentSchema, dateForDay, element, validateExport, defaultBrand } from '../document';
import { initialize, patchElement, readDocument, removeElement } from '../collaboration';
import { applyProposal } from '../ai-proposal';
import { resizePage } from '../layout';
import { patchPost } from '../collaboration';
describe('studio document', () => {
  it('creates an event announcement as one feed post with editable checklist copy', () => {
    const d = createDocument('event', 'Versammlung', defaultBrand, 4, 'checklist');
    expect(documentSchema.safeParse(d).success).toBe(true);
    expect(d.posts).toHaveLength(1);
    expect(d.posts[0].kind).toBe('single');
    expect(d.pages[0].elements[2].text).toContain('01  Ersten Punkt ergänzen');
  });
  it('preserves a blank template when applying generated slide copy and ignores stale post updates', () => {
    const d = createDocument('single', 'Blank', defaultBrand, 4, 'blank');
    const result = applyProposal(d, {
      title: 'AI',
      posts: [
        {
          title: 'Updated',
          action: 'Join',
          instagram: '',
          linkedin: '',
          facebook: '',
          slides: [{ title: 'Slide', text: 'Body' }],
        },
      ],
    });
    expect(result.pages[0].elements).toEqual([]);
    expect(result.pages[0].name).toBe('Slide');
    const y = new Y.Doc();
    try {
      initialize(y, d);
      patchPost(y, 'deleted', { title: 'Stale', captions: { instagram: 'Stale' } });
      expect(readDocument(y)).toEqual(d);
    } finally {
      y.destroy();
    }
  });
  it('provides a blank canvas and square layouts within their export dimensions', () => {
    expect(makePage('Blank', 'feed', defaultBrand, 0, 'blank').elements).toEqual([]);
    const square = makePage('Square', 'square');
    expect(square.elements[1]).toMatchObject({ y: 210, height: 350 });
    expect(square.elements[2].y).toBe(640);
    expect(square.elements[3].y).toBe(980);
  });
  it.each([
    { x: -1100, y: 0 },
    { x: 0, y: -1100 },
    { x: 1081, y: 0 },
    { x: 0, y: 1351 },
  ])('reports objects completely outside the export canvas at %j', position => {
    const d = createDocument('single', 'Test');
    d.pages[0].elements = [element('rect', { width: 100, height: 100, ...position })];
    expect(validateExport(d)).toEqual(['Test: element outside page']);
  });
  it('keeps template-specific quote, invitation and explanation content editable with optional group branding', () => {
    for (const format of ['story', 'feed'] as const) {
      const brand = { ...defaultBrand, logoAssetId: crypto.randomUUID() };
      const quote = makePage('Titel', format, brand, 0, 'quote');
      expect(quote.elements[1]).toMatchObject({ text: '„Titel“', align: 'center' });
      expect(quote.elements.at(-1)).toMatchObject({
        type: 'image',
        assetId: brand.logoAssetId,
        y: format === 'story' ? 250 : 70,
      });
      const invitation = makePage('Termin', format, brand, 0, 'invitation');
      expect(invitation.elements[2].text).toContain('Datum');
      expect(invitation.elements[3].height).toBe(12);
      const explanation = makePage('Ablauf', format, brand, 1, 'explanation');
      expect(explanation.elements[0].text).toBe('SCHRITT 02');
      expect(explanation.elements[3].width).toBe(220);
    }
  });
  it('rejects duplicate page, post and element IDs before any export', () => {
    for (const field of ['pages', 'posts', 'elements']) {
      const d = createDocument('single', 'Test');
      if (field === 'elements') d.pages[0].elements.push(d.pages[0].elements[0]);
      else if (field === 'pages') d.pages.push(d.pages[0]);
      else d.posts.push(d.posts[0]);
      expect(documentSchema.safeParse(d).success).toBe(false);
    }
  });
  it('leaves unmatched AI slides and posts intact and never changes the original document', () => {
    const original = createDocument('carousel', 'Original'),
      before = structuredClone(original);
    const suggestion = {
      title: 'AI',
      posts: [{ title: 'Post', action: '', instagram: '', linkedin: '', facebook: '', slides: [] }],
    };
    const next = applyProposal(original, suggestion);
    expect(next.pages).toEqual(original.pages);
    expect(original).toEqual(before);
    expect(applyProposal(original, { title: 'AI', posts: [] }).posts).toEqual(original.posts);
  });
  it('ignores repeated initialization and stale element mutations instead of reintroducing deleted content', () => {
    const d = createDocument('single', 'Original'),
      y = new Y.Doc();
    try {
      initialize(y, d);
      initialize(y, createDocument('single', 'Replacement'));
      patchElement(y, d.pages[0].id, 'deleted', { text: 'stale' }, 'local');
      patchElement(
        y,
        d.pages[0].id,
        d.pages[0].elements[0].id,
        { id: crypto.randomUUID() },
        'local'
      );
      expect(readDocument(y)).toEqual(d);
    } finally {
      y.destroy();
    }
  });
  it('adapts format variants while retaining editable elements', () => {
    const page = createDocument('single', 'Titel').pages[0];
    const square = resizePage(page, 'square');
    expect(square.format).toBe('square');
    for (const e of square.elements) {
      expect(e.x).toBeGreaterThanOrEqual(0);
      expect(e.y + e.height).toBeLessThanOrEqual(1080);
    }
    expect(square.elements[1].text).toBe('Titel');
    expect(page.format).toBe('feed');
  });
  it('rejects impossible calendar dates', () => {
    const doc = createDocument('single', 'Test');
    doc.startDate = '2026-02-30';
    expect(documentSchema.safeParse(doc).success).toBe(false);
  });
  it('creates an eight-week campaign with editable pages and stable references', () => {
    const d = createDocument('campaign', 'Gemeinsam', undefined, 8);
    expect(d.posts).toHaveLength(40);
    expect(d.pages).toHaveLength(136);
    expect(documentSchema.safeParse(d).success).toBe(true);
    expect(new Set(d.pages.flatMap(p => p.elements.map(e => e.id))).size).toBe(544);
  });
  it('rejects orphan references, oversized videos and unsafe colors', () => {
    const d = createDocument('video', 'Test');
    d.posts[0].pageIds.push(crypto.randomUUID());
    expect(documentSchema.safeParse(d).success).toBe(false);
    d.posts[0].pageIds.pop();
    d.pages[0].duration = 60;
    expect(documentSchema.safeParse(d).success).toBe(false);
    expect(() => element('rect', { fill: 'url(https://attacker.test)' })).toThrow();
  });
  it('computes campaign dates without daylight-saving shifts', () => {
    expect(dateForDay('2026-10-23', 4)).toBe('2026-10-27');
    expect(dateForDay('', 4)).toBe('');
  });
  it('flags missing media before rendering', () => {
    const d = createDocument('single', 'Test');
    d.pages[0].elements.push(element('image'));
    expect(validateExport(d)).toContain('Test: missing media');
  });
  it('applies AI to a copy without changing manual source data', () => {
    const d = createDocument('single', 'Original');
    const p = {
      title: 'Vorschlag',
      posts: [
        {
          title: 'Neu',
          action: 'Lesen',
          instagram: 'I',
          linkedin: 'L',
          facebook: 'F',
          slides: [{ title: 'Überschrift', text: 'Text' }],
        },
      ],
    };
    const next = applyProposal(d, p);
    expect(d.title).toBe('Original');
    expect(next.posts[0].captions.linkedin).toBe('L');
    expect(next.pages[0].elements[1].text).toBe('Überschrift');
  });
});
describe('simultaneous studio editing', () => {
  function peers() {
    const value = createDocument('single', 'Test');
    const first = new Y.Doc();
    initialize(first, value);
    const second = new Y.Doc();
    Y.applyUpdate(second, Y.encodeStateAsUpdate(first));
    return { first, second, value };
  }
  it('merges captions independently across channels', () => {
    const { first, second, value } = peers();
    const id = value.posts[0].id;
    patchPost(first, id, { captions: { instagram: 'Instagram draft' } });
    patchPost(second, id, { captions: { linkedin: 'LinkedIn draft' } });
    Y.applyUpdate(first, Y.encodeStateAsUpdate(second));
    expect(readDocument(first).posts[0].captions).toEqual({
      instagram: 'Instagram draft',
      linkedin: 'LinkedIn draft',
      facebook: '',
    });
  });
  it('merges independent properties and simultaneous text insertions', () => {
    const { first, second, value } = peers();
    const page = value.pages[0],
      e = page.elements[1];
    patchElement(first, page.id, e.id, { text: 'A ' + e.text, x: 123 }, 'local');
    patchElement(second, page.id, e.id, { text: e.text + ' B', fill: '#AABBCC' }, 'local');
    const a = Y.encodeStateAsUpdate(first),
      b = Y.encodeStateAsUpdate(second);
    Y.applyUpdate(first, b);
    Y.applyUpdate(second, a);
    expect(readDocument(first)).toEqual(readDocument(second));
    const result = readDocument(first).pages[0].elements[1];
    expect(result.text).toBe('A Test B');
    expect(result.x).toBe(123);
    expect(result.fill).toBe('#AABBCC');
  });
  it('does not resurrect an element deleted while another peer edits it', () => {
    const { first, second, value } = peers();
    const page = value.pages[0],
      e = page.elements[1];
    removeElement(first, page.id, e.id);
    patchElement(second, page.id, e.id, { x: 200 }, 'local');
    Y.applyUpdate(first, Y.encodeStateAsUpdate(second));
    expect(readDocument(first).pages[0].elements.some(x => x.id === e.id)).toBe(false);
  });
  it('undoes only the local author', () => {
    const { first, second, value } = peers();
    const page = value.pages[0],
      e = page.elements[1];
    const origin = {};
    const undo = new Y.UndoManager(first.getMap('pages'), { trackedOrigins: new Set([origin]) });
    patchElement(first, page.id, e.id, { x: 200 }, origin);
    patchElement(second, page.id, e.id, { fill: '#AABBCC' }, {});
    Y.applyUpdate(first, Y.encodeStateAsUpdate(second));
    undo.undo();
    const result = readDocument(first).pages[0].elements[1];
    expect(result.x).toBe(e.x);
    expect(result.fill).toBe('#AABBCC');
  });
});
