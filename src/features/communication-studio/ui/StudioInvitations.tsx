import { useQuery } from '@rocicorp/zero/react';
import { queries } from '@/zero/queries';
import { useState } from 'react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { Button } from '@/features/shared/ui/ui/button';
import { useStudioClient } from '@/zero/communication-studio/useStudioClient';

interface StudioInvitation {
  id: string;
  project_id: string;
  title: string;
  owner_id: string;
  first_name: string | null;
  last_name: string | null;
  handle: string | null;
}

export function StudioInvitations() {
  const studio = useStudioClient();
  const { t } = useTranslation();
  const tr = (key: string) => t(`features.studio.${key}`);
  const [rows, queryStatus] = useQuery(queries.studio.invitations());
  const invitations: StudioInvitation[] = rows.map(row => ({
    id: row.id,
    project_id: row.project_id,
    title: row.project?.title ?? '',
    owner_id: row.project?.owner_id ?? '',
    first_name: row.project?.owner?.first_name ?? null,
    last_name: row.project?.owner?.last_name ?? null,
    handle: row.project?.owner?.handle ?? null,
  }));
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const respond = async (id: string, accept: boolean) => {
    setBusyId(id);
    setError('');
    try {
      await studio.respondInvitation({ invitationId: id, accept });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };
  const failure = error || (queryStatus.type === 'error' ? queryStatus.error.message : '');
  if (!invitations.length && !failure) return null;
  return (
    <section className="space-y-3" aria-label={tr('pendingInvitations')}>
      <h2 className="text-xl font-semibold">{tr('pendingInvitations')}</h2>
      {invitations.map(invitation => (
        <div
          key={invitation.id}
          className="bg-card flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
        >
          <div>
            <strong>{invitation.title}</strong>
            <p className="text-muted-foreground text-sm">
              {tr('invitedBy')}{' '}
              {[invitation.first_name, invitation.last_name].filter(Boolean).join(' ') ||
                invitation.handle}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              data-action-id="studio.invitation.respond.decline"
              variant="outline"
              disabled={busyId !== null}
              onClick={() => void respond(invitation.id, false)}
            >
              {tr('declineInvitation')}
            </Button>
            <Button
              data-action-id="studio.invitation.respond.accept"
              disabled={busyId !== null}
              onClick={() => void respond(invitation.id, true)}
            >
              {tr('acceptInvitation')}
            </Button>
          </div>
        </div>
      ))}
      {failure && (
        <p role="alert" className="text-destructive text-sm">
          {failure}
        </p>
      )}
    </section>
  );
}
