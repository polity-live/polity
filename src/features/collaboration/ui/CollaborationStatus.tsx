import { useState } from 'react';
import type { CollaborationClient } from '../hooks/useCollaborationDocument';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { Button } from '@/features/shared/ui/ui/button';
import { RecoveryPanel } from './RecoveryPanel';
import { collaborationRequest } from '../hooks/useCollaborationDocument';
export function CollaborationStatus({ client }: { client: CollaborationClient }) {
  const { t } = useTranslation();
  const [commandError, setCommandError] = useState('');
  if (client.phase === 'legacy') return null;
  return (
    <>
      <div
        className="mb-3 flex flex-wrap items-center gap-3 rounded border p-3 text-sm"
        role="status"
      >
        {commandError && <span role="alert">{commandError}</span>}
        <span>
          {t(
            `features.collaboration.status.${client.error ? 'recovery' : client.phase === 'active' ? client.status : client.phase}`,
            client.error || client.status
          )}
        </span>
        {client.session?.integrityError && (
          <span>
            {t(
              'features.collaboration.verifiedRead',
              { revision: client.session.readableRevision ?? 0 },
              'Letzte geprüfte Fassung: Revision {{revision}}. Bearbeitung gesperrt.'
            )}
          </span>
        )}
        {client.session?.integrityError && client.session.capabilities.manage && (
          <Button
            data-action-id="collaboration.collaboration-status.gepr-fte-fassung-wiederherstellen"
            size="sm"
            variant="outline"
            onClick={() => {
              const session = client.session;
              if (!session) return;
              void collaborationRequest('repair', {
                id: session.id,
                generation: session.generation,
                expectedRevision: session.revision,
                operationId: crypto.randomUUID(),
              })
                .then(() => client.reload())
                .catch(e => setCommandError(String(e.message)));
            }}
          >
            {t('features.collaboration.repair', 'Geprüfte Fassung wiederherstellen')}
          </Button>
        )}
        {client.phase === 'active' &&
          client.session?.capabilities.suggest &&
          !client.session.reference.workspaceId && (
            <Button
              data-action-id="collaboration.collaboration-status.features-collaboration-create-draft"
              size="sm"
              variant="outline"
              onClick={() => void client.createDraft('followup').catch(() => client.reload())}
            >
              {t('features.collaboration.createDraft', 'Create a separate draft')}
            </Button>
          )}
        {(client.error || client.status === 'offline') && (
          <Button
            data-action-id="collaboration.collaboration-status.features-collaboration-reconnect"
            size="sm"
            variant="outline"
            onClick={client.reload}
          >
            {t('features.collaboration.reconnect', 'Reconnect; keep local draft')}
          </Button>
        )}
        {client.canEdit && client.session?.reference.workspaceId && (
          <Button
            data-action-id="collaboration.collaborationstatus.activate.button-93060762cd"
            size="sm"
            onClick={() => void client.submit().catch(() => undefined)}
          >
            {client.session.draftAction === 'publish'
              ? t('features.collaboration.publish', 'Publish draft')
              : t('features.collaboration.submit', 'Submit proposal')}
          </Button>
        )}
        {!!client.workspaces?.length && (
          <select
            data-action-id="collaboration.collaboration-status.features-collaboration-main"
            aria-label={t('features.collaboration.workspace', 'Workspace')}
            value={client.session?.reference.workspaceId ?? ''}
            onChange={event => client.selectWorkspace?.(event.target.value || null)}
          >
            <option value="">{t('features.collaboration.main', 'Main document')}</option>
            {client.workspaces.map((draft, index) => (
              <option key={draft.id} value={draft.id}>
                {t('features.collaboration.draft', 'Draft')} {index + 1}
                {draft.frozen ? ' ✓' : ''}
              </option>
            ))}
          </select>
        )}
        {client.workspaces
          ?.filter(
            draft =>
              draft.owner && !draft.frozen && draft.id === client.session?.reference.workspaceId
          )
          .map(draft => (
            <Button
              data-action-id="collaboration.collaborationstatus.activate.button-6ac80345dc"
              key={draft.id}
              size="sm"
              variant="outline"
              onClick={() => void client.share?.(!draft.shared).catch(() => undefined)}
            >
              {t(
                draft.shared ? 'features.collaboration.unshare' : 'features.collaboration.share',
                draft.shared ? 'Make draft private' : 'Share with eligible collaborators'
              )}
            </Button>
          ))}
        {client.recoveries?.map((key, index) => (
          <Button
            data-action-id="collaboration.collaboration-status.features-collaboration-recover"
            key={key}
            size="sm"
            variant="outline"
            onClick={() => void client.exportRecovery?.(key)}
          >
            {t('features.collaboration.recover', 'Download earlier local draft')} {index + 1}
          </Button>
        ))}
      </div>
      <RecoveryPanel client={client} />
    </>
  );
}
