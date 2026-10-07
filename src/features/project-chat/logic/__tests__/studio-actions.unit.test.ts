import { describe, expect, it } from 'vitest';
import { createDocument } from '@/features/communication-studio/logic/templates';
import { element } from '@/features/communication-studio/logic/document';
import {
  DEFAULT_STUDIO_THEME,
  themeToLegacyBrand,
} from '@/features/communication-studio/logic/theme';
import { applyStudioActions } from '../studio-actions';
import { type StudioAction } from '../contracts';

const ref = (id: string) => ({ id });
function fixture() {
  const document = createDocument('single', 'Original');
  const page = document.pages[0];
  page.elements = [element('text', { text: 'First', order: 0 }), element('rect', { order: 1 })];
  return { document, page, first: page.elements[0], second: page.elements[1] };
}
describe('Studio project action semantics', () => {
  it('inserts a populated page among existing pages with independent element identities', () => {
    const { document } = fixture();
    const extended = applyStudioActions(document, [
      { type: 'page.add', ref: 'first', name: 'First addition', format: 'feed', template: 'blank' },
    ]).value;
    const changed = applyStudioActions(extended, [
      {
        type: 'page.add',
        ref: 'second',
        name: 'Second addition',
        format: 'feed',
        template: 'announcement',
        index: 1,
      },
    ]).value;
    expect(changed.pages.map(page => page.name)).toEqual([
      document.pages[0].name,
      'Second addition',
      'First addition',
    ]);
    expect(changed.pages[1].elements.length).toBeGreaterThan(0);
    expect(new Set(changed.pages.flatMap(page => page.elements.map(e => e.id))).size).toBe(
      changed.pages.reduce((total, page) => total + page.elements.length, 0)
    );
    expect(changed.pages.map(page => page.order)).toEqual([0, 1, 2]);
  });
  it('rejects an unknown page identifier and an order containing foreign elements', () => {
    const { document, page, first } = fixture();
    expect(() =>
      applyStudioActions(document, [
        { type: 'page.patch', page: ref(crypto.randomUUID()), patch: { name: 'Missing' } },
      ])
    ).toThrow('invalid_reference');
    expect(() =>
      applyStudioActions(document, [
        {
          type: 'element.reorder',
          page: ref(page.id),
          elements: [ref(first.id), ref(crypto.randomUUID())],
        },
      ])
    ).toThrow('Reorder must contain every resource');
  });
  it('appends pages by default, duplicates ungrouped elements and preserves posts without a caption patch', () => {
    const { document, page } = fixture();
    const result = applyStudioActions(document, [
      { type: 'project.patch', patch: { title: 'Updated' } },
      { type: 'page.add', ref: 'append', name: 'Appended', format: 'feed', template: 'blank' },
      { type: 'page.duplicate', page: ref(page.id), ref: 'ungrouped' },
      { type: 'post.patch', post: ref(document.posts[0].id), patch: { title: 'Retitled' } },
    ]).value;
    expect(result.title).toBe('Updated');
    expect(result.pages.find(p => p.name === 'Appended')!.order).toBe(1);
    expect(result.pages.at(-1)!.elements.every(e => e.group === null)).toBe(true);
    expect(result.posts[0].captions).toEqual(document.posts[0].captions);
  });
  it('applies only an authorized theme and preserves a caption-only post patch', () => {
    const { document } = fixture();
    const theme = DEFAULT_STUDIO_THEME;
    const result = applyStudioActions(
      document,
      [
        { type: 'theme.apply', themeId: theme.themeId, mode: theme.mode },
        {
          type: 'post.patch',
          post: ref(document.posts[0].id),
          patch: { captions: { instagram: 'Changed' } },
        },
      ],
      { themes: { [`${theme.themeId}:${theme.mode}`]: theme } }
    ).value;
    expect(result.brand).toEqual(themeToLegacyBrand(theme));
    expect(result.posts[0].action).toBe(document.posts[0].action);
    expect(result.posts[0].captions.instagram).toBe('Changed');
  });
  it.each(['page.resize', 'page.remove', 'element.reorder', 'elements.ungroup'])(
    'blocks %s when it would change a locked element',
    type => {
      const { document, page, first, second } = fixture();
      first.locked = true;
      first.group = crypto.randomUUID();
      const action = {
        'page.resize': { type, page: ref(page.id), format: 'story' },
        'page.remove': { type, page: ref(page.id) },
        'element.reorder': { type, page: ref(page.id), elements: [ref(second.id), ref(first.id)] },
        'elements.ungroup': { type, page: ref(page.id), groupId: first.group },
      }[type] as StudioAction;
      expect(() => applyStudioActions(document, [action])).toThrow('locked_resource');
    }
  );
  it('duplicates grouped pages with fresh identities and maintains post membership and page order', () => {
    const { document, page, first, second } = fixture();
    first.group = second.group = crypto.randomUUID();
    const original = structuredClone(document);
    const result = applyStudioActions(document, [
      { type: 'page.duplicate', page: ref(page.id), ref: 'copy' },
      { type: 'page.patch', page: { localRef: 'copy' }, patch: { name: 'Copied' } },
      { type: 'page.reorder', pages: [{ localRef: 'copy' }, ref(page.id)] },
    ]);
    const copy = result.value.pages.find(p => p.id === result.createdRefs.copy)!;
    expect(copy.name).toBe('Copied');
    expect(copy.order).toBe(0);
    expect(copy.elements.map(e => e.id)).not.toEqual(page.elements.map(e => e.id));
    expect(copy.elements[0].group).toBe(copy.elements[1].group);
    expect(copy.elements[0].group).not.toBe(first.group);
    expect(result.value.posts[0].pageIds).toContain(copy.id);
    expect(document).toEqual(original);
    const removed = applyStudioActions(result.value, [{ type: 'page.remove', page: ref(page.id) }]);
    expect(removed.value.pages).toHaveLength(1);
    expect(removed.value.posts[0].pageIds).toEqual([copy.id]);
  });
  it('inserts and resizes a page and removes posts whose only page disappears', () => {
    const { document, page } = fixture();
    const result = applyStudioActions(document, [
      {
        type: 'page.add',
        ref: 'blank',
        name: 'Blank',
        format: 'feed',
        template: 'blank',
        index: 0,
      },
      { type: 'page.resize', page: { localRef: 'blank' }, format: 'story' },
      { type: 'page.remove', page: ref(page.id) },
    ]);
    expect(result.value.pages[0]).toMatchObject({ name: 'Blank', format: 'story' });
    expect(result.value.posts).toEqual([]);
  });
  it('groups, reorders and ungroups elements without altering the source', () => {
    const { document, page, first, second } = fixture();
    const grouped = applyStudioActions(document, [
      { type: 'elements.group', page: ref(page.id), elements: [ref(first.id), ref(second.id)] },
      { type: 'element.reorder', page: ref(page.id), elements: [ref(second.id), ref(first.id)] },
    ]).value;
    expect(grouped.pages[0].elements[0].order).toBe(1);
    const groupId = grouped.pages[0].elements[0].group!;
    expect(grouped.pages[0].elements[1].group).toBe(groupId);
    const ungrouped = applyStudioActions(grouped, [
      { type: 'elements.ungroup', page: ref(page.id), groupId },
    ]).value;
    expect(ungrouped.pages[0].elements.every(e => e.group === null)).toBe(true);
    expect(document.pages[0].elements.every(e => e.group === null)).toBe(true);
  });
  it('creates native table cells and chart series with unique identifiers and removes an element', () => {
    const { document, page, first } = fixture();
    const result = applyStudioActions(document, [
      {
        type: 'element.add',
        ref: 'table',
        page: ref(page.id),
        elementType: 'table',
        properties: {},
      },
      {
        type: 'element.add',
        ref: 'chart',
        page: ref(page.id),
        elementType: 'chart',
        properties: {},
      },
      { type: 'element.remove', page: ref(page.id), element: ref(first.id) },
    ]).value;
    expect(result.pages[0].elements.some(e => e.id === first.id)).toBe(false);
    const cells = result.pages[0].elements
      .find(e => e.type === 'table')!
      .table!.rows.flatMap(r => r.cells);
    expect(new Set(cells.map(c => c.id)).size).toBe(cells.length);
    expect(
      result.pages[0].elements.find(e => e.type === 'chart')!.chart!.series[0].id
    ).toBeTruthy();
  });
  it('creates, edits, remaps and removes a post while preserving existing caption channels', () => {
    const { document, page } = fixture();
    const result = applyStudioActions(document, [
      {
        type: 'post.add',
        ref: 'post',
        title: 'New',
        kind: 'single',
        pages: [ref(page.id)],
        day: 2,
        cta: 'Join',
        captions: { instagram: 'Hello' },
      },
      {
        type: 'post.patch',
        post: { localRef: 'post' },
        patch: { title: 'Updated', captions: { linkedin: 'News' }, cta: '' },
      },
      { type: 'post.set_pages', post: { localRef: 'post' }, pages: [ref(page.id)] },
    ]);
    const post = result.value.posts.find(p => p.id === result.createdRefs.post)!;
    expect(post).toMatchObject({
      title: 'Updated',
      action: '',
      captions: { instagram: 'Hello', linkedin: 'News', facebook: '' },
      pageIds: [page.id],
    });
    expect(
      applyStudioActions(result.value, [{ type: 'post.remove', post: ref(post.id) }]).value.posts
    ).toHaveLength(document.posts.length);
  });
  it.each(['font', 'assetId', 'muted'])(
    'rejects the incompatible %s property atomically',
    property => {
      const { document, page, second } = fixture();
      const original = structuredClone(document);
      expect(() =>
        applyStudioActions(document, [
          {
            type: 'element.patch',
            page: ref(page.id),
            element: ref(second.id),
            patch: { [property]: 'invalid' },
          } as StudioAction,
        ])
      ).toThrow('Property does not apply');
      expect(document).toEqual(original);
    }
  );
  it('rejects missing resources, incomplete orderings, duplicates, protected groups and removal of the last page', () => {
    const { document, page, first, second } = fixture();
    const missing = ref(crypto.randomUUID());
    const invalid: StudioAction[][] = [
      [{ type: 'page.remove', page: ref(page.id) }],
      [{ type: 'page.reorder', pages: [ref(page.id), ref(page.id)] }],
      [{ type: 'element.reorder', page: ref(page.id), elements: [ref(first.id)] }],
      [{ type: 'elements.group', page: ref(page.id), elements: [ref(first.id), missing] }],
      [{ type: 'elements.ungroup', page: ref(page.id), groupId: crypto.randomUUID() }],
      [{ type: 'element.remove', page: ref(page.id), element: missing }],
      [{ type: 'post.remove', post: missing }],
      [
        {
          type: 'page.add',
          ref: 'too-far',
          name: 'New',
          format: 'feed',
          template: 'blank',
          index: 9,
        },
      ],
      [{ type: 'theme.apply', themeId: crypto.randomUUID(), mode: 'light' }],
    ];
    for (const actions of invalid) expect(() => applyStudioActions(document, actions)).toThrow();
    first.group = crypto.randomUUID();
    expect(() =>
      applyStudioActions(document, [
        { type: 'elements.group', page: ref(page.id), elements: [ref(first.id), ref(second.id)] },
      ])
    ).toThrow('ungrouped');
  });
});
