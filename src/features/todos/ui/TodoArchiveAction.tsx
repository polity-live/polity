import { Archive, ArchiveRestore } from 'lucide-react';

import { useTranslation } from '@/features/shared/hooks/use-translation';
import { BadgeControl } from '@/features/shared/ui/status';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/features/shared/ui/ui/alert-dialog';
import { Button } from '@/features/shared/ui/ui/button';

interface TodoArchiveActionProps {
  archived: boolean;
  canManage: boolean;
  completed: boolean;
  isPending?: boolean;
  onArchive: () => void;
  onUnarchive: () => void;
}

export function TodoArchiveBadge() {
  const { t } = useTranslation();

  return (
    <BadgeControl variant="secondary">
      <Archive className="mr-1 h-3.5 w-3.5" />
      {t('features.todos.status.archived')}
    </BadgeControl>
  );
}

export function TodoArchiveAction({
  archived,
  canManage,
  completed,
  isPending = false,
  onArchive,
  onUnarchive,
}: TodoArchiveActionProps) {
  const { t } = useTranslation();

  if (!canManage || (!archived && !completed)) {
    return null;
  }

  if (archived) {
    return (
      <Button variant="outline" size="sm" disabled={isPending} onClick={onUnarchive}>
        <ArchiveRestore className="mr-2 h-4 w-4" />
        {t('features.todos.actions.unarchive')}
      </Button>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={isPending}>
          <Archive className="mr-2 h-4 w-4" />
          {t('features.todos.actions.archive')}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('features.todos.archive.confirmTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('features.todos.archive.confirmDescription')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('features.todos.archive.cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={onArchive}>
            {t('features.todos.actions.archive')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
