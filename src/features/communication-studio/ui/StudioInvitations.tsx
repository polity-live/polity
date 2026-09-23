import { useEffect, useState } from 'react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { Button } from '@/features/shared/ui/ui/button';
import { studioRequest } from '@/zero/communication-studio/useStudioApi';

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
  const { t } = useTranslation();
  const tr = (key: string) => t(`features.studio.${key}`);
  const [invitations, setInvitations] = useState<StudioInvitation[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    studioRequest<StudioInvitation[]>('myInvitations')
      .then(rows => {
        if (active) setInvitations(rows);
      })
      .catch(err => {
        if (active) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      active = false;
    };
  }, []);
  const respond = async (id: string, accept: boolean) => {
    setBusyId(id);
    setError('');
    try {
      await studioRequest('respondInvitation', { invitationId: id, accept });
      setInvitations(current => current.filter(invitation => invitation.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };
  if (!invitations.length && !error) return null;
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
              variant="outline"
              disabled={busyId !== null}
              onClick={() => void respond(invitation.id, false)}
            >
              {tr('declineInvitation')}
            </Button>
            <Button disabled={busyId !== null} onClick={() => void respond(invitation.id, true)}>
              {tr('acceptInvitation')}
            </Button>
          </div>
        </div>
      ))}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </section>
  );
}
