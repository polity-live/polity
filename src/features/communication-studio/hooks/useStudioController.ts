import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useStudioState } from '@/zero/communication-studio/useStudioState';
import { useStudioApi } from '@/zero/communication-studio/useStudioApi';
import { useStudioDocument } from './useStudioDocument';
import { createDocument, makePage } from '../logic/templates';
import {
  element,
  defaultBrand,
  formats,
  type StudioDocument,
  type StudioElement,
  type StudioBrand,
  type StudioPage,
} from '../logic/document';
import { applyProposal, type StudioProposal } from '../logic/ai-proposal';
import { addPage, patchPage, patchElement, patchPost } from '../logic/collaboration';
import { resizePage } from '../logic/layout';
export function useStudioController(
  groupId: string | null,
  id: string | undefined,
  open: (id: string) => void
) {
  const { user } = useAuth();
  const studioApi = useStudioApi();
  const { projects, exports, isLoading } = useStudioState(groupId, id);
  const identity = useMemo(
    () => ({ id: user?.id ?? '', name: user?.email?.split('@')[0] || 'Polity' }),
    [user?.id, user?.email]
  );
  const editor = useStudioDocument(id, identity);
  const [pageId, setPageId] = useState(''),
    [selected, setSelected] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [failure, setFailure] = useState(''),
    [kind, setKind] = useState<StudioDocument['kind']>('single'),
    [title, setTitle] = useState(''),
    [weeks, setWeeks] = useState(4),
    [core, setCore] = useState(3),
    [stories, setStories] = useState(2),
    [mode, setMode] = useState<'template' | 'ai'>('template'),
    [template, setTemplate] = useState('announcement'),
    [brief, setBrief] = useState(''),
    [proposal, setProposal] = useState<StudioProposal | null>(null),
    [themes, setThemes] = useState<any[]>([]),
    [sources, setSources] = useState<any[]>([]),
    [sourceType, setSourceType] = useState<'event' | 'amendment' | 'statement'>('event'),
    [playing, setPlaying] = useState(false),
    [time, setTime] = useState(0),
    [guides, setGuides] = useState(true),
    [format, setFormat] = useState('png'),
    [scope, setScope] = useState('post'),
    [photoEdit, setPhotoEdit] = useState<string | undefined>();
  const pages = editor.value?.pages ?? [],
    posts = editor.value?.posts ?? [];
  const page = pages.find(p => p.id === pageId) ?? pages[0];
  const post = posts.find(p => page && p.pageIds.includes(page.id));
  const active = page?.elements.find(e => e.id === selected[0]);
  const run = async <T>(work: () => Promise<T>) => {
    setBusy(true);
    setFailure('');
    try {
      return await work();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : String(e));
      studioApi.notifyError(e);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (groupId)
      void studioApi
        .request<any[]>('themes', { groupId })
        .then(setThemes)
        .catch(() => {
          /* Themes remain optional when temporarily unavailable. */
        });
  }, [groupId]);
  useEffect(() => {
    if (!playing) return;
    const start = performance.now();
    const timer = setInterval(() => {
      const now = (performance.now() - start) / 1000;
      setTime(now);
      if (now >= (page?.duration ?? 5)) {
        const sequence = pages.filter(p => post?.pageIds.includes(p.id));
        const next = sequence[sequence.findIndex(p => p.id === page?.id) + 1];
        if (next) setPageId(next.id);
        else setPlaying(false);
        setTime(0);
      }
    }, 40);
    return () => clearInterval(timer);
  }, [playing, page?.duration, page?.id]);
  useEffect(() => {
    if (id) return;
    try {
      const incoming = JSON.parse(sessionStorage.getItem('studio:statement-return') || 'null');
      if (incoming) {
        setTitle(incoming.title || 'Neuer Beitrag');
        setBrief(incoming.text || '');
        setKind(incoming.isStory ? 'story' : 'single');
      }
    } catch {
      /* Ignore an expired or malformed local draft. */
    }
  }, [id]);
  const generate = async (document: StudioDocument) => {
    const proposal: StudioProposal = { title: document.title, posts: [] };
    // Keep each provider response bounded, including an eight-week campaign.
    for (let i = 0; i < document.posts.length; i += 3) {
      const batch = document.posts.slice(i, i + 3);
      const suggestion = await studioApi.request<StudioProposal>('generate', {
        prompt: `Sprache: Deutsch. Kampagne: ${document.title}. Briefing: ${brief}. Quelle: ${JSON.stringify(document.source)}. Erzeuge exakt ${batch.length} Beiträge, fortlaufend ab ${i + 1}, in dieser Reihenfolge: ${batch.map(p => `${p.title}, ${p.kind}, ${p.pageIds.length} Seiten`).join('; ')}.`,
      });
      if (suggestion.posts.length !== batch.length)
        throw new Error('KI-Antwort unvollständig. Bitte erneut versuchen.');
      proposal.posts.push(...suggestion.posts);
    }
    return proposal;
  };
  const create = () =>
    run(async () => {
      let document = createDocument(kind, title || 'Neue Kampagne', defaultBrand, weeks, template, {
        core,
        stories,
      });
      if (mode === 'ai') {
        const suggestion = await generate(document);
        document = applyProposal(document, suggestion);
      } else if (brief.trim()) {
        const body = document.pages[0].elements.find(e => e.order === 2 && e.type === 'text');
        if (body) body.text = brief.slice(0, 10000);
      }
      const result = await studioApi.request<{ id: string }>('create', { groupId, document });
      open(result.id);
    });
  const select = (ids: string[]) => {
    const groups =
      page?.elements.filter(e => ids.includes(e.id) && e.group).map(e => e.group) ?? [];
    setSelected([
      ...new Set([
        ...ids,
        ...(page?.elements.filter(e => e.group && groups.includes(e.group)).map(e => e.id) ?? []),
      ]),
    ]);
  };
  const patch = (elementId: string, patch: Partial<StudioElement>) => {
    if (!page) return;
    const original = page.elements.find(e => e.id === elementId);
    editor.patchElement(page.id, elementId, patch);
    if (
      original &&
      selected.includes(elementId) &&
      (patch.x !== undefined || patch.y !== undefined)
    )
      for (const other of page.elements.filter(
        e => selected.includes(e.id) && e.id !== elementId && !e.locked
      ))
        editor.patchElement(page.id, other.id, {
          x: other.x + (patch.x ?? original.x) - original.x,
          y: other.y + (patch.y ?? original.y) - original.y,
        });
  };
  const add = (type: StudioElement['type']) => {
    if (!page) return;
    const e = element(type, {
      order: page.elements.length + 1,
      text: type === 'text' ? 'Neuer Text' : '',
      fill: editor.value?.brand.foreground,
      height: type === 'text' ? 180 : 300,
      width: type === 'text' ? 700 : 300,
    });
    editor.insertElement(page.id, e);
    setSelected([e.id]);
  };
  const upload = (file: File) =>
    run(async () => {
      if (!id || !page) return;
      const asset = await studioApi.upload(id, file);
      const e = element(asset.mime.startsWith('video') ? 'video' : 'image', {
        assetId: asset.id,
        x: 85,
        y: 600,
        width: 900,
        height: 650,
        order: page.elements.length + 1,
      });
      editor.insertElement(page.id, e);
      await editor.refreshAssets();
      setSelected([e.id]);
    });
  const duplicatePage = () => {
    if (!page || pages.length >= 300 || (post && post.pageIds.length >= 30)) return;
    const p = {
      ...structuredClone(page),
      id: crypto.randomUUID(),
      name: page.name.slice(0, 152) + ' · Kopie',
      order: Math.max(...pages.map(p => p.order)) + 1,
      elements: page.elements.map(e => ({ ...e, id: crypto.randomUUID(), group: null })),
    };
    if (
      post?.kind === 'video' &&
      pages
        .filter(page => post.pageIds.includes(page.id))
        .reduce((n, page) => n + page.duration, p.duration) > 60
    )
      return;
    editor.transact(d => {
      addPage(d, p);
      if (post) patchPost(d, post.id, { pageIds: [...post.pageIds, p.id] });
    });
    setPageId(p.id);
  };
  const removePage = () => {
    if (!page || pages.length === 1) return;
    editor.transact(d => {
      d.getMap('pages').delete(page.id);
      for (const post of posts) {
        const pageIds = post.pageIds.filter(p => p !== page.id);
        if (pageIds.length) patchPost(d, post.id, { pageIds });
        else d.getMap('posts').delete(post.id);
      }
    });
    setPageId('');
  };
  const exportMedia = () =>
    run(async () => {
      if (!id || !page) return;
      await studioApi.request('export', {
        projectId: id,
        format,
        pageIds: scope === 'all' ? [] : scope === 'page' ? [page.id] : (post?.pageIds ?? [page.id]),
        state: editor.state(),
      });
    });
  const applyTheme = (row: any) => {
    if (!editor.value) return;
    const fontMap: Record<string, StudioBrand['font']> = {
      newsreader: 'Newsreader',
      manrope: 'Manrope',
      inter: 'Inter',
      'open-sans': 'Open Sans',
      'ibm-plex-serif': 'IBM Plex Serif',
      'public-sans': 'Public Sans',
      'pt-sans': 'PT Sans',
      'work-sans': 'Work Sans',
      ubuntu: 'Ubuntu',
      'jetbrains-mono': 'JetBrains Mono',
    };
    const palette = row.light_palette;
    const brand: StudioBrand = {
      ...editor.value.brand,
      background: palette.background,
      foreground: palette.foreground,
      accent: palette.accent,
      font: fontMap[row.fonts.display] || 'Newsreader',
      bodyFont: fontMap[row.fonts.sans] || 'Manrope',
      themeId: row.id,
      revisionId: row.revision_id,
    };
    updateBrand(brand);
  };
  const updateBrand = (brand: StudioBrand) => {
    const old = editor.value?.brand;
    if (!old) return;
    editor.meta('brand', brand);
    for (const p of pages) {
      editor.patchPage(p.id, {
        background:
          p.background === old.background
            ? brand.background
            : p.background === old.foreground
              ? brand.foreground
              : p.background,
      });
      for (const e of p.elements)
        editor.patchElement(p.id, e.id, {
          fill:
            e.fill === old.background
              ? brand.background
              : e.fill === old.foreground
                ? brand.foreground
                : e.fill === old.accent
                  ? brand.accent
                  : e.fill,
          font:
            e.font === old.font ? brand.font : e.font === old.bodyFont ? brand.bodyFont : e.font,
        });
    }
  };
  const source = (s: any) => {
    if (!page) return;
    editor.meta('source', s);
    editor.meta('title', s.title);
    const texts = page.elements.filter(e => e.type === 'text');
    if (texts[1]) patch(texts[1].id, { text: s.title });
    if (texts[2]) patch(texts[2].id, { text: s.text });
  };
  const ai = () =>
    run(async () => {
      if (!editor.value) return;
      setProposal(await generate(editor.value));
    });
  const acceptAI = () => {
    if (!proposal || !editor.value) return;
    const next = applyProposal(editor.value, proposal);
    editor.meta('title', next.title);
    for (const p of next.pages) {
      editor.patchPage(p.id, { name: p.name });
      for (const e of p.elements) editor.patchElement(p.id, e.id, { text: e.text });
    }
    for (const p of next.posts) editor.patchPost(p.id, p);
    setProposal(null);
  };
  return {
    ...editor,
    projects,
    exports,
    isLoading,
    id,
    groupId,
    page,
    post,
    active,
    selected,
    select,
    pageId,
    setPageId,
    busy,
    failure,
    kind,
    setKind,
    title,
    setTitle,
    weeks,
    setWeeks,
    core,
    setCore,
    stories,
    setStories,
    mode,
    setMode,
    template,
    setTemplate,
    brief,
    setBrief,
    proposal,
    setProposal,
    themes,
    sources,
    sourceType,
    setSourceType,
    playing,
    setPlaying,
    time,
    guides,
    setGuides,
    format,
    setFormat,
    scope,
    setScope,
    photoEdit,
    setPhotoEdit,
    run,
    actions: studioApi,
    create,
    patch,
    add,
    upload,
    duplicatePage,
    changeFormat: (format: StudioPage['format']) => {
      if (!page) return;
      const next = resizePage(page, format);
      editor.transact(d => {
        patchPage(d, page.id, { format });
        for (const e of next.elements) patchElement(d, page.id, e.id, e, 'layout');
      });
    },
    movePage: (direction: number) => {
      if (!page || !editor.value) return;
      const pages = [...editor.value.pages];
      const index = pages.findIndex(p => p.id === page.id);
      const target = index + direction;
      if (target < 0 || target >= pages.length) return;
      [pages[index], pages[target]] = [pages[target], pages[index]];
      editor.transact(d => pages.forEach((p, order) => patchPage(d, p.id, { order })));
    },
    removePage,
    exportMedia,
    applyTheme,
    updateBrand,
    applyLogo: () => {
      if (!active?.assetId || !editor.value) return;
      const old = editor.value.brand.logoAssetId;
      editor.meta('brand', { ...editor.value.brand, logoAssetId: active.assetId });
      for (const p of editor.value.pages) {
        const existing = old && p.elements.find(e => e.type === 'image' && e.assetId === old);
        if (existing) editor.patchElement(p.id, existing.id, { assetId: active.assetId });
        else
          editor.insertElement(
            p.id,
            element('image', {
              assetId: active.assetId,
              x: 860,
              y: p.format === 'story' ? 250 : 70,
              width: 140,
              height: 100,
              order: Math.max(0, ...p.elements.map(e => e.order)) + 1,
            })
          );
      }
    },
    source,
    ai,
    acceptAI,
    loadSources: () =>
      run(async () => setSources(await studioApi.request<any[]>('sources', { type: sourceType }))),
    deleteSelected: () => {
      if (page) for (const el of selected) editor.removeElement(page.id, el);
      setSelected([]);
    },
    duplicateSelected: () => {
      if (page)
        for (const e of page.elements.filter(e => selected.includes(e.id)))
          editor.insertElement(page.id, {
            ...e,
            id: crypto.randomUUID(),
            x: e.x + 30,
            y: e.y + 30,
            order: page.elements.length + 1,
            group: null,
          });
    },
    groupSelected: () => {
      if (page) {
        const group = crypto.randomUUID();
        for (const el of selected) editor.patchElement(page.id, el, { group });
      }
    },
    ungroup: () => {
      if (page) for (const el of selected) editor.patchElement(page.id, el, { group: null });
    },
    align: () => {
      if (page)
        for (const el of selected) {
          const e = page.elements.find(e => e.id === el);
          if (e) editor.patchElement(page.id, el, { x: (formats[page.format][0] - e.width) / 2 });
        }
    },
    savePhoto: (file: File) =>
      run(async () => {
        if (!id || !active || !page) return false;
        const asset = await studioApi.upload(id, file);
        editor.patchElement(page.id, active.id, { assetId: asset.id });
        await editor.refreshAssets();
        setPhotoEdit(undefined);
        return true;
      }),
    insertPage: () => {
      if (!editor.value || editor.value.pages.length >= 300 || (post && post.pageIds.length >= 30))
        return;
      const p = makePage(
        'Neue Seite',
        page?.format ?? 'feed',
        editor.value.brand,
        editor.value.pages.length,
        template
      );
      if (
        post?.kind === 'video' &&
        pages
          .filter(page => post.pageIds.includes(page.id))
          .reduce((n, page) => n + page.duration, p.duration) > 60
      )
        return;
      editor.transact(d => {
        addPage(d, p);
        if (post) patchPost(d, post.id, { pageIds: [...post.pageIds, p.id] });
      });
      setPageId(p.id);
    },
  };
}
