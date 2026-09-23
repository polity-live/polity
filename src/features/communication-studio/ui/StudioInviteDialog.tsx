import { useEffect, useMemo, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { ScrollableDialogContent } from '@/features/shared/ui/dialog';
import { TypeaheadSearch } from '@/features/shared/ui/typeahead/TypeaheadSearch';
import { toTypeaheadItems } from '@/features/shared/ui/typeahead/toTypeaheadItems';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/features/shared/ui/ui/dialog';
import { useUserState } from '@/zero/users/useUserState';
import { studioRequest } from '@/zero/communication-studio/useStudioApi';

interface Collaborator {
  id: string;
  user_id: string;
  status: 'invited' | 'active' | 'declined';
  first_name: string | null;
  last_name: string | null;
  handle: string | null;
}

export function StudioInviteDialog({
  projectId,
  currentUserId,
}: {
  projectId: string;
  currentUserId: string;
}) {
  const { t } = useTranslation();
  const tr = (key: string) => t(`features.studio.${key}`);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { allUsers, isLoading } = useUserState({ includeAllUsers: true });
  const refresh = async () => {
    setCollaborators(await studioRequest<Collaborator[]>('collaborators', { projectId }));
  };
  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setError('');
    studioRequest<Collaborator[]>('collaborators', { projectId })
      .then(rows => {
        if (active) setCollaborators(rows);
      })
      .catch(err => {
        if (active) setError(String(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, projectId]);
  const excluded = new Set(collaborators.filter(c => c.status !== 'declined').map(c => c.user_id));
  const items = useMemo(() => {
    const availableUsers = (allUsers ?? []).filter(
      user => user.id !== currentUserId && !excluded.has(user.id)
    );
    return toTypeaheadItems(
      availableUsers,
      'user',
      user =>
        [user.first_name, user.last_name].filter(Boolean).join(' ') ||
        user.handle ||
        user.email ||
        tr('unnamedUser'),
      user => (user.handle ? `@${user.handle}` : user.email),
      user => user.avatar
    ).map((item, index) => ({
      ...item,
      keywords: availableUsers[index]?.email ? [availableUsers[index].email] : [],
    }));
  }, [allUsers, currentUserId, collaborators]);
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await work();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  const invite = () =>
    void run(async () => {
      await studioRequest('inviteCollaborators', { projectId, userIds: selected });
      setSelected([]);
    });
  const remove = (userId: string) =>
    void run(async () => {
      await studioRequest('removeCollaborator', { projectId, userId });
    });
  const resend = (userId: string) =>
    void run(async () => {
      await studioRequest('inviteCollaborators', { projectId, userIds: [userId] });
    });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-action-id="studio.collaborator-invite.open">
          <UserPlus className="mr-2 h-4 w-4" />
          {tr('invite')}
        </Button>
      </DialogTrigger>
      <ScrollableDialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{tr('inviteCollaborators')}</DialogTitle>
          <DialogDescription>{tr('inviteDescription')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {loading || isLoading ? (
            <p role="status">{tr('loading')}</p>
          ) : (
            <TypeaheadSearch
              items={items}
              multiple
              values={selected}
              onValuesChange={setSelected}
              placeholder={tr('inviteSearch')}
              disablePortal
              showAllResults
              showAllOnFocus
            />
          )}
          {collaborators.some(c => c.status !== 'declined') && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">{tr('collaborators')}</h3>
              {collaborators
                .filter(c => c.status !== 'declined')
                .map(c => (
                  <div key={c.id} className="flex items-center justify-between gap-2 text-sm">
                    <span>
                      {[c.first_name, c.last_name].filter(Boolean).join(' ') ||
                        c.handle ||
                        tr('unnamedUser')}
                      {' · '}
                      {tr(c.status === 'active' ? 'activeCollaborator' : 'pendingInvitation')}
                    </span>
                    <span className="flex gap-1">
                      {c.status === 'invited' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => resend(c.user_id)}
                        >
                          {tr('resendInvitation')}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => remove(c.user_id)}
                      >
                        {tr('removeCollaborator')}
                      </Button>
                    </span>
                  </div>
                ))}
            </section>
          )}
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            data-action-id="studio.collaborator-invite.submit"
            disabled={busy || loading || selected.length === 0}
            onClick={invite}
          >
            {tr('invite')} ({selected.length})
          </Button>
        </DialogFooter>
      </ScrollableDialogContent>
    </Dialog>
  );
}
