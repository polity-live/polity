import { StudioEditor } from './StudioEditor';
import { useState, useEffect } from 'react';
import { CanvasGovernancePanel } from './CanvasGovernancePanel';
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
  open: (id: string) => void;
}
export function StudioWorkspace(props: WorkspaceProps) {
  const [workspaceId, setWorkspaceId] = useState<string>();
  useEffect(() => setWorkspaceId(undefined), [props.projectId]);
  return (
    <WorkspaceContent
      key={`${props.projectId}:${workspaceId ?? 'canonical'}`}
      {...props}
      workspaceId={workspaceId}
      chooseWorkspace={setWorkspaceId}
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
}: WorkspaceProps & { workspaceId?: string; chooseWorkspace: (id?: string) => void }) {
  const c = useStudioController(groupId, projectId, open, workspaceId);
  useProjectEditorBridge(projectId ? { kind: 'studio', projectId } : null, async () => {
    if (workspaceId)
      throw new Error(
        'Project chat tools target the canonical project. Return to canonical content before using these tools.'
      );
    await c.collaboration.commit();
    return { surface: 'studio', pageId: c.page?.id, elementIds: c.selected };
  });
  const { t } = useTranslation();
  const tr = (key: string) => t('features.studio.' + key);
  useStudioEditorTools(c);
  const failure = c.failure || c.error;
  if (projectId && c.canvasEnabled === false)
    return (
      <p role="alert" className="p-6">
        {tr('canvasPreviewRequired')}
      </p>
    );
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
  return groupId ? (
    <GroupStudioEditor
      c={c}
      projectId={projectId}
      groupId={groupId}
      conversationId={conversationId}
      open={open}
      workspaceId={workspaceId}
      chooseWorkspace={chooseWorkspace}
    />
  ) : (
    <StudioEditor
      c={c}
      projectId={projectId}
      groupId={groupId}
      conversationId={conversationId}
      open={open}
      governance={
        <CanvasGovernancePanel
          projectId={projectId}
          workspaceId={workspaceId}
          chooseWorkspace={chooseWorkspace}
          c={c}
        />
      }
    />
  );
}

function GroupStudioEditor({
  c,
  projectId,
  groupId,
  conversationId,
  open,
  workspaceId,
  chooseWorkspace,
}: {
  c: ReturnType<typeof useStudioController>;
  projectId: string;
  groupId: string;
  conversationId?: string;
  open: (id: string) => void;
  workspaceId?: string;
  chooseWorkspace: (id?: string) => void;
}) {
  const procedure = useStudioProcedure({ c, projectId, workspaceId, chooseWorkspace });
  return (
    <StudioEditor
      c={c}
      projectId={projectId}
      groupId={groupId}
      conversationId={conversationId}
      open={open}
      modeButton={procedure.modeButton}
      canvasOverlay={procedure.canvasOverlay}
      changeRequestMarkers={procedure.markers}
      previewDocument={procedure.previewDocument}
      previewAssets={procedure.previewAssets}
      editingAllowed={procedure.editingAllowed}
      onChangeRequestSelect={procedure.selectProposal}
    />
  );
}
