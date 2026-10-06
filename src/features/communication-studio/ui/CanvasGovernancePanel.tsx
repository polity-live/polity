import { useEffect, useState } from 'react';
import { useQuery } from '@rocicorp/zero/react';
import { queries } from '@/zero/queries';
import { studioRequest } from '@/zero/communication-studio/useStudioApi';
import { useAuth } from '@/providers/auth-provider';
import type { CanvasSession, CanvasProposal } from '../logic/governance';
import type { useStudioController } from '../hooks/useStudioController';

export function CanvasGovernancePanel({
  projectId,
  workspaceId,
  chooseWorkspace,
  c,
}: {
  projectId: string;
  workspaceId?: string;
  chooseWorkspace: (id?: string) => void;
  c: ReturnType<typeof useStudioController>;
}) {
  const { user } = useAuth();
  const [proposalUpdates] = useQuery(queries.studio.proposals({ projectId }));
  const [session, setSession] = useState<CanvasSession | null>(null);
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const [title, setTitle] = useState(''),
    [reason, setReason] = useState(''),
    [body, setBody] = useState('');
  const [commentEdit, setCommentEdit] = useState<{ id: string; body: string } | null>(null);
  const [adoptionGroup, setAdoptionGroup] = useState('');
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);
  const [comparisonView, setComparisonView] = useState<'original' | 'difference' | 'proposal'>(
    'difference'
  );
  const de = typeof document === 'undefined' || document.documentElement.lang !== 'en';
  const tr = (a: string, b: string) => (de ? a : b);
  useEffect(() => {
    setSelectedProposalId(
      typeof window === 'undefined'
        ? null
        : new URLSearchParams(window.location.search).get('proposalId')
    );
  }, [projectId]);
  const refresh = async () =>
    setSession(await studioRequest<CanvasSession>('canvas', { projectId, action: 'session' }));
  useEffect(() => {
    let live = true;
    const load = () =>
      studioRequest<CanvasSession>('canvas', { projectId, action: 'session' })
        .then(s => {
          if (live) setSession(s);
        })
        .catch(e => {
          if (live) setError(String(e));
        });
    void load();
    const timer = setInterval(() => void load(), 4000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [projectId, proposalUpdates]);
  const run = async (action: string, input: Record<string, unknown> = {}) => {
    if (!session) return;
    setBusy(true);
    setError('');
    try {
      let revision: number | undefined;
      if (['createDraft', 'submit', 'phase', 'restore', 'share', 'adopt'].includes(action))
        revision = await c.commit();
      if (['phase', 'restore', 'resolveDraft'].includes(action))
        revision = (await studioRequest<{ revision: number }>('load', { id: projectId })).revision;
      if (['acceptPrivate', 'rejectPrivate'].includes(action))
        revision = session.proposals.find(proposal => proposal.id === input.workspaceId)?.revision;
      const result = await studioRequest<{ workspaceId?: string }>('canvas', {
        projectId,
        action,
        generation: session.generation,
        operationId: crypto.randomUUID(),
        revision,
        ...input,
      });
      await refresh();
      if (action === 'createDraft' || action === 'resolveDraft')
        chooseWorkspace(result.workspaceId);
      if (['submit', 'restore', 'withdraw'].includes(action)) chooseWorkspace();
      if (action === 'comment') setBody('');
      if (action === 'editComment') setCommentEdit(null);
      if (action === 'adopt') location.assign(`/group/${input.groupId}/studio/${projectId}`);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  const phaseLabel = (phase: string) =>
    ({
      edit: tr('Bearbeiten', 'Edit'),
      view: tr('Ansehen', 'View'),
      suggest_internal: tr('Vorschlagen', 'Suggest'),
      vote_internal: tr('Abstimmen', 'Vote'),
    })[phase] ?? phase;
  const stateLabel = (state: string) =>
    ({
      draft: tr('Entwurf', 'Draft'),
      submitted: tr('Eingereicht', 'Submitted'),
      voting: tr('Abstimmung', 'Voting'),
      closed: tr('Abgeschlossen', 'Closed'),
      withdrawn: tr('Zurückgezogen', 'Withdrawn'),
      accepted: tr('Angenommen', 'Accepted'),
      rejected: tr('Abgelehnt', 'Rejected'),
      applied: tr('Angewendet', 'Applied'),
      conflict: tr('Anwendungskonflikt', 'Application conflict'),
      pending: tr('Ausstehend', 'Pending'),
      not_applicable: '—',
      superseded: tr('Durch neuen Beschluss geklärt', 'Resolved by a new decision'),
    })[state] ?? state;
  const viewProposal = async (id: string, view: 'original' | 'difference' | 'proposal') => {
    try {
      await c.commit();
      chooseWorkspace(view === 'proposal' ? id : undefined);
      setSelectedProposalId(id);
      setComparisonView(view);
    } catch (cause) {
      setError(String(cause));
    }
  };
  const button = 'rounded border bg-background px-2 py-1 text-sm disabled:opacity-40';
  const current = session?.proposals.find(p => p.id === workspaceId);
  return (
    <section
      className="bg-card space-y-3 rounded-lg border p-3"
      aria-label={tr('Vorschläge und Abstimmungen', 'Proposals and votes')}
    >
      {!!session?.adoptionGroups?.length && (
        <details>
          <summary>{tr('In einen Gruppenbereich übernehmen', 'Move to a group workspace')}</summary>
          <p className="text-sm">
            {tr(
              'Das Projekt einschließlich Medien, Kommentaren und Versionshistorie wird für berechtigte Gruppenmitglieder zugänglich.',
              'The project, including media, comments and revision history, will become accessible to authorized group members.'
            )}
          </p>
          <select
            aria-label={tr('Zielgruppe', 'Destination group')}
            value={adoptionGroup}
            onChange={e => setAdoptionGroup(e.target.value)}
            className={button}
          >
            <option value="">{tr('Gruppe auswählen', 'Select group')}</option>
            {session.adoptionGroups.map(g => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <button
            className={button}
            disabled={busy || !adoptionGroup}
            onClick={() => void run('adopt', { groupId: adoptionGroup })}
          >
            {tr('Projekt für diese Gruppe freigeben', 'Share project with this group')}
          </button>
        </details>
      )}
      {['conflict', 'offline', 'unavailable', 'error'].includes(c.status) && (
        <details open>
          <summary>{tr('Lokalen Entwurf wiederherstellen', 'Recover local draft')}</summary>
          <button className={button} onClick={c.downloadLocalDraft}>
            {tr('Entwurf herunterladen', 'Download draft')}
          </button>
          {session?.capabilities.suggest && (
            <button
              className={button}
              onClick={() => void c.run(async () => chooseWorkspace(await c.recoverAsProposal()))}
            >
              {tr('Als neuen Vorschlag aufnehmen', 'Recover as a new proposal')}
            </button>
          )}
          <div className="grid max-h-60 grid-cols-3 gap-2 overflow-auto text-xs">
            {Object.entries(c.recovery ?? {}).map(([name, value]) => (
              <pre key={name} className="break-all whitespace-pre-wrap">
                {name}
                {'\n'}
                {JSON.stringify(value, null, 2)}
              </pre>
            ))}
          </div>
        </details>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <strong>{tr('Verfahren', 'Procedure')}</strong>
        {session && (
          <select
            aria-label={tr('Bearbeitungsmodus', 'Editing mode')}
            className={button}
            value={session.phase}
            disabled={busy || !session.capabilities.manage || !session.groupId}
            onChange={e => void run('phase', { phase: e.target.value })}
          >
            {['edit', 'suggest_internal', 'vote_internal', 'view'].map(p => (
              <option key={p} value={p}>
                {phaseLabel(p)}
              </option>
            ))}
          </select>
        )}
        {workspaceId && (
          <>
            <span>
              {tr('Vorschlagsentwurf', 'Proposal draft')}: {current?.title}
            </span>
            <button
              className={button}
              onClick={() =>
                void c.run(async () => {
                  await c.commit();
                  chooseWorkspace();
                })
              }
            >
              {tr('Zum verbindlichen Inhalt', 'Canonical content')}
            </button>
          </>
        )}
        <span className="text-muted-foreground text-sm">{c.status}</span>
      </div>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {session?.capabilities.suggest &&
        ['edit', 'suggest_internal'].includes(session.phase) &&
        !workspaceId && (
          <div className="flex flex-wrap gap-2">
            <input
              className="rounded border px-2"
              aria-label={tr('Vorschlagstitel', 'Proposal title')}
              placeholder={tr('Titel des Vorschlags', 'Proposal title')}
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
            <input
              className="rounded border px-2"
              aria-label={tr('Begründung', 'Reason')}
              placeholder={tr('Begründung', 'Reason')}
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
            <button
              className={button}
              disabled={busy || !title.trim()}
              onClick={() => void run('createDraft', { title, reason })}
            >
              {tr('Vorschlag beginnen', 'Start proposal')}
            </button>
          </div>
        )}
      <details open={!!workspaceId || !!selectedProposalId || session?.phase === 'vote_internal'}>
        <summary>
          {tr('Änderungsanträge', 'Change requests')} ({session?.proposals.length ?? 0})
        </summary>
        <div className="grid gap-3 py-2 md:grid-cols-2">
          {session?.proposals.map(p => (
            <article key={p.id} className="space-y-2 rounded border p-3">
              <strong>
                {p.origin === 'ai' ? 'AI Suggestion · ' : ''}
                {p.title}
              </strong>
              <p>{p.reason}</p>
              {p.origin === 'ai' && (
                <p className="text-muted-foreground text-xs">
                  {p.ai_mode === 'free'
                    ? tr('Frei gestaltet', 'Free design')
                    : tr('Vorlage', 'Template')}
                  {p.ai_sources?.length
                    ? ` · ${p.ai_sources.length} ${tr('Quellen', 'sources')}`
                    : ''}
                  {p.ai_warnings?.length ? ` · ${p.ai_warnings.join(', ')}` : ''}
                </p>
              )}
              {p.resolves_id && (
                <p className="text-sm">
                  {tr(
                    'Klärung des Anwendungskonflikts zu',
                    'Resolution of the application conflict for'
                  )}
                  : {session.proposals.find(previous => previous.id === p.resolves_id)?.title}
                </p>
              )}
              <p className="text-sm">
                {stateLabel(p.state)} · {p.decision && `${stateLabel(p.decision)} · `}
                {stateLabel(p.application)}
              </p>
              {p.deadline && (
                <p className="text-sm">
                  {tr('Frist', 'Deadline')}: {new Date(Number(p.deadline)).toLocaleString()}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {p.origin === 'ai' && (
                  <div
                    role="group"
                    aria-label={tr('Ansicht', 'View')}
                    className="flex flex-wrap gap-2"
                  >
                    <button className={button} onClick={() => void viewProposal(p.id, 'original')}>
                      {tr('Original', 'Original')}
                    </button>
                    <button
                      className={button}
                      onClick={() => void viewProposal(p.id, 'difference')}
                    >
                      {tr('Differenz', 'Difference')}
                    </button>
                    <button className={button} onClick={() => void viewProposal(p.id, 'proposal')}>
                      {tr('Vorschlag', 'Proposal')}
                    </button>
                  </div>
                )}
                {p.state === 'draft' && (
                  <button className={button} disabled={busy} onClick={() => chooseWorkspace(p.id)}>
                    {tr('Entwurf bearbeiten', 'Edit draft')}
                  </button>
                )}
                {p.id === workspaceId &&
                  p.owner_id === user?.id &&
                  p.state === 'draft' &&
                  p.origin !== 'ai' && (
                    <button
                      className={button}
                      disabled={busy}
                      onClick={() => void run('submit', { workspaceId: p.id })}
                    >
                      {tr('Einreichen', 'Submit')}
                    </button>
                  )}
                {!workspaceId &&
                  p.origin === 'ai' &&
                  p.state === 'draft' &&
                  session.capabilities.manage && (
                    <>
                      <button
                        className={button}
                        disabled={busy}
                        onClick={() => void run('acceptPrivate', { workspaceId: p.id })}
                      >
                        {tr('Annehmen', 'Accept')}
                      </button>
                      <button
                        className={button}
                        disabled={busy}
                        onClick={() => void run('rejectPrivate', { workspaceId: p.id })}
                      >
                        {tr('Ablehnen', 'Reject')}
                      </button>
                    </>
                  )}
                {p.owner_id === user?.id && ['draft', 'submitted'].includes(p.state) && (
                  <button
                    className={button}
                    disabled={busy}
                    onClick={() => void run('withdraw', { workspaceId: p.id })}
                  >
                    {tr('Zurückziehen', 'Withdraw')}
                  </button>
                )}
                {p.state === 'submitted' &&
                  session.phase === 'vote_internal' &&
                  session.capabilities.manage && (
                    <button
                      className={button}
                      disabled={busy}
                      onClick={() => void run('startVote', { workspaceId: p.id, minutes: 5 })}
                    >
                      {tr('Abstimmung starten (5 Min.)', 'Start vote (5 min.)')}
                    </button>
                  )}
                {p.state === 'voting' &&
                  session.capabilities.vote &&
                  p.electorate?.includes(user?.id ?? '') &&
                  ['accept', 'reject', 'abstain'].map(choice => (
                    <button
                      key={choice}
                      className={button}
                      disabled={busy}
                      aria-pressed={p.votes.some(
                        v => v.user_id === user?.id && v.choice === choice
                      )}
                      onClick={() => void run('vote', { workspaceId: p.id, choice })}
                    >
                      {choice === 'accept'
                        ? tr('Ja', 'Yes')
                        : choice === 'reject'
                          ? tr('Nein', 'No')
                          : tr('Enthaltung', 'Abstain')}
                    </button>
                  ))}
                {p.state === 'voting' &&
                  (session.capabilities.manage || Date.now() >= Number(p.deadline)) && (
                    <button
                      className={button}
                      disabled={busy}
                      onClick={() => void run('finalize', { workspaceId: p.id })}
                    >
                      {tr('Abschließen', 'Close vote')}
                    </button>
                  )}
                {p.application === 'conflict' && session.capabilities.manage && (
                  <button
                    className={button}
                    disabled={busy}
                    onClick={() => void run('reapply', { workspaceId: p.id })}
                  >
                    {tr('Unveränderten Beschluss erneut prüfen', 'Retry unchanged decision')}
                  </button>
                )}
                {p.application === 'conflict' && session.capabilities.suggest && (
                  <button
                    className={button}
                    disabled={busy}
                    onClick={() =>
                      void run('resolveDraft', {
                        workspaceId: p.id,
                        title: tr('Klärung: ', 'Resolution: ') + p.title,
                        reason: tr(
                          'Dieser Vorschlag benötigt eine neue Abstimmung. Der ursprüngliche Beschluss bleibt unverändert dokumentiert.',
                          'This proposal requires a new vote. The original decision remains recorded unchanged.'
                        ),
                      })
                    }
                  >
                    {tr('Neuen Klärungsvorschlag erstellen', 'Create a new resolution proposal')}
                  </button>
                )}
              </div>
              {p.id === workspaceId && p.owner_id === user?.id && p.state === 'draft' && (
                <fieldset disabled={busy} className="rounded border p-2 text-sm">
                  <legend>{tr('Privaten Entwurf teilen', 'Share private draft')}</legend>
                  <p className="text-muted-foreground">
                    {tr(
                      'Nur ausgewählte Personen können diesen Entwurf und seine Diskussion sehen.',
                      'Only selected people can access this draft and its discussion.'
                    )}
                  </p>
                  {session.members
                    .filter(m => m.id !== user?.id)
                    .map(m => (
                      <label key={m.id} className="flex items-center gap-2 py-1">
                        <input
                          type="checkbox"
                          checked={p.shared_ids.includes(m.id)}
                          onChange={e =>
                            void run('share', {
                              workspaceId: p.id,
                              userIds: e.target.checked
                                ? [...p.shared_ids, m.id]
                                : p.shared_ids.filter(id => id !== m.id),
                            })
                          }
                        />
                        {[m.first_name, m.last_name].filter(Boolean).join(' ') || m.id}
                      </label>
                    ))}
                </fieldset>
              )}
              {p.changes?.length ? (
                <details
                  open={
                    selectedProposalId === p.id &&
                    p.origin === 'ai' &&
                    comparisonView === 'difference'
                  }
                >
                  <summary>
                    {tr('Änderungen vergleichen', 'Compare changes')} ({p.changes.length})
                  </summary>
                  <ProposalDiff proposal={p} />
                </details>
              ) : null}
            </article>
          ))}
        </div>
      </details>
      <details>
        <summary>{tr('Diskussion', 'Discussion')}</summary>
        {session?.comments
          .filter(comment => comment.proposal_id === (workspaceId ?? null))
          .map(comment => {
            const orphan =
              comment.element_id &&
              !c.value?.pages.some(
                p =>
                  p.elements.some(e => e.id === comment.element_id) ||
                  p.canvas?.elements.some(e => e.id === comment.element_id && !e.isDeleted)
              );
            return (
              <article className="my-2 rounded border p-2" key={comment.id}>
                {commentEdit?.id === comment.id ? (
                  <div className="space-y-2">
                    <textarea
                      aria-label={tr('Kommentar bearbeiten', 'Edit comment')}
                      className="w-full rounded border p-2"
                      value={commentEdit.body}
                      onChange={e => setCommentEdit({ ...commentEdit, body: e.target.value })}
                    />
                    <button
                      className={button}
                      disabled={busy || !commentEdit.body.trim()}
                      onClick={() =>
                        void run('editComment', { commentId: comment.id, body: commentEdit.body })
                      }
                    >
                      {tr('Speichern', 'Save')}
                    </button>
                    <button className={button} onClick={() => setCommentEdit(null)}>
                      {tr('Abbrechen', 'Cancel')}
                    </button>
                  </div>
                ) : (
                  <p>{comment.body}</p>
                )}
                {comment.author_id === user?.id && (
                  <button
                    className={button}
                    onClick={() => setCommentEdit({ id: comment.id, body: comment.body })}
                  >
                    {tr('Bearbeiten', 'Edit')}
                  </button>
                )}
                {orphan && (
                  <small>{tr('Ziel nicht mehr vorhanden', 'Target no longer exists')}</small>
                )}
                <p className="text-muted-foreground text-xs">{comment.author_id}</p>
                {!comment.resolved &&
                  (comment.author_id === user?.id || session.capabilities.manage) && (
                    <button
                      className={button}
                      onClick={() => void run('resolveComment', { commentId: comment.id })}
                    >
                      {tr('Erledigt', 'Resolve')}
                    </button>
                  )}
              </article>
            );
          })}
        <textarea
          className="w-full rounded border p-2"
          aria-label={tr('Kommentar', 'Comment')}
          value={body}
          onChange={e => setBody(e.target.value)}
        />
        <button
          className={button}
          disabled={busy || !body.trim() || !session?.capabilities.comment}
          onClick={() =>
            void run('comment', { workspaceId, body, elementId: c.selected[0] ?? null })
          }
        >
          {tr('Kommentieren', 'Comment')}
        </button>
      </details>
      {session?.capabilities.manage && !workspaceId && (
        <details>
          <summary>{tr('Versionsverlauf', 'Revision history')}</summary>
          {session.revisions.map(r => (
            <div className="flex gap-3 p-1" key={r.id}>
              <span>
                {r.revision} · {new Date(Number(r.created_at)).toLocaleString()}
              </span>
              <button
                className={button}
                disabled={busy || session.phase !== 'edit'}
                onClick={() => void run('restore', { historyId: r.id })}
              >
                {tr('Als neue Fassung wiederherstellen', 'Restore as new revision')}
              </button>
            </div>
          ))}
        </details>
      )}
      {!!session?.roles.length && (
        <details>
          <summary>
            {tr('Gruppenrollen im Canvas-Verfahren', 'Group roles in canvas procedures')}
          </summary>
          <p className="text-muted-foreground text-sm">
            {tr(
              'Eine ausgeschaltete Fähigkeit schränkt diese Rolle in allen Canvas-Projekten der Gruppe ein. Bereits abgegebene Stimmen bleiben erhalten.',
              'A disabled capability restricts this role in all canvas projects of the group. Existing votes remain valid.'
            )}
          </p>
          {session.roles.map(role => (
            <fieldset
              key={role.id}
              disabled={busy}
              className="my-2 flex flex-wrap gap-3 rounded border p-2"
            >
              <legend>{role.name ?? role.id}</legend>
              {(['suggest', 'comment', 'vote'] as const).map(capability => (
                <label key={capability} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={role.capabilities[capability] !== false}
                    onChange={e =>
                      void run('setCapability', {
                        roleId: role.id,
                        capability,
                        allowed: e.target.checked,
                      })
                    }
                  />
                  {capability === 'suggest'
                    ? tr('Vorschlagen', 'Suggest')
                    : capability === 'comment'
                      ? tr('Kommentieren', 'Comment')
                      : tr('Abstimmen', 'Vote')}
                </label>
              ))}
            </fieldset>
          ))}
        </details>
      )}
    </section>
  );
}
function ProposalDiff({ proposal }: { proposal: CanvasProposal }) {
  return (
    <dl className="max-h-64 space-y-2 overflow-auto text-xs">
      {proposal.changes?.map((c, i) => (
        <div key={i}>
          <dt className="font-mono break-all">{c.path.join(' / ')}</dt>
          <dd className="grid grid-cols-2 gap-2">
            <del className="bg-red-50 break-all text-black">
              {JSON.stringify(c.before.value)?.slice(0, 1500)}
            </del>
            <ins className="bg-green-50 break-all text-black">
              {JSON.stringify(c.after.value)?.slice(0, 1500)}
            </ins>
          </dd>
        </div>
      ))}
    </dl>
  );
}
