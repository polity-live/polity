import type { EditorPublication } from '@/features/project-chat/hooks/editor-bridge';
import { StudioEditor } from './StudioEditor';
import { useState, useEffect, useRef } from 'react';
import { toast } from '@/features/shared/ui/ui/sonner';
import { ProjectChatPanel } from '@/features/project-chat/ui/ProjectChatPanel';
import {
  useProjectEditorSnapshot,
  type ProjectEditorFocusTarget,
} from '@/features/project-chat/hooks/editor-bridge';
import type { StudioCanvasHandle } from './KonvaStudioCanvas';
import { useStudioProcedure } from './useStudioProcedure';
import { useProjectEditorBridge } from '@/features/project-chat/hooks/editor-bridge';
import { useStudioEditorTools } from '../hooks/useStudioEditorTools';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useStudioController } from '../hooks/useStudioController';
import { StudioProjectOverview } from './StudioProjectOverview';
interface WorkspaceProps {
  groupId?: string | null;
  projectId?: string;
  conversationId?: string;
  workspaceId?: string;
  focusNodeId?: string;
  onFocusHandled?: (workspaceId?: string) => void;
  open: (id: string) => void;
}
interface FocusRequest extends ProjectEditorFocusTarget {
  requestId: number;
}
export function StudioWorkspace(props: WorkspaceProps) {
  const [workspaceId, setWorkspaceId] = useState(props.workspaceId);
  const [focusRequest, setFocusRequest] = useState<FocusRequest>();
  const sequence = useRef(0);
  const completion = useRef<{ resolve: () => void; reject: (error: unknown) => void } | undefined>(
    undefined
  );
  const { t } = useTranslation();
  useEffect(() => setWorkspaceId(props.workspaceId), [props.projectId, props.workspaceId]);
  useEffect(() => {
    if (!props.focusNodeId) return;
    setFocusRequest({
      nodeId: props.focusNodeId,
      workspaceId: props.workspaceId ?? null,
      requestId: ++sequence.current,
    });
  }, [props.projectId, props.workspaceId, props.focusNodeId]);
  useEffect(
    () => () => {
      sequence.current++;
      completion.current?.resolve();
      completion.current = undefined;
    },
    []
  );
  const requestFocus = (target: ProjectEditorFocusTarget) =>
    new Promise<void>((resolve, reject) => {
      completion.current?.resolve();
      completion.current = { resolve, reject };
      setWorkspaceId(target.workspaceId ?? undefined);
      setFocusRequest({ ...target, requestId: ++sequence.current });
    });
  const finishFocus = (requestId: number, error?: unknown) => {
    if (requestId !== sequence.current) return;
    setFocusRequest(undefined);
    if (completion.current) {
      if (error) completion.current.reject(error);
      else completion.current.resolve();
      completion.current = undefined;
    } else if (error) toast.error(t('features.projectChat.context.focusUnavailable'));
    props.onFocusHandled?.(workspaceId);
  };
  return (
    <>
      <WorkspaceContent
        key={`${props.projectId}:${workspaceId ?? 'canonical'}`}
        {...props}
        workspaceId={workspaceId}
        chooseWorkspace={setWorkspaceId}
        focusRequest={focusRequest}
        requestFocus={requestFocus}
        finishFocus={finishFocus}
      />
      {props.projectId && (
        <StudioWorkspaceChat
          projectId={props.projectId}
          workspaceId={workspaceId}
          conversationId={props.conversationId}
          initiallyOpen={Boolean(props.focusNodeId)}
        />
      )}
    </>
  );
}
function StudioWorkspaceChat({
  projectId,
  workspaceId,
  conversationId,
  initiallyOpen,
}: {
  projectId: string;
  workspaceId?: string;
  conversationId?: string;
  initiallyOpen: boolean;
}) {
  const scope = { kind: 'studio' as const, projectId };
  const publication = useProjectEditorSnapshot(scope, 'studio');
  return (
    <ProjectChatPanel
      scope={scope}
      context={publication?.context ?? { surface: 'studio', proposalId: workspaceId ?? null }}
      conversationId={conversationId}
      initiallyOpen={initiallyOpen}
      initialInstruction={sessionStorage.getItem(`studio-brief:${projectId}`) ?? undefined}
    />
  );
}
function WorkspaceContent({
  groupId = null,
  projectId,
  conversationId,
  open,
  workspaceId,
  chooseWorkspace,
  focusRequest,
  requestFocus,
  finishFocus,
}: WorkspaceProps & {
  workspaceId?: string;
  chooseWorkspace: (id?: string) => void;
  focusRequest?: FocusRequest;
  requestFocus: (target: ProjectEditorFocusTarget) => Promise<void>;
  finishFocus: (requestId: number, error?: unknown) => void;
}) {
  const c = useStudioController(groupId, projectId, open, workspaceId);
  const { t } = useTranslation();
  const canvasHandle = useRef<StudioCanvasHandle | null>(null);
  const [canvasReady, setCanvasReady] = useState(false);
  const setCanvasHandle = useRef((handle: StudioCanvasHandle | null) => {
    canvasHandle.current = handle;
    setCanvasReady(Boolean(handle));
  }).current;
  const attempted = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (
      !focusRequest ||
      attempted.current === focusRequest.requestId ||
      focusRequest.workspaceId !== (workspaceId ?? null)
    )
      return;
    if (c.failure || (!c.value && c.error)) {
      attempted.current = focusRequest.requestId;
      finishFocus(focusRequest.requestId, new Error('Canvas unavailable'));
      return;
    }
    if (c.value && (!c.page || !c.v3Value)) {
      attempted.current = focusRequest.requestId;
      finishFocus(focusRequest.requestId, new Error('Canvas unavailable'));
      return;
    }
    if (!canvasReady || !canvasHandle.current || !c.v3Value) return;
    attempted.current = focusRequest.requestId;
    void canvasHandle.current
      .execute({ type: 'focus', nodeId: focusRequest.nodeId })
      .then(() => finishFocus(focusRequest.requestId))
      .catch(error => finishFocus(focusRequest.requestId, error));
  }, [focusRequest, canvasReady, c.v3Value, c.failure, c.error, c.value, workspaceId, finishFocus]);
  const publication: EditorPublication = {
    context: {
      surface: 'studio',
      proposalId: workspaceId ?? null,
      pageId: c.page?.id,
      elementIds: c.selected,
      references:
        c.v3Value && projectId
          ? [
              {
                kind: 'studio_project',
                id: projectId,
                label: c.v3Value.title,
                origin: 'automatic',
              },
              {
                kind: 'workspace',
                id: workspaceId ?? 'canonical',
                workspaceId: workspaceId ?? null,
                label: workspaceId ? c.v3Value.title : t('features.projectChat.context.canonical'),
                origin: 'automatic',
              },
              ...c.v3Value.nodes
                .filter(node => node.id === c.page?.id || c.selected.includes(node.id))
                .map(node => ({
                  kind: node.type === 'frame' ? ('frame' as const) : ('element' as const),
                  id: node.id,
                  label: node.name,
                  origin: 'automatic' as const,
                  workspaceId: workspaceId ?? null,
                  parentId: node.parentFrameId ?? undefined,
                })),
            ]
          : undefined,
    },
    options: c.v3Value?.nodes.map(node => ({
      kind: node.type === 'frame' ? ('frame' as const) : ('element' as const),
      id: node.id,
      label: node.name,
      origin: 'manual' as const,
      workspaceId: workspaceId ?? null,
      parentId: node.parentFrameId ?? undefined,
    })),
  };
  useProjectEditorBridge(
    projectId ? { kind: 'studio', projectId } : null,
    async () => {
      const frozen = structuredClone(publication.context);
      const revision = await c.collaboration.commit();
      return { ...frozen, contentRevision: revision };
    },
    publication,
    async target => {
      if (target.workspaceId !== (workspaceId ?? null)) await c.collaboration.commit();
      await requestFocus(target);
    }
  );
  const tr = (key: string) => t('features.studio.' + key);
  useStudioEditorTools(c);
  const failure = c.failure || c.error;
  const projectHref = (id: string) =>
    `${groupId ? `/group/${encodeURIComponent(groupId)}` : ''}/studio/${encodeURIComponent(id)}`;
  if (!projectId)
    return (
      <StudioProjectOverview
        groupId={groupId}
        ownerId={c.identity.id}
        projects={c.projects}
        isLoading={c.isLoading}
        failure={failure}
        projectHref={projectHref}
      />
    );
  if (!c.value)
    return (
      <main className="p-8" role={failure ? 'alert' : 'status'}>
        {failure || tr('loading')}
      </main>
    );
  return (
    <ProcedureStudioEditor
      c={c}
      projectId={projectId}
      groupId={groupId}
      conversationId={conversationId}
      open={open}
      workspaceId={workspaceId}
      chooseWorkspace={chooseWorkspace}
      onCanvasReady={setCanvasHandle}
      focusRequestId={focusRequest?.requestId}
    />
  );
}

function ProcedureStudioEditor({
  c,
  projectId,
  groupId,
  conversationId,
  open,
  workspaceId,
  chooseWorkspace,
  onCanvasReady,
  focusRequestId,
}: {
  c: ReturnType<typeof useStudioController>;
  projectId: string;
  groupId: string | null;
  conversationId?: string;
  open: (id: string) => void;
  workspaceId?: string;
  chooseWorkspace: (id?: string) => void;
  onCanvasReady: (handle: StudioCanvasHandle | null) => void;
  focusRequestId?: number;
}) {
  const procedure = useStudioProcedure({ c, projectId, workspaceId, chooseWorkspace });
  useEffect(() => {
    if (focusRequestId) procedure.selectProposal(null);
  }, [focusRequestId]);
  return (
    <StudioEditor
      onCanvasReady={onCanvasReady}
      c={c}
      projectId={projectId}
      groupId={groupId}
      conversationId={conversationId}
      open={open}
      governance={procedure.tools}
      readOnlyReason={procedure.readOnlyReason}
      modeButton={procedure.modeButton}
      canvasOverlay={procedure.canvasOverlay}
      changeRequestMarkers={procedure.markers}
      previewDocument={focusRequestId ? null : procedure.previewDocument}
      previewAssets={procedure.previewAssets}
      editingAllowed={procedure.editingAllowed}
      onChangeRequestSelect={procedure.selectProposal}
    />
  );
}
