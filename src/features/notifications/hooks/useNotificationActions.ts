import { useNavigate } from '@tanstack/react-router';
import { useCallback, type MouseEvent } from 'react';
import { Notification } from '../types/notification.types';
import { getNotificationNavigationTarget, isNotificationRead } from '../logic/notificationHelpers';
import { useNotificationActions as useZeroNotificationActions } from '@/zero/notifications/useNotificationActions';
import { serverConfirmed, waitForClientApply } from '@/zero/mutate-with-server-check';
import { gatedToast as toast } from '../utils/gated-toast';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { reportAppTutorialAction } from '@/features/app-tutorial/events';

export function useNotificationActions() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const {
    setNotificationRead,
    dismissNotification,
    restoreNotification,
    purgeNotificationForUser,
    deleteEntityNotificationGlobally,
  } = useZeroNotificationActions();

  const markNotificationAsRead = useCallback(
    async (notification: Notification) => {
      if (isNotificationRead(notification)) {
        return;
      }

      const result = setNotificationRead({ notificationId: notification.id, read: true });
      await waitForClientApply(result);
      try {
        await serverConfirmed(result);
        reportAppTutorialAction({
          type: 'mutation',
          event: 'notification.read',
        });
      } catch {
        // Zero rolls the optimistic state back and the notification remains unread.
      }
    },
    [setNotificationRead]
  );

  const handleMarkNotificationAsRead = useCallback(
    async (notification: Notification, event?: MouseEvent) => {
      event?.preventDefault();
      event?.stopPropagation();
      await markNotificationAsRead(notification);
    },
    [markNotificationAsRead]
  );

  const handleNotificationClick = useCallback(
    async (notification: Notification) => {
      await markNotificationAsRead(notification);

      const navigationTarget = getNotificationNavigationTarget(notification);

      if (navigationTarget?.kind === 'messages') {
        navigate({
          to: '/messages',
          search: navigationTarget.search,
        });
        return;
      }

      if (navigationTarget?.kind === 'route') {
        navigate({ to: navigationTarget.to });
        return;
      }

      // Navigate based on related entity
      if (notification.related_entity_type) {
        switch (notification.related_entity_type) {
          case 'group':
            if (notification.related_group?.id) {
              navigate({ to: `/group/${notification.related_group.id}` });
            }
            break;
          case 'event':
            if (notification.related_event?.id) {
              navigate({ to: `/event/${notification.related_event.id}` });
            }
            break;
          case 'user':
            if (notification.related_user?.id) {
              navigate({ to: `/user/${notification.related_user.id}` });
            }
            break;
          case 'message':
            navigate({ to: '/messages' });
            break;
          case 'blog':
            if (notification.related_blog?.id) {
              const blogId = notification.related_blog.id;
              if (notification.on_behalf_of_group?.id) {
                navigate({ to: `/group/${notification.on_behalf_of_group.id}/blog/${blogId}` });
              } else if (notification.related_user?.id) {
                navigate({ to: `/user/${notification.related_user.id}/blog/${blogId}` });
              } else if (notification.sender?.id) {
                navigate({ to: `/user/${notification.sender.id}/blog/${blogId}` });
              }
            }
            break;
          case 'amendment':
            if (notification.related_amendment?.id) {
              navigate({ to: `/amendment/${notification.related_amendment.id}` });
            }
            break;
          default:
            break;
        }
      }
    },
    [markNotificationAsRead, navigate]
  );

  const handleToggleNotificationRead = useCallback(
    async (notification: Notification, e?: React.MouseEvent) => {
      e?.preventDefault();
      e?.stopPropagation();
      const wasRead = isNotificationRead(notification);
      const result = setNotificationRead({
        notificationId: notification.id,
        read: !wasRead,
      });
      await waitForClientApply(result);
      try {
        await serverConfirmed(result);
        if (!wasRead) {
          reportAppTutorialAction({
            type: 'mutation',
            event: 'notification.read',
          });
        }
      } catch {
        // Zero rolls the optimistic state back and the checkpoint stays active.
      }
    },
    [setNotificationRead]
  );

  const handleDismissNotification = useCallback(
    async (notificationId: string, e?: React.MouseEvent) => {
      e?.preventDefault();
      e?.stopPropagation();
      const result = dismissNotification({ notificationId });
      await waitForClientApply(result);
      try {
        await serverConfirmed(result);
        toast.success(t('features.notifications.item.hideForMe'), {
          action: {
            label: t('features.notifications.item.restore'),
            onClick: () => restoreNotification({ notificationId }),
          },
        });
      } catch {
        // The low-level hook displays the authoritative server error and Zero rolls back.
      }
    },
    [dismissNotification, restoreNotification, t]
  );

  const handleRestoreNotification = useCallback(
    async (notificationId: string, e?: React.MouseEvent) => {
      e?.preventDefault();
      e?.stopPropagation();
      await waitForClientApply(restoreNotification({ notificationId }));
    },
    [restoreNotification]
  );

  const handlePurgeNotification = useCallback(
    async (notificationId: string, e?: React.MouseEvent) => {
      e?.preventDefault();
      e?.stopPropagation();
      await waitForClientApply(purgeNotificationForUser({ notificationId }));
    },
    [purgeNotificationForUser]
  );

  const handleDeleteEntityNotificationGlobally = useCallback(
    async (notificationId: string) => {
      const result = deleteEntityNotificationGlobally({ notificationId });
      await waitForClientApply(result);
      try {
        await serverConfirmed(result);
      } catch {
        // The low-level action reports the server rejection and Zero rolls back.
      }
    },
    [deleteEntityNotificationGlobally]
  );

  return {
    handleNotificationClick,
    handleMarkNotificationAsRead,
    handleToggleNotificationRead,
    handleDismissNotification,
    handleRestoreNotification,
    handlePurgeNotification,
    handleDeleteEntityNotificationGlobally,
    // Transitional name for callers that still render the old trash icon.
    handleDeleteNotification: handleDismissNotification,
  };
}
