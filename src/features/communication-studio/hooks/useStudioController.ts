import { useZero } from '@rocicorp/zero/react';
import { mutators } from '@/zero/mutators';
import { serverConfirmed } from '@/zero/mutate-with-server-check';
import { useState, useEffect, useMemo, useRef } from 'react';
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
import { patchPage, patchElement } from '../logic/collaboration';
import { resizePage } from '../logic/layout';
import {
  createFrameNode,
  framePresetRegistry,
  type FramePresetId,
  type StudioDocumentV3,
} from '../logic/document-v3';
import { applyStudioCommandV3, type StudioCommandV3 } from '../logic/commands-v3';
import { createTableData, type TableDimensions } from '../logic/table-operations';
import { patchStudioNode } from '../logic/patch-studio-node';
import { createStudioNodeFromElement } from '../logic/create-studio-node';
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
import { worldToLocalPoint } from '../logic/selection-geometry';
import { getStudioRootFramesInLayerOrder } from '../logic/frame-order';

const presetByFormat: Record<StudioPage['format'], FramePresetId> = {
  feed: 'portrait',
  square: 'square',
  story: 'story',
  widescreen: 'widescreen',
  standard: 'standard',
};

interface StudioExportJob {
  id: string;
  format: string;
  status: string;
  progress: number;
  error?: string | null;
  fileName?: string | null;
}

function downloadStudioExport(id: string, fileName?: string | null) {
  const link = document.createElement('a');
  link.href = `/api/studio/exports/${encodeURIComponent(id)}`;
  link.download = fileName ?? '';
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

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
  const { projects, project, exports, isLoading } = useStudioState(groupId, id);
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
    [themes, setThemes] = useState<StudioThemeSnapshot[]>(() =>
      BUILTIN_THEMES.map(theme => createThemeSnapshot(theme))
    ),
    [themeId, setThemeId] = useState(BUILTIN_THEMES[0].id),
    [themeMode, setThemeMode] = useState<'light' | 'dark'>('light'),
    [elementSets, setElementSets] = useState<ElementSetListItem[]>([]),
    [guides, setGuides] = useState(true),
    [format, setFormat] = useState('png'),
    [exportFrameSelection, setExportFrameSelection] = useState<
      { kind: 'all' } | { kind: 'explicit'; ids: string[] }
    >({ kind: 'all' }),
    [photoEdit, setPhotoEdit] = useState<string | undefined>(),
    [exportPreparing, setExportPreparing] = useState(false),
    [exportFailure, setExportFailure] = useState(''),
    [exportStatusError, setExportStatusError] = useState(false),
    [trackedExports, setTrackedExports] = useState<Record<string, StudioExportJob>>({});
  const exportRequest = useRef(studioApi.request);
  exportRequest.current = studioApi.request;
  const autoDownloadIds = useRef(new Set<string>());
  const activeExportIds = Object.values(trackedExports)
    .filter(job => job.status === 'queued' || job.status === 'running')
    .map(job => job.id)
    .sort()
    .join(',');
  const exportJobs = useMemo<StudioExportJob[]>(() => {
    const tracked = Object.values(trackedExports).reverse();
    return [
      ...tracked,
      ...exports
        .filter(job => !trackedExports[job.id])
        .map(job => ({
          id: job.id,
          format: job.format,
          status: job.status,
          progress: job.progress,
          error: job.error,
          fileName: job.file_name,
        })),
    ];
  }, [exports, trackedExports]);
  useEffect(() => {
    if (!activeExportIds) return;
    const ids = activeExportIds.split(',');
    let disposed = false;
    let polling = false;
    const poll = async () => {
      if (polling) return;
      polling = true;
      try {
        const results = await Promise.allSettled(
          ids.map(id => exportRequest.current<StudioExportJob>('exportStatus', { id }))
        );
        if (disposed) return;
        const updates = results.flatMap(result =>
          result.status === 'fulfilled' ? [result.value] : []
        );
        if (updates.length)
          setTrackedExports(current => ({
            ...current,
            ...Object.fromEntries(updates.map(job => [job.id, job])),
          }));
        setExportStatusError(results.some(result => result.status === 'rejected'));
      } finally {
        polling = false;
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 1500);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [activeExportIds]);
  useEffect(() => {
    for (const job of Object.values(trackedExports)) {
      if (job.status === 'completed' && autoDownloadIds.current.delete(job.id))
        downloadStudioExport(job.id, job.fileName);
      if (job.status === 'failed' || job.status === 'cancelled')
        autoDownloadIds.current.delete(job.id);
    }
  }, [trackedExports]);
  const pages = editor.value?.pages ?? [],
    posts = editor.value?.posts ?? [];
  const exportFrames = editor.v3Value ? getStudioRootFramesInLayerOrder(editor.v3Value) : [];
  const exportFrameIds = exportFrames
    .filter(
      frame => exportFrameSelection.kind === 'all' || exportFrameSelection.ids.includes(frame.id)
    )
    .map(frame => frame.id);
  const toggleExportFrame = (frameId: string) => {
    setExportFrameSelection(current => {
      const allIds = exportFrames.map(frame => frame.id);
      const ids = current.kind === 'all' ? allIds : current.ids;
      return {
        kind: 'explicit',
        ids: ids.includes(frameId) ? ids.filter(id => id !== frameId) : [...ids, frameId],
      };
    });
  };
  const markSelectedExportFrame = () => {
    const frameId = selected[0];
    if (!exportFrames.some(frame => frame.id === frameId)) return;
    setExportFrameSelection(current => ({
      kind: 'explicit',
      ids: [
        ...new Set([
          ...(current.kind === 'all' ? exportFrames.map(frame => frame.id) : current.ids),
          frameId,
        ]),
      ],
    }));
  };
  useEffect(() => setExportFrameSelection({ kind: 'all' }), [id]);
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
    editor.transactV3(document => {
      const node = document.nodes.find(candidate => candidate.id === id);
      if (node) patchStudioNode(node, change);
    });
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
    editor.transactV3(document => {
      const zIndex =
        Math.max(
          -1,
          ...document.nodes.filter(node => node.parentFrameId === page.id).map(node => node.zIndex)
        ) + 1;
      document.nodes.push(createStudioNodeFromElement(e, page.id, zIndex));
    });
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
    editor.transactV3(document => {
      const zIndex =
        Math.max(
          -1,
          ...document.nodes.filter(node => node.parentFrameId === page.id).map(node => node.zIndex)
        ) + 1;
      document.nodes.push(createStudioNodeFromElement(e, page.id, zIndex));
    });
    setSelected([e.id]);
    return e.id;
  };
  const upload = (file: File) =>
    run(async () => {
      if (!id) return;
      if (!exportFrameIds.length) throw new Error('Select at least one frame to export.');
      const asset = await studioApi.upload(id, file, workspaceId);
      const e = element(asset.mime.startsWith('video') ? 'video' : 'image', {
        assetId: asset.id,
        x: 85,
        y: 600,
        width: 900,
        height: 650,
        order: page.elements.length + 1,
      });
      editor.transactV3(document => {
        const zIndex =
          Math.max(
            -1,
            ...document.nodes
              .filter(node => node.parentFrameId === page.id)
              .map(node => node.zIndex)
          ) + 1;
        document.nodes.push(createStudioNodeFromElement(e, page.id, zIndex));
      });
      await editor.refreshAssets();
      setSelected([e.id]);
    });
  const duplicatePage = () => {
    if (!page || pages.length >= 300 || (post && post.pageIds.length >= 30)) return;
    if (
      post?.kind === 'video' &&
      pages
        .filter(page => post.pageIds.includes(page.id))
        .reduce((n, candidate) => n + candidate.duration, page.duration) > 60
    )
      return;
    let copyId = '';
    editor.transactV3(document => {
      const existing = new Set(document.nodes.map(node => node.id));
      runV3Command(document, { type: 'duplicateNodes', nodeIds: [page.id] });
      const copy = document.nodes.find(
        node => !existing.has(node.id) && node.type === 'frame' && node.parentFrameId === null
      );
      if (!copy || copy.type !== 'frame') throw new Error('Frame copy was not created');
      copyId = copy.id;
      copy.name = page.name.slice(0, 152) + ' · Kopie';
      copy.zIndex =
        Math.max(
          -1,
          ...document.nodes
            .filter(
              node => node.type === 'frame' && node.parentFrameId === null && node.id !== copy.id
            )
            .map(node => node.zIndex)
        ) + 1;
      const deliverable = post
        ? document.deliverables.find(item => item.id === post.id)
        : undefined;
      if (deliverable) {
        const index = deliverable.frameIds.indexOf(page.id);
        deliverable.frameIds.splice(
          index < 0 ? deliverable.frameIds.length : index + 1,
          0,
          copy.id
        );
      }
    });
    if (copyId) setPageId(copyId);
  };
  const removePage = () => {
    if (!page || pages.length === 1) return;
    editor.transactV3(document =>
      runV3Command(document, { type: 'deleteNodes', nodeIds: [page.id] })
    );
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
  const insertFrameSet = (kind: 'single' | 'carousel' | 'story' | 'video' | 'presentation') => {
    if (!editor.value) return;
    const count = kind === 'single' ? 1 : kind === 'story' || kind === 'presentation' ? 3 : 5;
    if (editor.value.pages.length + count > 300) return;
    const format: StudioPage['format'] =
      kind === 'presentation'
        ? 'widescreen'
        : kind === 'story' || kind === 'video'
          ? 'story'
          : 'feed';
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
        const name = `${kind === 'carousel' ? 'Karussell' : kind === 'story' ? 'Story' : kind === 'video' ? 'Szene' : kind === 'presentation' ? 'Folie' : 'Post'} ${index + 1}`;
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
          channel: kind === 'presentation' ? 'custom' : 'instagram',
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
  const exportMedia = async () => {
    if (exportPreparing) return;
    setExportPreparing(true);
    setExportFailure('');
    setFailure('');
    setBusy(true);
    try {
      if (!id || !page) return;
      if (workspaceId)
        throw new Error(
          'Return to canonical content to export a committed project. Drafts can be downloaded from the canvas.'
        );
      const result = await studioApi.request<{ id: string }>('export', {
        projectId: id,
        format,
        pageIds: exportFrameIds,
        revision: await editor.commit(),
      });
      autoDownloadIds.current.add(result.id);
      setTrackedExports(current => ({
        ...current,
        [result.id]: { id: result.id, format, status: 'queued', progress: 0, error: null },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setExportFailure(message);
      setFailure(message);
      studioApi.notifyError(error);
    } finally {
      setExportPreparing(false);
      setBusy(false);
    }
  };
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
  const saveSelectionToElements = (selectedIds: string[] = selected) =>
    run(async () => {
      if (!id || !selectedIds.length) throw new Error('Select elements first');
      if (workspaceId) throw new Error('Return to canonical content to save Elements');
      await editor.commit();
      await studioApi.request('elementSetCreate', {
        projectId: id,
        groupId,
        selectedIds,
      });
      await refreshElementSets();
      return true;
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
      const document = editor.v3Value;
      if (!document) throw new Error('Studio not loaded');
      const targetFrameId =
        point.targetFrameId === undefined ? (page?.id ?? null) : point.targetFrameId;
      const localPoint = worldToLocalPoint(document, targetFrameId, point);
      const created = instantiateElementSet(elementSetSnapshotSchema.parse(result.snapshot), {
        setId: result.setId,
        revisionId: result.revisionId,
        targetFrameId,
        x: localPoint.x,
        y: localPoint.y,
        zIndex:
          Math.max(
            -1,
            ...document.nodes
              .filter(node => node.parentFrameId === targetFrameId)
              .map(node => node.zIndex)
          ) + 1,
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
      if (workspaceId) throw new Error('Return to canonical content to publish Elements');
      const instance = editor.v3Value.componentInstances.find(item =>
        Object.values(item.sourceToInstance).some(nodeId => selected.includes(nodeId))
      );
      if (!instance) throw new Error('Select a linked Elements instance first');
      await editor.commit();
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
  return {
    workspaceId,
    identity,
    ...editor,
    projects,
    project,
    exports: exportJobs,
    exportPreparing,
    exportFailure,
    exportStatusError,
    downloadExport: downloadStudioExport,
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
    exportFrames,
    exportFrameIds,
    toggleExportFrame,
    markAllExportFrames: () => setExportFrameSelection({ kind: 'all' }),
    markSelectedExportFrame,
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
