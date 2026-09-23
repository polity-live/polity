import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
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
  open,
}: {
  groupId: string | null;
  projectId: string;
  conversationId?: string;
  open: (id: string) => void;
}) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');
  const [assets, setAssets] = useState<StudioAsset[]>([]);
  const [activeFrameId, setActiveFrameId] = useState('');
  const [cloneOpen, setCloneOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSnapshot(null);
    setError('');
    void (async () => {
      const { data } = await createClient().auth.getSession();
      const response = await fetch(`/api/studio/read/${encodeURIComponent(projectId)}`, {
        headers: data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {},
      });
      if (!response.ok) throw new Error(t('features.studio.projectUnavailable'));
      const next = (await response.json()) as Snapshot;
      if (next.project.groupId !== groupId)
        throw new Error(t('features.studio.projectUnavailable'));
      if (!cancelled) setSnapshot(next);
    })().catch(cause => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
    });
    return () => {
      cancelled = true;
    };
  }, [projectId, groupId, user?.id, t]);

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
          const url = URL.createObjectURL(await response.blob());
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
        open={open}
      />
    );
  if (!document)
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
              document={document}
              activeFrameId={frameId}
              assets={assets}
              selected={[]}
              editable={false}
              fit="contain"
            />
          </Suspense>
        </div>
      )}
      {user && cloneOpen && (
        <StudioCloneDialog sourceId={projectId} open={cloneOpen} onOpenChange={setCloneOpen} />
      )}
    </main>
  );
}
