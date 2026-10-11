import { useQuery } from '@/zero/observed-query';
import { queries } from '@/zero/queries';
import { useMemo, useState } from 'react';
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
import { useStudioClient } from '@/zero/communication-studio/useStudioClient';

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
  const studio = useStudioClient();
  const { t } = useTranslation();
  const tr = (key: string) => t(`features.studio.${key}`);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [rows, collaboratorStatus] = useQuery(
    open ? queries.studio.collaborators({ projectId }) : undefined
  );
  const collaborators: Collaborator[] = (rows ?? []).map(row => ({
    id: row.id,
    user_id: row.user_id,
    status: row.status as Collaborator['status'],
    first_name: row.user?.first_name ?? null,
    last_name: row.user?.last_name ?? null,
    handle: row.user?.handle ?? null,
  }));
  const [busy, setBusy] = useState(false);
  const loading = open && collaboratorStatus.type === 'unknown';
  const [error, setError] = useState('');
  const failure =
    error || (collaboratorStatus.type === 'error' ? collaboratorStatus.error.message : '');
  const { allUsers, isLoading } = useUserState({ includeAllUsers: true });
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
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  const invite = () =>
    void run(async () => {
      await studio.inviteCollaborators({ projectId, userIds: selected });
      setSelected([]);
    });
  const remove = (userId: string) =>
    void run(async () => {
      await studio.removeCollaborator({ projectId, userId });
    });
  const resend = (userId: string) =>
    void run(async () => {
      await studio.inviteCollaborators({ projectId, userIds: [userId] });
    });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild data-action-id="studio.collaborator-invite.open">
        <Button variant="outline" size="sm" data-action-id="studio.collaborator-invite.open">
          <UserPlus className="mr-2 h-4 w-4" />
          {tr('invite')}
        </Button>
      </DialogTrigger>
      <ScrollableDialogContent className="h-[40rem] max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{tr('inviteCollaborators')}</DialogTitle>
          <DialogDescription>{tr('inviteDescription')}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 [scrollbar-gutter:stable] space-y-4 overflow-y-auto py-4">
          {loading || isLoading ? (
            <p role="status">{tr('loading')}</p>
          ) : (
            <TypeaheadSearch
              className="[&_[data-typeahead-dropdown]]:static"
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
                          data-action-id="studio.collaborator.invitation.resend"
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => resend(c.user_id)}
                        >
                          {tr('resendInvitation')}
                        </Button>
                      )}
                      <Button
                        data-action-id="studio.collaborator.access.remove"
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
          {failure && (
            <p role="alert" className="text-destructive text-sm">
              {failure}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            data-action-id="studio.collaborator.dialog.cancel"
            data-action-kind="interaction"
            variant="outline"
            disabled={busy}
            onClick={() => setOpen(false)}
          >
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
