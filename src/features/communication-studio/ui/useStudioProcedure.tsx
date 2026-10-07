import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { createClient } from '@/lib/supabase/client';
import { EditingModeToolbarButton } from '@/features/shared/ui/status/EditingModeToolbarButton';
import { CanvasChangeRequestList } from '@/features/shared/ui/change-requests/CanvasChangeRequestList';
import { CanvasVoteButtons } from '@/features/shared/ui/change-requests/CanvasVoteButtons';
import {
  CanvasChangeRequestCard,
  CanvasChangeRequestCloseButton,
} from '@/features/shared/ui/change-requests/CanvasChangeRequestCard';
import { Button } from '@/features/shared/ui/ui/button';
import type { CanvasProposal, CanvasSession } from '../logic/governance';
import type { StudioDocumentV3 } from '../logic/document-v3';
import { diffStudio } from '../logic/operations';
import { buildProposalAnnotations } from '../logic/change-request-annotations';
import type { useStudioController } from '../hooks/useStudioController';
import type { StudioAsset } from '../hooks/useStudioDocument';
import { StudioPlateDiff, studioText } from './StudioPlateDiff';
import { StudioProcedureComments, StudioProcedureTools } from './StudioProcedureTools';

type Controller = ReturnType<typeof useStudioController>;
const modes = ['edit', 'suggest_internal', 'vote_internal'] as const;
type ComparisonView = 'original' | 'difference' | 'proposal';

export function proposalNodeIds(proposal: CanvasProposal): string[] {
  return [
    ...new Set(
      (proposal.changes ?? [])
        .filter(change => change.path[0] === 'nodes' && change.path[1]?.startsWith('#'))
        .map(change => change.path[1].slice(1))
    ),
  ];
}

export function useStudioProcedure({
  projectId,
  workspaceId,
  chooseWorkspace,
  c,
}: {
  projectId: string;
  workspaceId?: string;
  chooseWorkspace: (id?: string) => void;
  c: Controller;
}) {
  const { user } = useAuth();
  const [session, setSession] = useState<CanvasSession | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(workspaceId ?? null);
  const [preview, setPreview] = useState<StudioDocumentV3 | null>(null);
  const [previewBase, setPreviewBase] = useState<StudioDocumentV3 | null>(null);
  const [draftBase, setDraftBase] = useState<StudioDocumentV3 | null>(null);
  const [previewAssets, setPreviewAssets] = useState<StudioAsset[]>([]);
  const [ghostAssets, setGhostAssets] = useState<StudioAsset[]>([]);
  const [comparisonView, setComparisonView] = useState<ComparisonView>('difference');
  const [title, setTitle] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const de = typeof document === 'undefined' || document.documentElement.lang !== 'en';
  const tr = (german: string, english: string) => (de ? german : english);
  const request = c.actions.request;
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('proposalId');
    if (id) setSelectedId(id);
  }, [projectId]);
  const refresh = async () => {
    const next = await request<CanvasSession>('canvas', { projectId, action: 'session' });
    if (next && !Array.isArray(next) && Array.isArray(next.proposals)) setSession(next);
  };

  useEffect(() => {
    let live = true;
    const load = () =>
      request<CanvasSession>('canvas', { projectId, action: 'session' })
        .then(next => {
          if (live && next && !Array.isArray(next) && Array.isArray(next.proposals))
            setSession(next);
        })
        .catch(cause => {
          if (live) setError(String(cause));
        });
    void load();
    const timer = setInterval(() => void load(), 4000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [projectId]);

  useEffect(() => {
    setDraftBase(null);
    if (!workspaceId) return;
    let live = true;
    void request<{ baseDocument?: StudioDocumentV3 }>('canvas', {
      projectId,
      action: 'loadDraft',
      workspaceId,
    })
      .then(result => {
        if (live && result.baseDocument) setDraftBase(result.baseDocument);
      })
      .catch(cause => {
        if (live) setError(String(cause));
      });
    return () => {
      live = false;
    };
  }, [projectId, workspaceId]);

  useEffect(() => {
    setComparisonView('difference');
    setPreview(null);
    setPreviewBase(null);
    setPreviewAssets([]);
    if (!selectedId || selectedId === workspaceId) {
      setPreview(null);
      return;
    }
    let live = true;
    const objectUrls: string[] = [];
    void Promise.all([
      request<{ document: StudioDocumentV3; baseDocument?: StudioDocumentV3 }>('canvas', {
        projectId,
        action: 'loadDraft',
        workspaceId: selectedId,
      }),
      request<StudioAsset[]>('assets', { id: projectId, workspaceId: selectedId }),
    ])
      .then(async ([result, assets]) => {
        const missing = assets.filter(asset => !c.assets.some(current => current.id === asset.id));
        const { data } = missing.length
          ? await createClient().auth.getSession()
          : { data: { session: null } };
        if (missing.length && !data.session?.access_token) throw new Error('Please sign in');
        const hydrated = await Promise.all(
          missing.map(async asset => {
            const response = await fetch(asset.url, {
              headers: { Authorization: `Bearer ${data.session?.access_token}` },
            });
            if (!response.ok) throw new Error('Cannot load media');
            const blob = await response.blob();
            if (!live) return asset;
            const url = URL.createObjectURL(blob);
            objectUrls.push(url);
            return { ...asset, url };
          })
        );
        if (live) {
          setPreview(result.document);
          setPreviewBase(result.baseDocument ?? null);
          setPreviewAssets(hydrated);
        }
      })
      .catch(cause => {
        if (live) setError(String(cause));
      });
    return () => {
      live = false;
      objectUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [projectId, selectedId, workspaceId]);

  const run = async (action: string, extra: Record<string, unknown> = {}) => {
    if (!session || busy) return false;
    setBusy(true);
    setError('');
    try {
      let revision: number | undefined;
      if (['createDraft', 'submit', 'phase', 'restore', 'share', 'adopt'].includes(action))
        revision = await c.commit();
      if (['acceptPrivate', 'rejectPrivate'].includes(action))
        revision = session.proposals.find(item => item.id === extra.workspaceId)?.revision;
      if (['phase', 'resolveDraft', 'restore'].includes(action))
        revision = (await request<{ revision: number }>('load', { id: projectId })).revision;
      const result = await request<{ workspaceId?: string }>('canvas', {
        projectId,
        action,
        generation: session.generation,
        operationId: crypto.randomUUID(),
        revision,
        ...extra,
      });
      await refresh();
      if ((action === 'createDraft' || action === 'resolveDraft') && result.workspaceId)
        chooseWorkspace(result.workspaceId);
      if (action === 'submit') {
        chooseWorkspace();
        setSelectedId(extra.workspaceId as string);
      }
      if (action === 'withdraw') setSelectedId(null);
      if (action === 'restore') chooseWorkspace();
      if (action === 'adopt') location.assign(`/group/${extra.groupId}/studio/${projectId}`);
      return true;
    } catch (cause) {
      setError(String(cause));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const proposal = session?.proposals.find(item => item.id === (selectedId ?? workspaceId)) ?? null;
  const visible = session?.proposals.filter(item => item.state !== 'withdrawn') ?? [];
  const mediaProposalIds = visible
    .filter(item =>
      item.changes?.some(
        change =>
          change.path[0] === 'nodes' &&
          change.path.length === 2 &&
          change.before.exists === false &&
          change.after.value &&
          typeof change.after.value === 'object' &&
          ['media', 'chart'].includes((change.after.value as { type?: string }).type ?? '')
      )
    )
    .map(item => item.id)
    .join('|');
  useEffect(() => {
    setGhostAssets([]);
    const ids = mediaProposalIds.split('|').filter(Boolean);
    if (!ids.length) return;
    let live = true;
    const objectUrls: string[] = [];
    void Promise.all(
      ids.map(id => request<StudioAsset[]>('assets', { id: projectId, workspaceId: id }))
    )
      .then(async groups => {
        const canonicalIds = new Set(c.assets.map(asset => asset.id));
        const missing = [...new Map(groups.flat().map(asset => [asset.id, asset])).values()].filter(
          asset => !canonicalIds.has(asset.id)
        );
        if (!missing.length) return [];
        const { data } = await createClient().auth.getSession();
        if (!data.session?.access_token) throw new Error('Please sign in');
        return Promise.all(
          missing.map(async asset => {
            const response = await fetch(asset.url, {
              headers: { Authorization: `Bearer ${data.session?.access_token}` },
            });
            if (!response.ok) throw new Error('Cannot load media');
            const blob = await response.blob();
            if (!live) return asset;
            const url = URL.createObjectURL(blob);
            objectUrls.push(url);
            return { ...asset, url };
          })
        );
      })
      .then(assets => {
        if (live) setGhostAssets(assets);
      })
      .catch(cause => {
        if (live) setError(String(cause));
      });
    return () => {
      live = false;
      objectUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [projectId, mediaProposalIds]);
  const markers = useMemo(() => {
    if (comparisonView !== 'difference') return [];
    const displayedDocument = (selectedId && !workspaceId ? preview : null) ?? c.v3Value;
    const canonicalDocument = workspaceId ? draftBase : c.v3Value;
    if (!displayedDocument || !canonicalDocument) return [];
    return visible
      .flatMap(item => {
        const changes =
          item.id === workspaceId && item.state === 'draft' && draftBase && c.v3Value
            ? diffStudio(draftBase, c.v3Value)
            : (item.changes ?? []);
        return buildProposalAnnotations({
          proposal: item,
          changes,
          canonicalDocument,
          displayedDocument,
          selected: item.id === (selectedId ?? workspaceId),
        });
      })
      .sort((left, right) => Number(left.selected) - Number(right.selected));
  }, [visible, selectedId, workspaceId, draftBase, c.v3Value, preview, comparisonView]);
  const currentVote = proposal?.votes.find(vote => vote.user_id === user?.id)?.choice;
  const textChanges =
    proposal && preview
      ? proposalNodeIds(proposal).flatMap(nodeId => {
          const original = c.v3Value?.nodes.find(node => node.id === nodeId);
          const proposed = preview.nodes.find(node => node.id === nodeId);
          if (original?.type !== 'richText' || proposed?.type !== 'richText') return [];
          const before = studioText(original),
            after = studioText(proposed);
          return before === after ? [] : [{ id: nodeId, name: proposed.name, before, after }];
        })
      : [];
  const canVote =
    session?.phase === 'vote_internal' &&
    proposal?.state === 'voting' &&
    session.capabilities.vote &&
    proposal.electorate?.includes(user?.id ?? '');
  const canEditProposal = (item: CanvasProposal) =>
    !!session?.capabilities.suggest &&
    item.state === 'draft' &&
    (item.owner_id === user?.id || item.shared_ids.includes(user?.id ?? '')) &&
    (['edit', 'suggest_internal'].includes(session.phase) ||
      (session.phase === 'vote_internal' && !!item.resolves_id));
  const draft = session?.proposals.find(item => item.id === workspaceId);
  const draftEditable = c.canEdit && (!session || (!!draft && canEditProposal(draft)));

  const modeButton = session && (
    <EditingModeToolbarButton
      data-action-id="communication-studio.procedure.open-mode"
      availableModes={modes}
      canChangeMode={session.capabilities.manage && !busy}
      disabledModeReasons={{}}
      showLabel
      mode={
        modes.includes(session.phase as (typeof modes)[number])
          ? (session.phase as (typeof modes)[number])
          : 'suggest_internal'
      }
      onModeChange={next => void run('phase', { phase: next })}
    />
  );

  const canvasOverlay = (
    <>
      {session && (
        <>
          <CanvasChangeRequestList
            collapsible
            items={visible}
            selectedId={selectedId ?? workspaceId ?? null}
            onSelect={setSelectedId}
            title={tr('Änderungsanträge', 'Change requests')}
            emptyLabel={tr('Noch keine Änderungsanträge', 'No change requests yet')}
            renderItem={(item, selected, select) => (
              <button
                data-action-id="studio.proposal.select"
                data-action-kind="selection"
                type="button"
                onClick={select}
                aria-pressed={selected}
                className="hover:bg-muted w-full rounded border p-2 text-left text-sm"
              >
                <strong className="block truncate">{item.title}</strong>
                <span className="text-muted-foreground">
                  {item.state} · {item.decision ?? item.application}
                </span>
              </button>
            )}
          />
          {session.phase === 'suggest_internal' && !workspaceId && session.capabilities.suggest && (
            <form
              data-action-id="studio.proposal.create.submit"
              className="bg-background/95 pointer-events-auto absolute bottom-4 left-4 z-20 flex max-w-[calc(100%-2rem)] flex-wrap gap-2 rounded border p-2 shadow-lg"
              onSubmit={event => {
                event.preventDefault();
                if (title.trim()) void run('createDraft', { title: title.trim(), reason });
              }}
            >
              <input
                data-action-id="studio.proposal.create.title"
                data-action-kind="interaction"
                aria-label={tr('Antragstitel', 'Proposal title')}
                className="rounded border px-2"
                value={title}
                onChange={event => setTitle(event.target.value)}
                placeholder={tr('Antragstitel', 'Proposal title')}
              />
              <input
                data-action-id="studio.proposal.create.reason"
                data-action-kind="interaction"
                aria-label={tr('Begründung', 'Reason')}
                className="rounded border px-2"
                value={reason}
                onChange={event => setReason(event.target.value)}
                placeholder={tr('Begründung', 'Reason')}
              />
              <Button
                data-action-id="studio.proposal.create.start"
                type="submit"
                disabled={busy || !title.trim()}
              >
                {tr('Vorschlag beginnen', 'Start proposal')}
              </Button>
            </form>
          )}
          {proposal && (
            <CanvasChangeRequestCard
              className="bg-background/95 pointer-events-auto absolute right-4 bottom-4 z-30 max-h-[min(32rem,65%)] w-[min(23rem,calc(100%-2rem))] space-y-2 overflow-auto rounded-md border p-3 text-sm shadow-xl backdrop-blur"
              label={tr('Änderungsantrag', 'Change request')}
            >
              <div className="flex justify-between gap-2">
                <strong>
                  {proposal.origin === 'ai' ? 'AI Suggestion · ' : ''}
                  {proposal.title}
                </strong>
                <CanvasChangeRequestCloseButton
                  data-action-id="communication-studio.procedure.close-details"
                  actionId="communication-studio.procedure.close-details"
                  onClose={() => setSelectedId(null)}
                  label={tr('Schließen', 'Close')}
                />
              </div>
              <p>{proposal.reason}</p>
              {proposal.origin === 'ai' && (
                <p className="text-muted-foreground text-xs">
                  {proposal.ai_mode === 'free'
                    ? tr('Frei gestaltet', 'Free design')
                    : tr('Vorlage', 'Template')}
                  {proposal.ai_sources?.length
                    ? ` · ${proposal.ai_sources.length} ${tr('Quellen', 'sources')}`
                    : ''}
                  {proposal.ai_warnings?.length ? ` · ${proposal.ai_warnings.join(', ')}` : ''}
                </p>
              )}
              <p className="text-muted-foreground">
                {proposal.state}
                {proposal.decision && ` · ${proposal.decision}`}
                {proposal.application === 'conflict' &&
                  ` · ${tr('Anwendungskonflikt', 'Application conflict')}`}
              </p>
              {workspaceId === proposal.id &&
                proposal.state === 'draft' &&
                (session.phase === 'suggest_internal' ||
                  (session.phase === 'vote_internal' && !!proposal.resolves_id) ||
                  (!session.groupId && session.phase === 'edit')) &&
                proposal.owner_id === user?.id && (
                  <Button
                    data-action-id="studio.proposal.submit"
                    disabled={busy || !draftEditable}
                    onClick={() => void run('submit', { workspaceId: proposal.id })}
                  >
                    {tr('Einreichen', 'Submit')}
                  </Button>
                )}
              {!workspaceId &&
                !session.groupId &&
                session.phase === 'edit' &&
                proposal.origin === 'ai' &&
                proposal.state === 'draft' &&
                session.capabilities.manage && (
                  <div className="flex gap-2">
                    <Button
                      data-action-id="studio.proposal.ai.accept"
                      disabled={busy}
                      onClick={() => void run('acceptPrivate', { workspaceId: proposal.id })}
                    >
                      {tr('Annehmen', 'Accept')}
                    </Button>
                    <Button
                      data-action-id="studio.proposal.ai.reject"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void run('rejectPrivate', { workspaceId: proposal.id })}
                    >
                      {tr('Ablehnen', 'Reject')}
                    </Button>
                  </div>
                )}
              {!workspaceId && canEditProposal(proposal) && (
                <Button
                  data-action-id="studio.proposal.edit"
                  variant="outline"
                  onClick={() => chooseWorkspace(proposal.id)}
                >
                  {tr('Entwurf bearbeiten', 'Edit draft')}
                </Button>
              )}
              {proposal.owner_id === user?.id &&
                (proposal.state === 'draft' || proposal.state === 'submitted') && (
                  <Button
                    data-action-id="studio.proposal.withdraw"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void run('withdraw', { workspaceId: proposal.id })}
                  >
                    {tr('Zurückziehen', 'Withdraw')}
                  </Button>
                )}
              {workspaceId && (
                <Button
                  data-action-id="studio.proposal.return"
                  variant="outline"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError('');
                    try {
                      await c.commit();
                      chooseWorkspace();
                    } catch (cause) {
                      setError(String(cause));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {tr('Zum Projekt', 'Back to project')}
                </Button>
              )}
              {preview || (workspaceId === proposal.id && draftBase) ? (
                <div
                  role="group"
                  aria-label={tr('Ansicht', 'View')}
                  className="flex flex-wrap gap-2"
                >
                  <Button
                    data-action-id="studio.proposal.compare.original"
                    data-action-kind="selection"
                    variant={comparisonView === 'original' ? 'default' : 'outline'}
                    aria-pressed={comparisonView === 'original'}
                    onClick={() => setComparisonView('original')}
                  >
                    {tr('Original', 'Original')}
                  </Button>
                  <Button
                    data-action-id="studio.proposal.compare.difference"
                    data-action-kind="selection"
                    variant={comparisonView === 'difference' ? 'default' : 'outline'}
                    aria-pressed={comparisonView === 'difference'}
                    onClick={() => setComparisonView('difference')}
                  >
                    {tr('Differenz', 'Difference')}
                  </Button>
                  <Button
                    data-action-id="studio.proposal.compare.proposal"
                    data-action-kind="selection"
                    variant={comparisonView === 'proposal' ? 'default' : 'outline'}
                    aria-pressed={comparisonView === 'proposal'}
                    onClick={() => setComparisonView('proposal')}
                  >
                    {tr('Vorschlag', 'Proposal')}
                  </Button>
                </div>
              ) : null}
              {proposal.changes?.length ? (
                <details>
                  <summary>
                    {tr('Änderungen', 'Changes')} ({proposal.changes.length})
                  </summary>
                  <div className="max-h-32 space-y-1 overflow-auto text-xs">
                    {proposal.changes.map((change, index) => (
                      <div key={index} className="rounded border p-1">
                        <span className="font-mono">{change.path.join(' / ')}</span>
                        <div className="grid grid-cols-2 gap-1">
                          <del className="bg-red-50 break-all text-black">
                            {JSON.stringify(change.before.value)?.slice(0, 250)}
                          </del>
                          <ins className="bg-green-50 break-all text-black">
                            {JSON.stringify(change.after.value)?.slice(0, 250)}
                          </ins>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              ) : null}
              {textChanges.map(change => (
                <div key={change.id} className="space-y-1">
                  <strong>{change.name}</strong>
                  <StudioPlateDiff before={change.before} after={change.after} />
                </div>
              ))}
              {proposal.electorate && (
                <p className="rounded border p-2 text-xs">
                  {proposal.votes.length}/{proposal.electorate.length}{' '}
                  {tr('Stimmberechtigte haben abgestimmt', 'eligible voters have voted')}
                  {' · '}
                  {proposal.votes.filter(vote => vote.choice === 'accept').length} {tr('Ja', 'Yes')}
                  {' · '}
                  {proposal.votes.filter(vote => vote.choice === 'reject').length}{' '}
                  {tr('Nein', 'No')}
                  {' · '}
                  {proposal.votes.filter(vote => vote.choice === 'abstain').length}{' '}
                  {tr('Enthaltung', 'Abstain')}
                </p>
              )}
              {canVote && (
                <CanvasVoteButtons
                  actionIdPrefix="communication-studio.procedure.vote"
                  selected={currentVote}
                  disabled={busy}
                  labels={{
                    accept: tr('Ja', 'Yes'),
                    reject: tr('Nein', 'No'),
                    abstain: tr('Enthaltung', 'Abstain'),
                  }}
                  onVote={async choice => {
                    await run('vote', { workspaceId: proposal.id, choice });
                  }}
                />
              )}
              {proposal.state === 'voting' && session.capabilities.manage && (
                <Button
                  data-action-id="studio.proposal.vote.finalize"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void run('finalize', { workspaceId: proposal.id })}
                >
                  {tr('Abschließen', 'Finalize')}
                </Button>
              )}
              {proposal.application === 'conflict' && session.capabilities.suggest && (
                <Button
                  data-action-id="studio.proposal.resolve"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void run('resolveDraft', {
                      workspaceId: proposal.id,
                      title: `${tr('Klärung', 'Resolution')}: ${proposal.title}`,
                    })
                  }
                >
                  {tr('Klärungsvorschlag', 'Resolution proposal')}
                </Button>
              )}
              {proposal.application === 'conflict' && session.capabilities.manage && (
                <Button
                  data-action-id="studio.proposal.reapply"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void run('reapply', { workspaceId: proposal.id })}
                >
                  {tr('Beschluss erneut anwenden', 'Retry decision')}
                </Button>
              )}
              {workspaceId === proposal.id &&
                proposal.state === 'draft' &&
                proposal.owner_id === user?.id && (
                  <fieldset
                    disabled={busy || !canEditProposal(proposal)}
                    className="rounded border p-2"
                  >
                    <legend>{tr('Privaten Entwurf teilen', 'Share private draft')}</legend>
                    <p>
                      {tr(
                        'Nur ausgewählte Personen können diesen Entwurf und seine Diskussion sehen.',
                        'Only selected people can access this draft and its discussion.'
                      )}
                    </p>
                    {session.members
                      .filter(member => member.id !== user?.id)
                      .map(member => (
                        <label key={member.id} className="flex items-center gap-2 py-1">
                          <input
                            data-action-id="studio.proposal.share"
                            type="checkbox"
                            checked={proposal.shared_ids.includes(member.id)}
                            onChange={event =>
                              void run('share', {
                                workspaceId: proposal.id,
                                userIds: event.target.checked
                                  ? [...proposal.shared_ids, member.id]
                                  : proposal.shared_ids.filter(id => id !== member.id),
                              })
                            }
                          />
                          {[member.first_name, member.last_name].filter(Boolean).join(' ') ||
                            member.id}
                        </label>
                      ))}
                  </fieldset>
                )}
              <StudioProcedureComments
                key={proposal.id}
                session={session}
                workspaceId={proposal.id}
                c={c}
                busy={busy}
                run={run}
                tr={tr}
              />
            </CanvasChangeRequestCard>
          )}
        </>
      )}
      {error && (
        <p
          role="alert"
          className="bg-background text-destructive pointer-events-auto absolute bottom-1 left-1 z-40 p-2"
        >
          {error}
        </p>
      )}
    </>
  );

  const readOnlyReason = !session
    ? null
    : preview || (proposal && comparisonView !== 'difference')
      ? 'proposalPreviewReadOnly'
      : workspaceId
        ? draftEditable
          ? null
          : 'proposalDraftReadOnly'
        : session.canEditProject === false
          ? 'readOnly'
          : session.phase === 'suggest_internal'
            ? 'suggestionPhaseReadOnly'
            : session.phase === 'vote_internal'
              ? 'votingPhaseReadOnly'
              : !c.canEdit
                ? 'readOnly'
                : null;
  return {
    tools: session && (
      <StudioProcedureTools
        session={session}
        workspaceId={workspaceId}
        c={c}
        busy={busy || c.busy}
        run={run}
        chooseWorkspace={chooseWorkspace}
        tr={tr}
      />
    ),
    readOnlyReason,
    modeButton,
    canvasOverlay,
    markers,
    previewDocument:
      comparisonView === 'original'
        ? workspaceId
          ? draftBase
          : previewBase
        : !workspaceId
          ? preview
          : null,
    previewAssets: [...(comparisonView !== 'original' ? previewAssets : []), ...ghostAssets],
    editingAllowed:
      (workspaceId ? draftEditable : session ? session.phase === 'edit' : c.canEdit) &&
      (comparisonView === 'difference' || !proposal),
    selectProposal: setSelectedId,
  };
}
