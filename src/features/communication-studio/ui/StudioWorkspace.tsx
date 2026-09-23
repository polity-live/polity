import { StudioEditor } from './StudioEditor';
import { StudioInvitations } from './StudioInvitations';
import { useState, useEffect } from 'react';
import { CanvasGovernancePanel } from './CanvasGovernancePanel';
import { useStudioProcedure } from './useStudioProcedure';
import { useProjectEditorBridge } from '@/features/project-chat/hooks/editor-bridge';
import { useStudioEditorTools } from '../hooks/useStudioEditorTools';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useStudioController } from '../hooks/useStudioController';
import { templateNames } from '../logic/templates';
import { SmartLink } from '@/features/shared/ui/navigation/SmartLink';
const input = 'w-full rounded-md border bg-background px-2 py-1.5 text-sm';
const button = 'rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:opacity-40';
interface WorkspaceProps {
  groupId?: string | null;
  projectId?: string;
  conversationId?: string;
  open: (id: string) => void;
  whiteboards?: boolean;
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
  whiteboards = false,
  workspaceId,
  chooseWorkspace,
}: WorkspaceProps & { workspaceId?: string; chooseWorkspace: (id?: string) => void }) {
  const c = useStudioController(groupId, projectId, open, workspaceId);
  useEffect(() => {
    if (whiteboards && !projectId) {
      c.setKind('whiteboard');
      c.setTemplate('blank');
    }
  }, [whiteboards, projectId]);
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
  const field = (label: string, children: React.ReactNode) => (
    <label key={label} className="block space-y-1 text-xs">
      <span>{tr(label)}</span>
      {children}
    </label>
  );
  const failure = c.failure || c.error;
  if (projectId && c.canvasEnabled === false)
    return (
      <p role="alert" className="p-6">
        {tr('canvasPreviewRequired')}
      </p>
    );
  if (!projectId)
    return (
      <main className="mx-auto max-w-6xl space-y-8 p-4 md:p-8">
        <header>
          <a
            className="text-primary underline"
            href={
              groupId
                ? `/group/${groupId}/${whiteboards ? 'studio' : 'whiteboards'}`
                : whiteboards
                  ? '/studio'
                  : '/whiteboards'
            }
          >
            {whiteboards ? 'Studio' : 'Whiteboards'}
          </a>
          <p className="text-muted-foreground text-sm">{tr(groupId ? 'group' : 'personal')}</p>
          <h1 className="font-display text-4xl">{tr('title')}</h1>
          <p className="text-muted-foreground mt-2">{tr('subtitle')}</p>
        </header>
        {failure && (
          <p role="alert" className="text-destructive">
            {failure}
          </p>
        )}
        {whiteboards ? (
          <section className="bg-card grid gap-6 rounded-xl border p-5 md:grid-cols-2">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">{tr('newProject')}</h2>
              <div className="flex gap-2">
                {(['template', 'ai'] as const).map(mode => (
                  <button
                    data-action-id="communication-studio.studio-workspace.set-mode"
                    key={mode}
                    className={button}
                    aria-pressed={c.mode === mode}
                    onClick={() => c.setMode(mode)}
                  >
                    {tr(mode)}
                  </button>
                ))}
              </div>
              {field(
                'name',
                <input
                  data-action-id="communication-studio.studioworkspace.activate.input-a4db323638"
                  className={input}
                  maxLength={200}
                  value={c.title}
                  onChange={e => c.setTitle(e.target.value)}
                />
              )}
              <div className="grid grid-cols-2 gap-3">
                {field(
                  'templateName',
                  <select
                    data-action-id="communication-studio.studioworkspace.activate.select-c7ba71357a"
                    className={input}
                    value={c.kind}
                    onChange={e => c.setKind(e.target.value as typeof c.kind)}
                  >
                    {(whiteboards
                      ? ['whiteboard']
                      : ['single', 'event', 'carousel', 'story', 'video', 'campaign', 'whiteboard']
                    ).map(k => (
                      <option key={k} value={k}>
                        {tr(k)}
                      </option>
                    ))}
                  </select>
                )}
                {field(
                  'template',
                  <select
                    data-action-id="communication-studio.studioworkspace.activate.select-207aa77ea6"
                    className={input}
                    value={c.template}
                    onChange={e => c.setTemplate(e.target.value)}
                  >
                    {templateNames.map(k => (
                      <option key={k} value={k}>
                        {tr(k)}
                      </option>
                    ))}
                    {c.projects
                      .filter(project => project.is_template)
                      .map(project => (
                        <option key={project.id} value={`project:${project.id}`}>
                          {project.title}
                        </option>
                      ))}
                  </select>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {field(
                  'theme',
                  <select
                    data-action-id="communication-studio.studio-workspace.select-theme"
                    className={input}
                    value={c.themeId}
                    onChange={event => c.setThemeId(event.currentTarget.value)}
                  >
                    {c.themes.map(theme => (
                      <option
                        key={`${theme.themeId}:${theme.revisionId ?? 'builtin'}`}
                        value={theme.themeId}
                      >
                        {theme.name}
                      </option>
                    ))}
                  </select>
                )}
                {field(
                  'themeMode',
                  <select
                    data-action-id="communication-studio.studio-workspace.select-theme-mode"
                    className={input}
                    value={c.themeMode}
                    onChange={event =>
                      c.setThemeMode(event.currentTarget.value as 'light' | 'dark')
                    }
                  >
                    <option value="light">{tr('light')}</option>
                    <option value="dark">{tr('dark')}</option>
                  </select>
                )}
              </div>
            </div>
            <div className="space-y-4">
              {c.kind === 'campaign' && (
                <div className="grid grid-cols-3 gap-2">
                  {field(
                    'weeks',
                    <input
                      data-action-id="communication-studio.studioworkspace.activate.input-5aecf17a56"
                      className={input}
                      type="number"
                      min={1}
                      max={12}
                      value={c.weeks}
                      onChange={e => c.setWeeks(Math.max(1, Math.min(12, +e.target.value)))}
                    />
                  )}
                  {field(
                    'core',
                    <input
                      data-action-id="communication-studio.studioworkspace.activate.input-4bccd4d2f8"
                      className={input}
                      type="number"
                      min={1}
                      max={3}
                      value={c.core}
                      onChange={e => c.setCore(Math.max(1, Math.min(3, +e.target.value)))}
                    />
                  )}
                  {field(
                    'stories',
                    <input
                      data-action-id="communication-studio.studioworkspace.activate.input-04f17341d4"
                      className={input}
                      type="number"
                      min={0}
                      max={3}
                      value={c.stories}
                      onChange={e => c.setStories(Math.max(0, Math.min(3, +e.target.value)))}
                    />
                  )}
                </div>
              )}
              {c.mode === 'ai' &&
                field(
                  'brief',
                  <textarea
                    data-action-id="communication-studio.studioworkspace.activate.textarea-52e4af57e4"
                    className={input}
                    rows={5}
                    value={c.brief}
                    onChange={e => c.setBrief(e.target.value)}
                  />
                )}
              <button
                data-action-id="communication-studio.studio-workspace.create"
                className={button + ' bg-primary text-primary-foreground'}
                disabled={c.busy || !c.title.trim() || (c.mode === 'ai' && !c.brief.trim())}
                onClick={c.create}
              >
                {tr(c.busy ? 'busy' : 'create')}
              </button>
            </div>
          </section>
        ) : (
          <SmartLink
            href={
              groupId
                ? `/create/studio-project?groupId=${encodeURIComponent(groupId)}`
                : '/create/studio-project'
            }
            data-action-id="communication-studio.studio-workspace.create"
            className="bg-primary text-primary-foreground inline-flex rounded-md px-4 py-2 text-sm font-medium"
          >
            {tr('create')}
          </SmartLink>
        )}
        {!groupId && !whiteboards && <StudioInvitations />}
        <section>
          <h2 className="mb-4 text-xl font-semibold">{tr('projects')}</h2>
          {!c.projects.length && <p>{tr(c.isLoading ? 'loading' : 'empty')}</p>}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {c.projects
              .filter(p => !whiteboards || p.kind === 'whiteboard')
              .filter(p => groupId || whiteboards || p.owner_id === c.identity.id)
              .map(p => (
                <button
                  data-action-id="communication-studio.studio-workspace.open"
                  key={p.id}
                  className="bg-card hover:border-primary rounded-xl border p-5 text-left"
                  onClick={() => open(p.id)}
                >
                  <div className="mb-4 flex h-28 items-center justify-center rounded bg-[#12362D] font-serif text-xl text-[#FFFCF6]">
                    {p.title}
                  </div>
                  <span className="font-semibold">{p.title}</span>
                  <p className="text-muted-foreground text-sm">
                    {tr(p.kind)}
                    {p.is_template ? ' · ' + tr('templateSaved') : ''}
                  </p>
                </button>
              ))}
          </div>
        </section>
        {!groupId && !whiteboards && c.projects.some(p => p.owner_id !== c.identity.id) && (
          <section>
            <h2 className="mb-4 text-xl font-semibold">{tr('sharedWithMe')}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {c.projects
                .filter(p => p.owner_id !== c.identity.id && p.kind !== 'whiteboard')
                .map(p => (
                  <button
                    key={p.id}
                    className="bg-card hover:border-primary rounded-xl border p-5 text-left"
                    onClick={() => open(p.id)}
                  >
                    {p.title}
                  </button>
                ))}
            </div>
          </section>
        )}
      </main>
    );
  if (!c.value)
    return (
      <main className="p-8" role={failure ? 'alert' : 'status'}>
        {failure || tr('loading')}
      </main>
    );
  return groupId && c.value.kind !== 'whiteboard' ? (
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
