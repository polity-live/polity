import { useState } from 'react';
import { useAuth } from '@/providers/auth-provider';
import type { CanvasSession } from '../logic/governance';
import type { useStudioController } from '../hooks/useStudioController';
import { Button } from '@/features/shared/ui/ui/button';

type Run = (action: string, input?: Record<string, unknown>) => Promise<boolean>;
type Translate = (de: string, en: string) => string;

export function StudioProcedureComments({
  session,
  workspaceId,
  c,
  busy,
  run,
  tr,
}: {
  session: CanvasSession;
  workspaceId?: string;
  c: ReturnType<typeof useStudioController>;
  busy: boolean;
  run: Run;
  tr: Translate;
}) {
  const { user } = useAuth();
  const [body, setBody] = useState('');
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  return (
    <div className="space-y-2 border-t pt-2">
      <strong>{tr('Kommentare', 'Comments')}</strong>
      {session.comments
        .filter(comment => comment.proposal_id === (workspaceId ?? null))
        .map(comment => {
          const orphan =
            comment.element_id && !c.v3Value?.nodes.some(node => node.id === comment.element_id);
          return (
            <article key={comment.id} className="space-y-1 rounded border p-2">
              {editing?.id === comment.id ? (
                <form
                  onSubmit={event => {
                    event.preventDefault();
                    if (editing.body.trim())
                      void run('editComment', {
                        commentId: comment.id,
                        body: editing.body.trim(),
                      }).then(success => {
                        if (success) setEditing(null);
                      });
                  }}
                >
                  <textarea
                    aria-label={tr('Kommentar bearbeiten', 'Edit comment')}
                    className="w-full rounded border p-2"
                    value={editing.body}
                    onChange={event => setEditing({ ...editing, body: event.target.value })}
                  />
                  <Button disabled={busy || !editing.body.trim()}>{tr('Speichern', 'Save')}</Button>
                  <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                    {tr('Abbrechen', 'Cancel')}
                  </Button>
                </form>
              ) : (
                <p>{comment.body}</p>
              )}
              {orphan && (
                <small>{tr('Ziel nicht mehr vorhanden', 'Target no longer exists')}</small>
              )}
              {session.capabilities.comment && comment.author_id === user?.id && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => setEditing({ id: comment.id, body: comment.body })}
                >
                  {tr('Bearbeiten', 'Edit')}
                </Button>
              )}
              {session.capabilities.comment &&
                !comment.resolved &&
                (comment.author_id === user?.id || session.capabilities.manage) && (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => void run('resolveComment', { commentId: comment.id })}
                  >
                    {tr('Erledigt', 'Resolve')}
                  </Button>
                )}
              {comment.resolved && <small>{tr('Erledigt', 'Resolved')}</small>}
            </article>
          );
        })}
      <form
        onSubmit={event => {
          event.preventDefault();
          if (body.trim())
            void run('comment', {
              workspaceId,
              body: body.trim(),
              elementId: c.selected[0] ?? null,
            }).then(success => {
              if (success) setBody('');
            });
        }}
      >
        <textarea
          aria-label={tr('Kommentar', 'Comment')}
          className="w-full rounded border p-2"
          value={body}
          onChange={event => setBody(event.target.value)}
        />
        <Button disabled={busy || !body.trim() || !session.capabilities.comment}>
          {tr('Kommentieren', 'Comment')}
        </Button>
      </form>
    </div>
  );
}

export function StudioProcedureTools({
  session,
  workspaceId,
  c,
  busy,
  run,
  chooseWorkspace,
  tr,
}: {
  session: CanvasSession;
  workspaceId?: string;
  c: ReturnType<typeof useStudioController>;
  busy: boolean;
  run: Run;
  chooseWorkspace: (id?: string) => void;
  tr: Translate;
}) {
  const [group, setGroup] = useState('');
  return (
    <section
      className="space-y-3"
      aria-label={tr('Zusammenarbeit und Verfahren', 'Collaboration and procedure')}
    >
      {['conflict', 'offline', 'unavailable', 'error'].includes(c.status) && (
        <details open>
          <summary>{tr('Lokalen Entwurf wiederherstellen', 'Recover local draft')}</summary>
          <Button variant="outline" onClick={c.downloadLocalDraft}>
            {tr('Entwurf herunterladen', 'Download draft')}
          </Button>
          {session.capabilities.suggest && (
            <Button
              disabled={busy}
              onClick={() => void c.run(async () => chooseWorkspace(await c.recoverAsProposal()))}
            >
              {tr('Als neuen Vorschlag aufnehmen', 'Recover as a new proposal')}
            </Button>
          )}
          <div className="max-h-60 overflow-auto text-xs">
            {Object.entries(c.recovery ?? {}).map(([name, value]) => (
              <pre key={name} className="whitespace-pre-wrap">
                {name}
                {'\n'}
                {JSON.stringify(value, null, 2)}
              </pre>
            ))}
          </div>
        </details>
      )}
      {!workspaceId && (
        <StudioProcedureComments session={session} c={c} busy={busy} run={run} tr={tr} />
      )}
      {session.capabilities.manage && !workspaceId && (
        <details>
          <summary>{tr('Versionsverlauf', 'Revision history')}</summary>
          {session.revisions.map(revision => (
            <div key={revision.id} className="flex gap-2 py-1">
              <span>
                {revision.revision} · {new Date(Number(revision.created_at)).toLocaleString()}
              </span>
              <Button
                variant="outline"
                disabled={busy || session.phase !== 'edit'}
                onClick={() => void run('restore', { historyId: revision.id })}
              >
                {tr('Als neue Fassung wiederherstellen', 'Restore as new revision')}
              </Button>
            </div>
          ))}
        </details>
      )}
      {!!session.adoptionGroups?.length && !workspaceId && (
        <details>
          <summary>{tr('In einen Gruppenbereich übernehmen', 'Move to a group workspace')}</summary>
          <p>
            {tr(
              'Medien, Kommentare und Versionsverlauf werden für berechtigte Gruppenmitglieder zugänglich.',
              'Media, comments and revision history will become accessible to authorized group members.'
            )}
          </p>
          <select
            aria-label={tr('Zielgruppe', 'Destination group')}
            value={group}
            onChange={event => setGroup(event.target.value)}
            className="rounded border p-2"
          >
            <option value="">{tr('Gruppe auswählen', 'Select group')}</option>
            {session.adoptionGroups.map(item => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <Button
            disabled={busy || !group || session.phase !== 'edit'}
            onClick={() => void run('adopt', { groupId: group })}
          >
            {tr('Projekt für diese Gruppe freigeben', 'Share project with this group')}
          </Button>
        </details>
      )}
      {session.capabilities.manage && !!session.roles.length && (
        <details>
          <summary>
            {tr('Gruppenrollen im Canvas-Verfahren', 'Group roles in canvas procedures')}
          </summary>
          <p>
            {tr(
              'Eine deaktivierte Fähigkeit schränkt die Rolle in allen Canvas-Projekten der Gruppe ein. Bereits abgegebene Stimmen bleiben erhalten.',
              'A disabled capability restricts the role in all canvas projects of the group. Existing votes remain valid.'
            )}
          </p>
          {session.roles.map(role => (
            <fieldset key={role.id} disabled={busy} className="rounded border p-2">
              <legend>{role.name ?? role.id}</legend>
              {(['suggest', 'comment', 'vote'] as const).map(capability => (
                <label key={capability} className="flex gap-2">
                  <input
                    type="checkbox"
                    checked={role.capabilities[capability] !== false}
                    onChange={event =>
                      void run('setCapability', {
                        roleId: role.id,
                        capability,
                        allowed: event.target.checked,
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
