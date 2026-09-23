import { useZero } from '@rocicorp/zero/react';
import { mutators } from '@/zero/mutators';
import { serverConfirmed } from '@/zero/mutate-with-server-check';
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useStudioState } from '@/zero/communication-studio/useStudioState';
import { useStudioApi } from '@/zero/communication-studio/useStudioApi';
import { useUserState } from '@/zero/users/useUserState';
import { useStudioDocument } from './useStudioDocument';
import {
  element,
  formats,
  type StudioDocument,
  type StudioElement,
  type StudioPage,
} from '../logic/document';
import { applyProposal, type StudioProposal } from '../logic/ai-proposal';
import { addPage, patchPage, patchElement, patchPost } from '../logic/collaboration';
import { resizePage } from '../logic/layout';
import {
  createFrameNode,
  framePresetRegistry,
  type FramePresetId,
  type StudioDocumentV3,
} from '../logic/document-v3';
import { applyStudioCommandV3, type StudioCommandV3 } from '../logic/commands-v3';
import { createTableData, type TableDimensions } from '../logic/table-operations';
import { BUILTIN_THEMES } from '@/features/shared/appearance-theme';
import {
  activePalette,
  applyThemeSnapshot,
  applyTextStyleToNode,
  createThemeSnapshot,
  themeFromApiRow,
  type StudioThemeSnapshot,
} from '../logic/theme';
import {
  elementSetListItemSchema,
  elementSetSnapshotSchema,
  instantiateElementSet,
  type ElementSetListItem,
} from '../logic/element-library';

const presetByFormat: Record<StudioPage['format'], FramePresetId> = {
  feed: 'portrait',
  square: 'square',
  story: 'story',
  widescreen: 'widescreen',
  standard: 'standard',
};

function runV3Command(document: StudioDocumentV3, command: StudioCommandV3) {
  Object.assign(document, applyStudioCommandV3(document, command));
}

function nextRootFrameX(document: StudioDocumentV3) {
  const frames = document.nodes.filter(
    node =>
      node.type === 'frame' && !node.parentFrameId && node.id !== document.masterLayout.frameId
  );
  return frames.length
    ? Math.max(...frames.map(frame => frame.transform.x + frame.transform.width)) + 160
    : 0;
}
export function useStudioController(
  groupId: string | null,
  id: string | undefined,
  open: (id: string) => void,
  workspaceId?: string
) {
  const zero = useZero();
  const { user } = useAuth();
  const { currentUser } = useUserState();
  const studioApi = useStudioApi();
  const { projects, exports, isLoading } = useStudioState(groupId, id);
  const identity = useMemo(
    () => ({
      id: user?.id ?? '',
      name:
        [currentUser?.first_name, currentUser?.last_name].filter(Boolean).join(' ') ||
        currentUser?.handle ||
        user?.email?.split('@')[0] ||
        'Polity',
      firstName: currentUser?.first_name ?? null,
      lastName: currentUser?.last_name ?? null,
      avatarUrl: currentUser?.avatar ?? undefined,
    }),
    [
      currentUser?.avatar,
      currentUser?.first_name,
      currentUser?.handle,
      currentUser?.last_name,
      user?.email,
      user?.id,
    ]
  );
  const editor = useStudioDocument(id, identity, workspaceId);
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
    [themes, setThemes] = useState<StudioThemeSnapshot[]>(() =>
      BUILTIN_THEMES.map(theme => createThemeSnapshot(theme))
    ),
    [themeId, setThemeId] = useState(BUILTIN_THEMES[0].id),
    [themeMode, setThemeMode] = useState<'light' | 'dark'>('light'),
    [elementSets, setElementSets] = useState<ElementSetListItem[]>([]),
    [guides, setGuides] = useState(true),
    [format, setFormat] = useState('png'),
    [scope, setScope] = useState('post'),
    [photoEdit, setPhotoEdit] = useState<string | undefined>();
  const pages = editor.value?.pages ?? [],
    posts = editor.value?.posts ?? [];
  const page = pages.find(p => p.id === pageId) ?? pages[0];
  const post = posts.find(p => page && p.pageIds.includes(page.id));
  useEffect(() => {
    const followLink = () => {
      const target = new URLSearchParams(location.hash.slice(1)).get('canvas');
      if (target && pages.some(p => p.id === target)) setPageId(target);
    };
    followLink();
    window.addEventListener('hashchange', followLink);
    return () => window.removeEventListener('hashchange', followLink);
  }, [id, pages]);
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
    void studioApi
      .request<Record<string, unknown>[]>('themes', { groupId })
      .then(rows =>
        setThemes([
          ...BUILTIN_THEMES.map(theme => createThemeSnapshot(theme)),
          ...rows.map(themeFromApiRow),
        ])
      )
      .catch(() => {
        /* Builtin themes remain available when custom themes are temporarily unavailable. */
      });
  }, [groupId]);
  const refreshElementSets = async () => {
    const rows = await studioApi.request<unknown[]>('elementSets', { groupId });
    setElementSets(elementSetListItemSchema.array().parse(rows));
  };
  useEffect(() => {
    void refreshElementSets().catch(() => {
      /* The canvas remains usable while the Elements library is unavailable. */
    });
  }, [groupId, id]);
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
      const result = await studioApi.request<{ id: string }>('create', {
        groupId,
        title: title || 'Neue Kampagne',
        kind,
        themeId,
        themeMode,
        template: template.startsWith('project:')
          ? { kind: 'project', id: template.slice('project:'.length) }
          : { kind: 'builtin', id: template },
        campaign: { weeks, core, stories },
      });
      if (mode === 'ai') {
        const conversationId = crypto.randomUUID();
        await serverConfirmed(
          zero.mutate(
            mutators.projectChat.create({
              id: conversationId,
              scope: { kind: 'studio', projectId: result.id },
              name: title || 'Briefing',
            })
          )
        );
        localStorage.setItem(`project-chat:studio:${result.id}`, conversationId);
        sessionStorage.setItem(
          `studio-brief:${result.id}`,
          brief.trim() || `Gestalte ${title || 'Neue Kampagne'}.`
        );
      }
      open(result.id);
    });
  const select = (ids: string[]) => {
    const nodes = editor.v3Value?.nodes ?? [];
    const expanded = new Set(ids);
    for (const id of ids) {
      const groupId = nodes.find(node => node.id === id)?.groupIds[0];
      if (groupId)
        for (const node of nodes) if (node.groupIds[0] === groupId) expanded.add(node.id);
    }
    setSelected([...expanded]);
  };
  const selectExact = (ids: string[]) => setSelected([...new Set(ids)]);
  const move = (elementId: string, patch: Partial<StudioElement>) => {
    if (!page) return;
    const original = page.elements.find(e => e.id === elementId);
    editor.transact(d => {
      patchElement(d, page.id, elementId, patch);
      if (
        original &&
        selected.includes(elementId) &&
        (patch.x !== undefined || patch.y !== undefined)
      )
        for (const other of page.elements.filter(
          e => selected.includes(e.id) && e.id !== elementId && !e.locked
        ))
          patchElement(d, page.id, other.id, {
            x: other.x + (patch.x ?? original.x) - original.x,
            y: other.y + (patch.y ?? original.y) - original.y,
          });
    });
  };
  const patch = (id: string, change: Partial<StudioElement>) => {
    if (page) editor.transact(d => patchElement(d, page.id, id, change));
  };
  const transform = (changes: { id: string; patch: Partial<StudioElement> }[]) => {
    if (page)
      editor.transact(d => {
        for (const change of changes) patchElement(d, page.id, change.id, change.patch);
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
  const addTable = (dimensions: TableDimensions) => {
    if (!page) return null;
    const e = element('table', {
      order: page.elements.length + 1,
      fill: editor.value?.brand.foreground,
      height: Math.max(160, dimensions.rowCount * 60),
      width: Math.max(300, dimensions.colCount * 150),
      table: createTableData(dimensions),
    });
    editor.insertElement(page.id, e);
    setSelected([e.id]);
    return e.id;
  };
  const upload = (file: File) =>
    run(async () => {
      if (!id || !page) return;
      const asset = await studioApi.upload(id, file, workspaceId);
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
      d.pages = d.pages.filter(p => p.id !== page.id);
      for (const post of posts) {
        const pageIds = post.pageIds.filter(p => p !== page.id);
        if (pageIds.length) patchPost(d, post.id, { pageIds });
        else d.posts = d.posts.filter(p => p.id !== post.id);
      }
    });
    setPageId('');
  };
  const insertFrame = (format: StudioPage['format'] = page?.format ?? 'feed') => {
    if (!editor.value || editor.value.pages.length >= 300 || (post && post.pageIds.length >= 30))
      return;
    if (
      post?.kind === 'video' &&
      pages
        .filter(candidate => post.pageIds.includes(candidate.id))
        .reduce((duration, candidate) => duration + candidate.duration, 5) > 60
    )
      return;
    let frameId = '';
    editor.transactV3(document => {
      const preset = presetByFormat[format];
      const definition = framePresetRegistry[preset];
      const rootFrames = document.nodes.filter(
        node =>
          node.type === 'frame' && !node.parentFrameId && node.id !== document.masterLayout.frameId
      );
      const frame = createFrameNode(preset, {
        name: 'Neuer Frame',
        zIndex: rootFrames.length,
        transform: {
          x: nextRootFrameX(document),
          y: 0,
          width: definition.width,
          height: definition.height,
          rotation: 0,
          flipX: false,
          flipY: false,
        },
        style: {
          fill: null,
          fillBinding: null,
          stroke: '#888888',
          strokeBinding: null,
          strokeWidth: 1,
          strokeStyle: 'solid',
          opacity: 1,
          cornerRadius: 0,
          roughness: 0,
        },
      });
      frameId = frame.id;
      runV3Command(document, { type: 'createNodes', nodes: [frame] });
      const deliverable = post
        ? document.deliverables.find(candidate => candidate.id === post.id)
        : undefined;
      if (deliverable)
        runV3Command(document, {
          type: 'upsertDeliverable',
          deliverable: {
            ...deliverable,
            frameIds: [...deliverable.frameIds, frame.id],
          },
        });
    });
    if (frameId) setPageId(frameId);
  };
  const insertFrameSet = (kind: 'single' | 'carousel' | 'story' | 'video') => {
    if (!editor.value) return;
    const count = kind === 'single' ? 1 : kind === 'story' ? 3 : 5;
    if (editor.value.pages.length + count > 300) return;
    const format: StudioPage['format'] = kind === 'story' || kind === 'video' ? 'story' : 'feed';
    let firstFrameId = '';
    editor.transactV3(document => {
      const preset = presetByFormat[format];
      const definition = framePresetRegistry[preset];
      let x = nextRootFrameX(document);
      const rootCount = document.nodes.filter(
        node =>
          node.type === 'frame' && !node.parentFrameId && node.id !== document.masterLayout.frameId
      ).length;
      const frames = Array.from({ length: count }, (_, index) => {
        const name = `${kind === 'carousel' ? 'Karussell' : kind === 'story' ? 'Story' : kind === 'video' ? 'Szene' : 'Post'} ${index + 1}`;
        const frame = createFrameNode(preset, {
          name,
          zIndex: rootCount + index,
          transform: {
            x,
            y: 0,
            width: definition.width,
            height: definition.height,
            rotation: 0,
            flipX: false,
            flipY: false,
          },
          style: {
            fill: null,
            fillBinding: null,
            stroke: '#888888',
            strokeBinding: null,
            strokeWidth: 1,
            strokeStyle: 'solid',
            opacity: 1,
            cornerRadius: 0,
            roughness: 0,
          },
        });
        x += definition.width + 160;
        return frame;
      });
      firstFrameId = frames[0].id;
      runV3Command(document, { type: 'createNodes', nodes: frames });
      runV3Command(document, {
        type: 'upsertDeliverable',
        deliverable: {
          id: crypto.randomUUID(),
          code: String(document.deliverables.length + 1).padStart(2, '0'),
          title: frames[0].name,
          kind,
          frameIds: frames.map(frame => frame.id),
          channel: 'instagram',
          order: document.deliverables.length,
          status: 'draft',
          dayOffset: 0,
          scheduledAt: null,
          assignee: '',
          brief: '',
          captions: { instagram: '', linkedin: '', facebook: '' },
        },
      });
    });
    if (firstFrameId) setPageId(firstFrameId);
  };
  const exportMedia = () =>
    run(async () => {
      if (!id || !page) return;
      if (workspaceId)
        throw new Error(
          'Return to canonical content to export a committed project. Drafts can be downloaded from the canvas.'
        );
      await studioApi.request('export', {
        projectId: id,
        format,
        pageIds: scope === 'all' ? [] : scope === 'page' ? [page.id] : (post?.pageIds ?? [page.id]),
        revision: await editor.commit(),
      });
    });
  const applyTheme = (theme: StudioThemeSnapshot) => {
    editor.transactV3(document => applyThemeSnapshot(document, theme));
    setThemeId(theme.themeId);
    setThemeMode(theme.mode);
  };
  const changeThemeMode = (nextMode: 'light' | 'dark') => {
    const current = editor.v3Value?.theme;
    setThemeMode(nextMode);
    if (current) applyTheme({ ...current, mode: nextMode });
  };
  const applyTextStyle = (styleId: string) => {
    editor.transactV3(document => {
      const style = document.theme.textStyles.find(candidate => candidate.id === styleId);
      if (!style) return;
      const palette = activePalette(document.theme);
      for (const node of document.nodes)
        if (selected.includes(node.id) && node.type === 'richText')
          applyTextStyleToNode(node, style, palette);
    });
  };
  const saveSelectionToElements = () =>
    run(async () => {
      if (!id || !selected.length) throw new Error('Select elements first');
      await studioApi.request('elementSetCreate', {
        projectId: id,
        groupId,
        selectedIds: selected,
      });
      await refreshElementSets();
    });
  const insertElementSet = (
    setId: string,
    point: { x: number; y: number; targetFrameId?: string | null }
  ) =>
    run(async () => {
      if (!id) return;
      const result = await studioApi.request<{
        setId: string;
        revisionId: string;
        snapshot: unknown;
        assetIds: Record<string, string>;
      }>('elementSetInstantiate', { setId, projectId: id });
      const created = instantiateElementSet(elementSetSnapshotSchema.parse(result.snapshot), {
        setId: result.setId,
        revisionId: result.revisionId,
        targetFrameId: point.targetFrameId ?? page?.id ?? null,
        x: point.x,
        y: point.y,
        zIndex: Math.max(0, ...(editor.v3Value?.nodes.map(node => node.zIndex) ?? [0])) + 1,
        assetIds: result.assetIds,
      });
      editor.transactV3(document => {
        document.nodes.push(...created.nodes);
        document.componentInstances.push(created.instance);
      });
      setSelected(created.nodes.map(node => node.id));
      await editor.refreshAssets();
    });
  const publishSelectedElementChanges = () =>
    run(async () => {
      if (!id || !editor.v3Value) return;
      const instance = editor.v3Value.componentInstances.find(item =>
        Object.values(item.sourceToInstance).some(nodeId => selected.includes(nodeId))
      );
      if (!instance) throw new Error('Select a linked Elements instance first');
      const result = await studioApi.request<{ revisionId: string }>('elementSetPublish', {
        projectId: id,
        instanceId: instance.id,
      });
      editor.transactV3(document => {
        const current = document.componentInstances.find(item => item.id === instance.id);
        if (!current) return;
        current.revisionId = result.revisionId;
        current.localOverrides = {};
        current.localDeletions = [];
      });
      await refreshElementSets();
    });
  const ai = () =>
    run(async () => {
      if (!editor.value) return;
      setProposal(await generate(editor.value));
    });
  const acceptAI = () => {
    if (!proposal || !editor.value) return;
    const next = applyProposal(editor.value, proposal);
    editor.transact(d => Object.assign(d, next));
    setProposal(null);
  };
  return {
    workspaceId,
    identity,
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
    selectExact,
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
    themeId,
    setThemeId,
    themeMode,
    setThemeMode: changeThemeMode,
    theme: editor.v3Value?.theme,
    themePalette: editor.v3Value ? activePalette(editor.v3Value.theme) : null,
    elementSets,
    refreshElementSets,
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
    move,
    transform,
    add,
    addTable,
    upload,
    duplicatePage,
    insertFrame,
    insertFrameSet,
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
    applyTextStyle,
    saveSelectionToElements,
    insertElementSet,
    publishSelectedElementChanges,
    renameElementSet: (setId: string, name: string) =>
      run(async () => {
        await studioApi.request('elementSetRename', { setId, name });
        await refreshElementSets();
      }),
    archiveElementSet: (setId: string) =>
      run(async () => {
        await studioApi.request('elementSetArchive', { setId });
        await refreshElementSets();
      }),
    ai,
    acceptAI,
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
        const asset = await studioApi.upload(id, file, workspaceId);
        editor.patchElement(page.id, active.id, { assetId: asset.id, crop: null });
        await editor.refreshAssets();
        setPhotoEdit(undefined);
        return true;
      }),
    insertPage: () => insertFrame(),
  };
}
