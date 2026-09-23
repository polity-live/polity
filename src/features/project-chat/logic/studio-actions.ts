import { patchElement, applyBrand } from '@/features/communication-studio/logic/collaboration';
import {
  themeToLegacyBrand,
  type StudioThemeSnapshot,
} from '@/features/communication-studio/logic/theme';
import {
  documentSchema,
  element,
  type StudioDocument,
  type StudioElement,
} from '@/features/communication-studio/logic/document';
import { makePage } from '@/features/communication-studio/logic/templates';
import { resizePage } from '@/features/communication-studio/logic/layout';
import { ProjectToolError, registerRef, resolveRef, type StudioAction } from './contracts';

function unique(ids: string[]) {
  if (new Set(ids).size !== ids.length)
    throw new ProjectToolError('invalid_action', 'Duplicate resource');
  return ids;
}
function checkProperties(type: StudioElement['type'], patch: Record<string, unknown>) {
  const text = ['text', 'font', 'fontSize', 'bold', 'align'];
  const media = ['assetId', 'fit', 'cropX', 'cropY'];
  const video = ['trimStart', 'muted'];
  if (
    Object.keys(patch).some(
      key =>
        (text.includes(key) && type !== 'text') ||
        (media.includes(key) && !['image', 'video'].includes(type)) ||
        (video.includes(key) && type !== 'video')
    )
  )
    throw new ProjectToolError('invalid_action', 'Property does not apply to this element type');
}
export function applyStudioActions(
  input: StudioDocument,
  actions: StudioAction[],
  options: {
    createId?: () => string;
    themes?: Record<string, StudioThemeSnapshot>;
  } = {}
) {
  const value = structuredClone(input);
  const createdRefs: Record<string, string> = Object.create(null);
  const createId = options.createId ?? (() => crypto.randomUUID());
  const resolve = (ref: Parameters<typeof resolveRef>[0]) => resolveRef(ref, createdRefs);
  const findPage = (ref: Parameters<typeof resolve>[0]) => {
    const page = value.pages.find(p => p.id === resolve(ref));
    if (!page) throw new ProjectToolError('invalid_reference');
    return page;
  };
  const assertUnlocked = (elements: StudioElement[]) => {
    if (elements.some(e => e.locked)) throw new ProjectToolError('locked_resource');
  };
  const reorder = <T extends { id: string; order: number }>(items: T[], ids: string[]) => {
    unique(ids);
    if (ids.length !== items.length || ids.some(id => !items.some(item => item.id === id)))
      throw new ProjectToolError('invalid_action', 'Reorder must contain every resource');
    items.forEach(item => {
      item.order = ids.indexOf(item.id);
    });
  };
  for (const action of actions) {
    switch (action.type) {
      case 'project.patch':
        Object.assign(value, action.patch);
        break;
      case 'theme.apply': {
        const theme = options.themes?.[`${action.themeId}:${action.mode}`];
        if (!theme)
          throw new ProjectToolError('permission_denied', 'Theme has not been authorized');
        applyBrand(value, themeToLegacyBrand(theme));
        break;
      }
      case 'page.add': {
        const page = makePage(action.name, action.format, value.brand, 0, action.template);
        page.id = registerRef(action.ref, createdRefs, createId);
        page.elements.forEach(e => {
          e.id = createId();
        });
        value.pages.sort((a, b) => a.order - b.order);
        if (action.index !== undefined && action.index > value.pages.length)
          throw new ProjectToolError('invalid_action');
        value.pages.splice(action.index ?? value.pages.length, 0, page);
        value.pages.forEach((p, index) => {
          p.order = index;
        });
        break;
      }
      case 'page.duplicate': {
        const original = findPage(action.page),
          copy = structuredClone(original);
        copy.id = registerRef(action.ref, createdRefs, createId);
        copy.name += ' · Copy';
        copy.order = Math.max(...value.pages.map(p => p.order)) + 1;
        const groups = new Map<string, string>();
        copy.elements.forEach(e => {
          e.id = createId();
          if (e.group) {
            if (!groups.has(e.group)) groups.set(e.group, createId());
            e.group = groups.get(e.group) ?? null;
          }
        });
        value.pages.push(copy);
        value.posts
          .filter(p => p.pageIds.includes(original.id))
          .forEach(p => p.pageIds.push(copy.id));
        break;
      }
      case 'page.patch':
        Object.assign(findPage(action.page), action.patch);
        break;
      case 'page.resize': {
        const page = findPage(action.page);
        assertUnlocked(page.elements);
        Object.assign(page, resizePage(page, action.format));
        break;
      }
      case 'page.reorder':
        reorder(value.pages, action.pages.map(resolve));
        break;
      case 'page.remove': {
        const page = findPage(action.page);
        assertUnlocked(page.elements);
        if (value.pages.length === 1)
          throw new ProjectToolError('invalid_action', 'The last page cannot be removed');
        value.pages = value.pages.filter(p => p.id !== page.id);
        value.posts.forEach(post => {
          post.pageIds = post.pageIds.filter(id => id !== page.id);
        });
        value.posts = value.posts.filter(post => post.pageIds.length > 0);
        break;
      }
      case 'element.add': {
        const page = findPage(action.page);
        checkProperties(action.elementType, action.properties);
        const created = element(action.elementType, {
          ...action.properties,
          id: registerRef(action.ref, createdRefs, createId),
          order: Math.max(-1, ...page.elements.map(e => e.order)) + 1,
        });
        if (created.table && !action.properties.table)
          for (const row of created.table.rows) {
            row.id = createId();
            for (const cell of row.cells) cell.id = createId();
          }
        if (created.chart && !action.properties.chart)
          for (const series of created.chart.series) series.id = createId();
        page.elements.push(created);

        break;
      }
      case 'element.patch':
      case 'element.remove': {
        const page = findPage(action.page);
        const target = page.elements.find(e => e.id === resolve(action.element));
        if (!target) throw new ProjectToolError('invalid_reference');
        assertUnlocked([target]);
        if (action.type === 'element.remove')
          page.elements = page.elements.filter(e => e !== target);
        else {
          checkProperties(target.type, action.patch);
          patchElement(value, page.id, target.id, action.patch);
        }
        break;
      }
      case 'element.reorder': {
        const page = findPage(action.page);
        assertUnlocked(page.elements);
        reorder(page.elements, action.elements.map(resolve));
        break;
      }
      case 'elements.group': {
        const page = findPage(action.page);
        const ids = unique(action.elements.map(resolve));
        const elements = ids.map(id => page.elements.find(e => e.id === id));
        if (elements.some(e => !e || e.group))
          throw new ProjectToolError('invalid_action', 'Group requires ungrouped elements');
        const group = createId();
        assertUnlocked(elements as StudioElement[]);
        elements.forEach(e => {
          if (e) e.group = group;
        });
        break;
      }
      case 'elements.ungroup': {
        const elements = findPage(action.page).elements.filter(e => e.group === action.groupId);
        if (!elements.length) throw new ProjectToolError('invalid_reference');
        assertUnlocked(elements);
        elements.forEach(e => {
          e.group = null;
        });
        break;
      }
      case 'post.add': {
        const pageIds = unique(action.pages.map(ref => findPage(ref).id));
        value.posts.push({
          id: registerRef(action.ref, createdRefs, createId),
          code: String(value.posts.length + 1),
          title: action.title,
          kind: action.kind,
          pageIds,
          day: action.day,
          action: action.cta,
          status: 'draft',
          assignee: '',
          captions: { instagram: '', linkedin: '', facebook: '', ...action.captions },
        });
        break;
      }
      case 'post.patch':
      case 'post.set_pages':
      case 'post.remove': {
        const post = value.posts.find(p => p.id === resolve(action.post));
        if (!post) throw new ProjectToolError('invalid_reference');
        if (action.type === 'post.remove') value.posts = value.posts.filter(p => p !== post);
        else if (action.type === 'post.set_pages')
          post.pageIds = unique(action.pages.map(ref => findPage(ref).id));
        else {
          const { captions, cta, ...patch } = action.patch;
          Object.assign(post, patch);
          if (captions) Object.assign(post.captions, captions);
          if (cta !== undefined) post.action = cta;
        }
        break;
      }
    }
  }
  return { value: documentSchema.parse(value), createdRefs };
}
