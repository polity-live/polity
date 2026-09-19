import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useRef, useState } from 'react';
import { Button } from '@/features/shared/ui/ui/button';
import { collaborationRequest, type CollaborationClient } from '../hooks/useCollaborationDocument';
interface Revision {
  id: string;
  revision: number;
  projection: unknown;
  reason: string;
}
export function RecoveryPanel({ client }: { client: CollaborationClient }) {
  const { t } = useTranslation();
  const [comparison, setComparison] = useState<{ base: unknown; local: unknown } | null>(null),
    [error, setError] = useState(''),
    [history, setHistory] = useState<Revision[]>([]),
    [pending, setPending] = useState(false);
  const running = useRef(false);
  const session = client.session;
  const run = (action: () => Promise<unknown>) => {
    if (running.current) return;
    running.current = true;
    setPending(true);
    setError('');
    void action()
      .catch(e => setError(String(e.message)))
      .finally(() => {
        running.current = false;
        setPending(false);
      });
  };
  const current = async (session: NonNullable<CollaborationClient['session']>) => {
    return collaborationRequest<{ id: string; generation: string; revision: number }>('read', {
      id: session.id,
      generation: session.generation,
    });
  };
  return (
    <div className="space-y-2">
      {error && <p role="alert">{error}</p>}
      {pending && (
        <span role="status">
          {t('features.collaboration.waiting', 'Serverbestätigung wird abgewartet …')}
        </span>
      )}
      {client.recoveries?.map((key, i) => (
        <Button
          data-action-id="collaboration.recovery-panel.lokalen-entwurf-vergleichen"
          key={key}
          variant="outline"
          size="sm"
          disabled={pending || client.phase !== 'active' || !session}
          onClick={() =>
            run(async () => {
              const result = await client.inspectRecovery?.(key);
              if (result) setComparison(result);
            })
          }
        >
          {t(
            'features.collaboration.compareLocal',
            { number: i + 1 },
            'Lokalen Entwurf {{number}} vergleichen'
          )}
        </Button>
      ))}
      {comparison && (
        <section className="rounded border p-3">
          <h3>
            {t('features.collaboration.resumeTitle', 'Wiederaufnahme als neuer privater Entwurf')}
          </h3>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              [t('features.collaboration.original', 'Ausgangsstand'), comparison.base],
              [t('features.collaboration.local', 'Lokaler Entwurf'), comparison.local],
              [t('features.collaboration.server', 'Aktueller Serverstand'), client.value],
            ].map(([title, value]) => (
              <div key={String(title)}>
                <h4>{String(title)}</h4>
                <pre className="max-h-64 overflow-auto text-xs whitespace-pre-wrap">
                  {JSON.stringify(value, null, 2)}
                </pre>
              </div>
            ))}
          </div>
          {session?.capabilities.suggest && !session.reference.workspaceId && (
            <Button
              data-action-id="collaboration.recovery-panel.als-neuen-entwurf-wiederaufnehmen"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const latest = await current(session);
                  const resumed = await collaborationRequest<{ workspaceId: string }>('resume', {
                    ...latest,
                    expectedRevision: latest.revision,
                    operationId: crypto.randomUUID(),
                    value: comparison.local,
                  });
                  client.selectWorkspace?.(resumed.workspaceId);
                  setComparison(null);
                })
              }
            >
              {t('features.collaboration.resume', 'Als neuen Entwurf wiederaufnehmen')}
            </Button>
          )}
          <Button
            data-action-id="collaboration.recovery-panel.schlie-en"
            variant="outline"
            onClick={() => setComparison(null)}
          >
            {t('features.collaboration.close', 'Schließen')}
          </Button>
        </section>
      )}
      {client.canEdit && session?.reference.workspaceId && (
        <Button
          data-action-id="collaboration.recovery-panel.entwurf-auf-aktuellen-haupttext-beziehen"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const saved = await client.commit();
              await collaborationRequest('rebase', {
                id: saved.id,
                generation: saved.generation,
                expectedRevision: saved.revision,
                operationId: crypto.randomUUID(),
              });
              client.reload();
            })
          }
        >
          {t('features.collaboration.rebase', 'Entwurf auf aktuellen Haupttext beziehen')}
        </Button>
      )}
      {session?.capabilities.manage && !session.reference.workspaceId && (
        <details>
          <summary>{t('features.collaboration.history', 'Gespeicherte Fassungen')}</summary>
          <Button
            data-action-id="collaboration.recovery-panel.fassungen-laden"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              run(async () =>
                setHistory(
                  await collaborationRequest<Revision[]>('revisions', {
                    id: session.id,
                    generation: session.generation,
                  })
                )
              )
            }
          >
            {t('features.collaboration.loadHistory', 'Fassungen laden')}
          </Button>
          {history.map(r => (
            <div key={r.id} className="flex items-center gap-2">
              <span>
                {t(
                  'features.collaboration.revision',
                  { revision: r.revision, reason: r.reason },
                  'Revision {{revision}} · {{reason}}'
                )}
              </span>
              <Button
                data-action-id="collaboration.recovery-panel.als-neue-generation-wiederherstellen"
                size="sm"
                variant="outline"
                disabled={pending || !client.canEdit}
                onClick={() =>
                  run(async () => {
                    const latest = await current(session);
                    await collaborationRequest('restore', {
                      id: latest.id,
                      generation: latest.generation,
                      expectedRevision: latest.revision,
                      operationId: crypto.randomUUID(),
                      value: r.projection,
                    });
                    client.reload();
                  })
                }
              >
                {t('features.collaboration.restore', 'Als neue Generation wiederherstellen')}
              </Button>
            </div>
          ))}
        </details>
      )}
    </div>
  );
}
