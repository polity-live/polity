import type { MouseEvent } from 'react';
import {
  featureThemeClassName,
  getSemanticToneClasses,
  type SemanticTone,
} from '@/features/shared/theme';
import { BadgeControl } from '@/features/shared/ui/status';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { Button } from '@/features/shared/ui/ui/button';
import { Card, CardContent } from '@/features/shared/ui/ui/card';
import { LinkSurface } from '@/features/shared/ui/navigation/LinkSurface.tsx';
import { SmartLink, isPlainLeftClick } from '@/features/shared/ui/navigation/SmartLink.tsx';
import { Mail, MailOpen, RotateCcw, Trash2, Users } from 'lucide-react';
import { cn } from '@/features/shared/utils/utils';
import type { Notification, NotificationType } from '../types/notification.types';
import { getNotificationIcon } from '../utils/notificationConstants';
import {
  formatTime as formatNotificationTime,
  getDisplayName,
  getNotificationNavigationHref,
  isNotificationRead,
} from '../logic/notificationHelpers';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import {
  ENTITY_COLORS,
  type EntityType as EntityColorType,
} from '@/features/shared/utils/entity-colors';
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

type NotificationEntity =
  | NonNullable<Notification['recipient_group']>
  | NonNullable<Notification['recipient_event']>
  | NonNullable<Notification['recipient_amendment']>
  | NonNullable<Notification['recipient_blog']>
  | NonNullable<Notification['on_behalf_of_group']>
  | NonNullable<Notification['on_behalf_of_event']>
  | NonNullable<Notification['on_behalf_of_amendment']>
  | NonNullable<Notification['on_behalf_of_blog']>;

interface NotificationItemProps {
  notification: Notification;
  onNotificationClick: (notification: Notification) => void | Promise<void>;
  onMarkAsRead?: (notification: Notification, e: MouseEvent) => void | Promise<void>;
  onToggleRead?: (notification: Notification, e: MouseEvent) => void | Promise<void>;
  onDeleteNotification?: (notificationId: string, e: MouseEvent) => void | Promise<void>;
  onRestoreNotification?: (notificationId: string, e: MouseEvent) => void | Promise<void>;
  onPurgeNotification?: (notificationId: string, e: MouseEvent) => void | Promise<void>;
  onDeleteForEveryone?: (notificationId: string) => void | Promise<void>;
  canDeleteForEveryone?: boolean;
  formatTime?: (date: string | number) => string;
  mode?: 'global' | 'entity' | 'trash';
  showRecipientBadge?: boolean;
}

function getEntityLabel(entity: NotificationEntity | null | undefined) {
  if (!entity) {
    return translateText('generated.inline.0119_entity_c7fb3177');
  }

  if ('name' in entity && entity.name) {
    return entity.name;
  }

  if ('title' in entity && entity.title) {
    return entity.title;
  }

  return translateText('generated.inline.0119_entity_c7fb3177');
}

function getEntityInitial(entity: NotificationEntity | null | undefined) {
  return getEntityLabel(entity)[0]?.toUpperCase() || 'E';
}

function getEntityImage(entity: NotificationEntity | null | undefined) {
  return entity && 'image_url' in entity ? entity.image_url : undefined;
}

function getEntityHref(notification: Notification, entity: NotificationEntity | null) {
  if (!entity?.id) {
    return null;
  }

  if (entity === notification.recipient_group || entity === notification.on_behalf_of_group) {
    return `/group/${entity.id}`;
  }

  if (entity === notification.recipient_event || entity === notification.on_behalf_of_event) {
    return `/event/${entity.id}`;
  }

  if (
    entity === notification.recipient_amendment ||
    entity === notification.on_behalf_of_amendment
  ) {
    return `/amendment/${entity.id}`;
  }

  if (entity === notification.recipient_blog || entity === notification.on_behalf_of_blog) {
    return `/blog/${entity.id}`;
  }

  return null;
}

function getRecipientEntity(notification: Notification) {
  return (
    notification.recipient_group ||
    notification.recipient_event ||
    notification.recipient_amendment ||
    notification.recipient_blog ||
    null
  );
}

function getOnBehalfEntity(notification: Notification) {
  return (
    notification.on_behalf_of_group ||
    notification.on_behalf_of_event ||
    notification.on_behalf_of_amendment ||
    notification.on_behalf_of_blog ||
    null
  );
}

function getEntityType(notification: Notification): EntityColorType | null {
  if (notification.recipient_group || notification.on_behalf_of_group) return 'group';
  if (notification.recipient_event || notification.on_behalf_of_event) return 'event';
  if (notification.recipient_amendment || notification.on_behalf_of_amendment) return 'amendment';
  if (notification.recipient_blog || notification.on_behalf_of_blog) return 'blog';
  return null;
}

function getNotificationTone(type: NotificationType): SemanticTone {
  if (type.includes('rejected') || type.includes('declined') || type.includes('removed')) {
    return 'danger';
  }

  if (type.includes('deleted') || type.includes('cancelled') || type.includes('failed')) {
    return 'danger';
  }

  if (type.includes('approved') || type.includes('accepted') || type.includes('confirmed')) {
    return 'success';
  }

  if (type.includes('completed') || type.includes('succeeded') || type.includes('promoted')) {
    return 'success';
  }

  if (type.includes('required') || type.includes('due_soon') || type.includes('ending_soon')) {
    return 'warning';
  }

  if (type.includes('overdue') || type.includes('recalculation')) {
    return 'warning';
  }

  if (type.includes('vote') || type.includes('election')) {
    return 'accent';
  }

  if (type.includes('request') || type.includes('invite') || type.includes('assigned')) {
    return 'info';
  }

  return 'neutral';
}

function UserMeta({
  user,
  linkAfterName = false,
}: {
  user: Notification['sender'] | Notification['related_user'];
  linkAfterName?: boolean;
}) {
  if (!user) {
    return null;
  }

  const userName = getDisplayName(user);
  const avatar = (
    <Avatar className="h-5 w-5 shrink-0">
      <AvatarImage src={user.avatar ?? undefined} />
      <AvatarFallback className={featureThemeClassName('agendaAccreditationSectionThemedText')}>
        {userName[0]?.toUpperCase() || 'U'}
      </AvatarFallback>
    </Avatar>
  );
  const name = user.id ? (
    <SmartLink
      href={`/user/${user.id}`}
      className="hover:text-primary truncate font-medium hover:underline"
    >
      {userName}
    </SmartLink>
  ) : (
    <span className="truncate font-medium">{userName}</span>
  );

  if (!user.id) {
    return linkAfterName ? (
      <>
        {name}
        {avatar}
      </>
    ) : (
      <>
        {avatar}
        {name}
      </>
    );
  }

  const linkedAvatar = (
    <SmartLink href={`/user/${user.id}`} className="shrink-0">
      <Avatar className="hover:ring-primary h-5 w-5 hover:ring-1">
        <AvatarImage src={user.avatar ?? undefined} />
        <AvatarFallback className={featureThemeClassName('agendaAccreditationSectionThemedText')}>
          {userName[0]?.toUpperCase() || 'U'}
        </AvatarFallback>
      </Avatar>
    </SmartLink>
  );

  return linkAfterName ? (
    <>
      {name}
      {linkedAvatar}
    </>
  ) : (
    <>
      {linkedAvatar}
      {name}
    </>
  );
}

function EntityMeta({
  notification,
  entity,
}: {
  notification: Notification;
  entity: NotificationEntity;
}) {
  const href = getEntityHref(notification, entity);
  const label = getEntityLabel(entity);
  const avatar = (
    <Avatar className="h-5 w-5 shrink-0">
      <AvatarImage src={getEntityImage(entity) ?? undefined} />
      <AvatarFallback
        className={featureThemeClassName('notificationNotificationItemInfoContrastBackground')}
      >
        {getEntityInitial(entity)}
      </AvatarFallback>
    </Avatar>
  );

  return (
    <>
      {href ? (
        <SmartLink href={href} className="shrink-0">
          {avatar}
        </SmartLink>
      ) : (
        avatar
      )}
      {href ? (
        <SmartLink href={href} className="hover:text-primary truncate font-medium hover:underline">
          {label}
        </SmartLink>
      ) : (
        <span className="truncate font-medium">{label}</span>
      )}
    </>
  );
}

export function NotificationItem({
  notification,
  onNotificationClick,
  onMarkAsRead,
  onToggleRead,
  onDeleteNotification,
  onRestoreNotification,
  onPurgeNotification,
  onDeleteForEveryone,
  canDeleteForEveryone = false,
  formatTime = formatNotificationTime,
  mode = 'global',
  showRecipientBadge = true,
}: NotificationItemProps) {
  const { t } = useTranslation();
  const Icon = getNotificationIcon(notification.type as NotificationType);
  const iconTone = getSemanticToneClasses(
    getNotificationTone(notification.type as NotificationType)
  );
  const notificationHref = getNotificationNavigationHref(notification);
  const recipientEntity = getRecipientEntity(notification);
  const onBehalfEntity = getOnBehalfEntity(notification);
  const entityType = getEntityType(notification);
  const entityColors = entityType ? ENTITY_COLORS[entityType] : null;
  const hasEntityContext = Boolean(recipientEntity || onBehalfEntity);
  const hasRelatedUser = Boolean(notification.related_user);
  const isRead = isNotificationRead(notification);
  const message = notification.message?.replaceAll(
    '{{paymentDescription}}',
    t('common.creationFinalization.entities.payment')
  );
  const showDeleteForEveryone =
    mode !== 'trash' && Boolean(onDeleteForEveryone) && canDeleteForEveryone;

  const cardContent = (
    <CardContent className="flex items-start gap-3 p-3">
      <div className={cn('mt-0.5 rounded-full border p-1.5', iconTone.surface)}>
        <Icon className="h-3.5 w-3.5" />
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        {notification.sender || notification.related_user || onBehalfEntity ? (
          <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <UserMeta user={notification.sender} />
            {notification.sender && onBehalfEntity ? (
              <span className="shrink-0">{t('features.notifications.item.for')}</span>
            ) : null}
            {onBehalfEntity ? (
              <EntityMeta notification={notification} entity={onBehalfEntity} />
            ) : null}
            {(notification.sender || onBehalfEntity) && hasRelatedUser ? (
              <span className="shrink-0">-&gt;</span>
            ) : null}
            {hasRelatedUser ? <UserMeta user={notification.related_user} linkAfterName /> : null}
          </div>
        ) : null}

        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-1">
            <p className={cn('text-sm font-medium', !isRead && 'font-semibold')}>
              {notification.title}
            </p>
            {showRecipientBadge && hasEntityContext && (recipientEntity || onBehalfEntity) ? (
              <BadgeControl
                variant="outline"
                className={cn('w-fit max-w-full truncate', entityColors?.badgeBg)}
              >
                <Users className="mr-1 h-3 w-3 shrink-0" />
                <span className="truncate">
                  {getEntityLabel(recipientEntity || onBehalfEntity)}
                </span>
              </BadgeControl>
            ) : null}
          </div>
          {!isRead ? (
            <BadgeControl
              tone="success"
              size="xs"
              shape="rounded"
              textStyle="mono"
              textTransform="uppercase"
              className="font-bold tracking-wide shadow-sm"
            >
              {t('features.notifications.item.new')}
            </BadgeControl>
          ) : null}
        </div>

        <p className="text-muted-foreground text-sm">{message}</p>
        <div className="flex items-center justify-between gap-3">
          <p className="text-muted-foreground text-xs">{formatTime(notification.created_at)}</p>
          <div className="flex items-center gap-1">
            {mode !== 'trash' && (onToggleRead || (!isRead && onMarkAsRead)) ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                aria-label={t(
                  isRead
                    ? 'features.notifications.item.markUnread'
                    : 'features.notifications.actions.markRead'
                )}
                title={t(
                  isRead
                    ? 'features.notifications.item.markUnread'
                    : 'features.notifications.actions.markRead'
                )}
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  void (onToggleRead ?? onMarkAsRead)?.(notification, e);
                }}
              >
                {isRead ? <Mail className="h-3.5 w-3.5" /> : <MailOpen className="h-3.5 w-3.5" />}
              </Button>
            ) : null}
            {mode === 'trash' && onRestoreNotification ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                aria-label={t('features.notifications.item.restore')}
                title={t('features.notifications.item.restore')}
                onClick={e => void onRestoreNotification(notification.id, e)}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            ) : null}
            {mode === 'trash' && onPurgeNotification ? (
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive h-6 w-6 shrink-0"
                aria-label={t('features.notifications.item.removePermanently')}
                title={t('features.notifications.item.removePermanently')}
                onClick={e => void onPurgeNotification(notification.id, e)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            ) : null}
            {mode !== 'trash' && onDeleteNotification ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                aria-label={t('features.notifications.item.hideForMe')}
                title={t('features.notifications.item.hideForMe')}
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  void onDeleteNotification(notification.id, e);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            ) : null}
            {showDeleteForEveryone ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive h-6 w-6 shrink-0"
                    aria-label={t('features.notifications.item.deleteForEveryone')}
                    title={t('features.notifications.item.deleteForEveryone')}
                    onClick={e => {
                      e.stopPropagation();
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {t('features.notifications.globalDelete.title')}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('features.notifications.globalDelete.description', {
                        entity: getEntityLabel(recipientEntity),
                      })}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('common.actions.cancel')}</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => void onDeleteForEveryone?.(notification.id)}
                    >
                      {t('features.notifications.item.deleteForEveryone')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
          </div>
        </div>
      </div>
    </CardContent>
  );

  const cardClassName = cn(
    'bg-card border-border/70 cursor-pointer rounded-md shadow-[var(--shadow-panel)] transition-shadow hover:shadow-md'
  );

  if (notificationHref) {
    return (
      <Card data-slot="notification-card" data-mode={mode} className={cardClassName}>
        <LinkSurface
          href={notificationHref}
          mode="overlay"
          label={notification.title ?? 'Notification'}
          onClick={event => {
            if (!isPlainLeftClick(event)) {
              return;
            }

            event.preventDefault();
            void onNotificationClick(notification);
          }}
        >
          {cardContent}
        </LinkSurface>
      </Card>
    );
  }

  return (
    <Card
      data-slot="notification-card"
      data-mode={mode}
      className={cardClassName}
      onClick={() => void onNotificationClick(notification)}
    >
      {cardContent}
    </Card>
  );
}
