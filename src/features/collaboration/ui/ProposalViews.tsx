import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useEffect, useState } from 'react';
import type { Value } from 'platejs';
import { Plate, usePlateEditor } from 'platejs/react';
import { EditorKitWithoutFixedToolbar } from '@/features/shared/ui/kit-platejs/editor-kit';
import { Editor, EditorContainer } from '@/features/shared/ui/ui-platejs/editor';
import { Button } from '@/features/shared/ui/ui/button';
import { collaborationRequest, type CollaborationClient } from '../hooks/useCollaborationDocument';

function Preview({ value }: { value: Value }) {
  const editor = usePlateEditor({ plugins: EditorKitWithoutFixedToolbar, value });
  return (
    <Plate editor={editor} readOnly>
      <EditorContainer>
        <Editor readOnly />
      </EditorContainer>
    </Plate>
  );
}
interface Proposal {
  id: string;
  title: string | null;
  preview: Value | null;
  previewConflict: boolean;
  decisionResult: string | null;
  applicationStatus: string;
  conflictReason: string | null;
  canResolve: boolean;
}
export function ProposalViews({ client }: { client: CollaborationClient }) {
  const { t } = useTranslation();
  const [proposals, setProposals] = useState<Proposal[]>([]),
    [error, setError] = useState('');
  const session = client.session;
  useEffect(() => {
    if (client.phase !== 'active' || !session || session.reference.workspaceId) {
      setProposals([]);
      return;
    }
    let stopped = false;
    const refresh = () => {
      void collaborationRequest<Proposal[]>('proposals', {
        id: session.id,
        generation: session.generation,
      })
        .then(p => {
          if (!stopped) {
            setProposals(p);
            setError('');
          }
        })
        .catch(e => {
          if (!stopped) {
            setProposals([]);
            setError(String(e.message));
          }
        });
    };
    refresh();
    const timer = setInterval(refresh, 3000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [client.phase, session?.id, session?.generation]);
  if (!session) return null;
  return (
    <div className="space-y-2">
      {error && <p role="alert">{error}</p>}
      {proposals.map(p => (
        <details key={p.id} className="rounded border p-3">
          <summary>
            {p.title ?? t('features.collaboration.proposalTitle', 'Änderungsantrag')} ·{' '}
            {p.decisionResult ?? t('features.collaboration.submitted', 'Eingereicht')} ·{' '}
            {p.applicationStatus}
          </summary>
          {p.previewConflict && (
            <p>
              {t(
                'features.collaboration.previewChanged',
                'Die Vorschau zeigt die eingereichte Fassung. Der Haupttext hat sich inzwischen verändert.'
              )}
            </p>
          )}
          {p.conflictReason && (
            <p role="alert">
              {t(
                'features.collaboration.conflictNotice',
                { reason: p.conflictReason },
                'Anwendungskonflikt: {{reason}}. Die Entscheidung bleibt erhalten.'
              )}
            </p>
          )}
          {p.preview && <Preview key={JSON.stringify(p.preview)} value={p.preview} />}
          {!p.decisionResult &&
            p.canResolve &&
            (['accepted', 'rejected'] as const).map(result => (
              <Button
                data-action-id="collaboration.proposalviews.activate.button-a066808dbe"
                key={result}
                variant="outline"
                onClick={() =>
                  void (
                    client.canEdit
                      ? client.commit()
                      : collaborationRequest<{ id: string; generation: string; revision: number }>(
                          'read',
                          {
                            id: session.id,
                            generation: session.generation,
                          }
                        )
                  )
                    .then(latest =>
                      collaborationRequest('resolve', {
                        operationId: crypto.randomUUID(),
                        id: latest.id,
                        generation: latest.generation,
                        expectedRevision: latest.revision,
                        changeRequestId: p.id,
                        result,
                      })
                    )
                    .then(() => client.reload())
                    .catch(e => setError(String(e.message)))
                }
              >
                {result === 'accepted'
                  ? t('features.collaboration.accept', 'Annehmen')
                  : t('features.collaboration.reject', 'Ablehnen')}
              </Button>
            ))}
          {p.applicationStatus === 'conflict' && session?.capabilities.manage && (
            <Button
              data-action-id="collaboration.proposal-views.anwendung-erneut-pr-fen"
              onClick={() =>
                void collaborationRequest('read', {
                  id: session.id,
                  generation: session.generation,
                })
                  .then(latest =>
                    collaborationRequest('retryDecision', {
                      operationId: crypto.randomUUID(),
                      id: session.id,
                      generation: session.generation,
                      expectedRevision: (latest as { revision: number }).revision,
                      changeRequestId: p.id,
                    })
                  )
                  .then(() => client.reload())
                  .catch(e => setError(String(e.message)))
              }
            >
              {t('features.collaboration.retryDecision', 'Anwendung erneut prüfen')}
            </Button>
          )}
          {p.applicationStatus === 'conflict' && session?.capabilities.suggest && (
            <Button
              data-action-id="collaboration.proposal-views.neuen-nderungsantrag-entwerfen"
              variant="outline"
              onClick={() => void client.createDraft('proposal')}
            >
              {t('features.collaboration.newProposal', 'Neuen Änderungsantrag entwerfen')}
            </Button>
          )}
        </details>
      ))}
    </div>
  );
}
