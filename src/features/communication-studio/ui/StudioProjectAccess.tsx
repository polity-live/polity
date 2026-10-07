import { useQuery } from '@rocicorp/zero/react';
import { queries } from '@/zero/queries';
import { studioAssetUrls, studioCapabilities } from '@/zero/communication-studio/projections';
import { lazy, Suspense, useEffect, useMemo, useState, useRef } from 'react';
import type { StudioCanvasHandle } from './KonvaStudioCanvas';
import { toast } from '@/features/shared/ui/ui/sonner';
import { ProjectChatPanel } from '@/features/project-chat/ui/ProjectChatPanel';
import { useAuth } from '@/providers/auth-provider';
import { createClient } from '@/lib/supabase/client';
import { studioDocumentV3Schema, type StudioDocumentV3 } from '../logic/document-v3';
import { getStudioRootFramesInLayerOrder } from '../logic/frame-order';
import type { StudioAsset } from '../hooks/useStudioDocument';
import { StudioWorkspace } from './StudioWorkspace';
import { StudioCloneDialog } from './StudioCloneDialog';
import type { CreateVisibility } from '@/features/create/logic/createVisibility';
import { useTranslation } from '@/features/shared/hooks/use-translation';

const KonvaStudioCanvas = lazy(() => import('./KonvaStudioCanvas'));

interface Snapshot {
  project: {
    id: string;
    title: string;
    groupId: string | null;
    ownerId: string;
    visibility: CreateVisibility;
    canEdit: boolean;
    canManageVisibility: boolean;
  };
  document: unknown;
  assets: StudioAsset[];
}

export function StudioProjectAccess({
  groupId,
  projectId,
  conversationId,
  workspaceId,
  focusNodeId,
  onFocusHandled,
  open,
}: {
  groupId: string | null;
  projectId: string;
  conversationId?: string;
  workspaceId?: string;
  focusNodeId?: string;
  onFocusHandled?: (workspaceId?: string) => void;
  open: (id: string) => void;
}) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [project, projectStatus] = useQuery(queries.studio.project({ id: projectId }));
  const [canonical, documentStatus] = useQuery(queries.studio.document({ id: projectId }));
  const [assetRows, assetStatus] = useQuery(queries.studio.assets({ projectId }));
  const [internal] = useQuery(user ? queries.studio.sessionProject({ projectId }) : undefined);
  const snapshot = useMemo<Snapshot | null>(() => {
    if (!project || !canonical || project.group_id !== groupId) return null;
    const canEdit = Boolean(internal && studioCapabilities(internal, user?.id ?? '', 'edit').edit);
    return {
      project: {
        id: project.id,
        title: project.title,
        groupId: project.group_id,
        ownerId: project.owner_id,
        visibility: project.visibility as CreateVisibility,
        canEdit,
        canManageVisibility:
          canEdit && (project.group_id !== null || project.owner_id === user?.id),
      },
      document: canonical.document,
      assets: studioAssetUrls(assetRows),
    };
  }, [project, canonical, internal, assetRows, groupId, user?.id]);
  const [error, setError] = useState('');
  const [assets, setAssets] = useState<StudioAsset[]>([]);
  const [activeFrameId, setActiveFrameId] = useState('');
  const [cloneOpen, setCloneOpen] = useState(false);
  const cloneTrigger = useRef<HTMLButtonElement | null>(null);
  const [readerCanvas, setReaderCanvas] = useState<StudioCanvasHandle | null>(null);
  const [readerSelection, setReaderSelection] = useState<string[]>([]);
  const [readerFocused, setReaderFocused] = useState(false);
  const readerAttempt = useRef<string | undefined>(undefined);
  const queryFailure = [projectStatus, documentStatus, assetStatus].find(
    state => state.type === 'error'
  );
  const queryError = queryFailure?.type === 'error' ? queryFailure.error.message : '';

  useEffect(() => {
    setError(
      queryError ||
        (projectStatus.type === 'complete' && documentStatus.type === 'complete' && !snapshot
          ? t('features.studio.projectUnavailable')
          : '')
    );
  }, [projectStatus.type, documentStatus.type, queryError, snapshot, t]);

  const document = useMemo<StudioDocumentV3 | null>(() => {
    if (!snapshot || snapshot.project.canEdit) return null;
    const parsed = studioDocumentV3Schema.safeParse(snapshot.document);
    return parsed.success ? parsed.data : null;
  }, [snapshot]);
  const frames = useMemo(
    () => (document ? getStudioRootFramesInLayerOrder(document) : []),
    [document]
  );
  const frameId = frames.some(frame => frame.id === activeFrameId)
    ? activeFrameId
    : (frames[0]?.id ?? '');

  useEffect(() => {
    if (!focusNodeId) {
      readerAttempt.current = undefined;
      return;
    }
    if (!snapshot || snapshot.project.canEdit || readerAttempt.current === focusNodeId) return;
    if (workspaceId) {
      readerAttempt.current = focusNodeId;
      toast.error(t('features.projectChat.context.focusUnavailable'));
      onFocusHandled?.(workspaceId);
      return;
    }
    if (!readerCanvas || !document) return;
    readerAttempt.current = focusNodeId;
    setReaderFocused(true);
    void readerCanvas
      .execute({ type: 'focus', nodeId: focusNodeId })
      .catch(() => toast.error(t('features.projectChat.context.focusUnavailable')))
      .finally(() => onFocusHandled?.());
  }, [snapshot, readerCanvas, document, focusNodeId, workspaceId, onFocusHandled, t]);

  useEffect(() => {
    if (!snapshot || snapshot.project.canEdit) return;
    let cancelled = false;
    const objectUrls: string[] = [];
    void (async () => {
      const { data } = await createClient().auth.getSession();
      const next = await Promise.all(
        snapshot.assets.map(async asset => {
          const response = await fetch(asset.url, {
            headers: data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {},
          });
          if (!response.ok) throw new Error(t('features.studio.mediaUnavailable'));
          const blob = await response.blob();
          if (cancelled) return asset;
          const url = URL.createObjectURL(blob);
          objectUrls.push(url);
          return { ...asset, url };
        })
      );
      if (!cancelled) setAssets(next);
    })().catch(cause => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
    });
    return () => {
      cancelled = true;
      objectUrls.forEach(URL.revokeObjectURL);
    };
  }, [snapshot, t]);

  if (error)
    return (
      <main role="alert" className="p-8">
        {error}
      </main>
    );
  if (!snapshot)
    return (
      <main role="status" className="p-8">
        {t('features.studio.loading')}
      </main>
    );
  if (snapshot.project.canEdit)
    return (
      <StudioWorkspace
        groupId={groupId}
        projectId={projectId}
        conversationId={conversationId}
        workspaceId={workspaceId}
        focusNodeId={focusNodeId}
        onFocusHandled={onFocusHandled}
        open={open}
      />
    );
  if (workspaceId || !document)
    return (
      <main role="alert" className="p-8">
        {t('features.studio.projectUnavailable')}
      </main>
    );

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-4 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{snapshot.project.title}</h1>
          <p className="text-muted-foreground text-sm">{t('features.studio.readOnly')}</p>
        </div>
        {user && (
          <button
            data-action-id="studio.reader.clone.open"
            ref={cloneTrigger}
            className="rounded-md border px-3 py-2 text-sm"
            onClick={() => setCloneOpen(true)}
          >
            {t('features.studio.cloneProject')}
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {frames.map((frame, index) => (
          <button
            data-action-id="studio.reader.frame.select"
            data-action-kind="selection"
            aria-pressed={frameId === frame.id}
            key={frame.id}
            className={`rounded-md border px-3 py-1 text-sm ${frameId === frame.id ? 'bg-primary text-primary-foreground' : ''}`}
            onClick={() => setActiveFrameId(frame.id)}
          >
            {index + 1}
          </button>
        ))}
      </div>
      {frameId && (
        <div className="h-[70dvh] overflow-hidden rounded-lg border bg-[var(--surface-sunken)]">
          <Suspense fallback={<p className="p-4">{t('features.studio.loading')}</p>}>
            <KonvaStudioCanvas
              ref={setReaderCanvas}
              document={document}
              activeFrameId={frameId}
              assets={assets}
              selected={readerSelection}
              selectExact={setReaderSelection}
              activateFrame={setActiveFrameId}
              editable={false}
              fit={focusNodeId || readerFocused ? undefined : 'contain'}
            />
          </Suspense>
        </div>
      )}
      {user && conversationId && (
        <ProjectChatPanel
          scope={{ kind: 'studio', projectId }}
          context={{ surface: 'studio', pageId: frameId, elementIds: readerSelection }}
          conversationId={conversationId}
          initiallyOpen={Boolean(focusNodeId)}
        />
      )}
      {user && cloneOpen && (
        <StudioCloneDialog
          sourceId={projectId}
          open={cloneOpen}
          onOpenChange={setCloneOpen}
          restoreFocusRef={cloneTrigger}
        />
      )}
    </main>
  );
}
