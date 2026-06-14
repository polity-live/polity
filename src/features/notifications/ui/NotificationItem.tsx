import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { Button } from '@/features/shared/ui/ui/button';
import { Card, CardContent } from '@/features/shared/ui/ui/card';
import { Badge } from '@/features/shared/ui/ui/badge';
import { LinkSurface } from '@/features/shared/ui/navigation/LinkSurface.tsx';
import { SmartLink, isPlainLeftClick } from '@/features/shared/ui/navigation/SmartLink.tsx';
import { Users, X } from 'lucide-react';
import { cn } from '@/features/shared/utils/utils';
import { Notification, NotificationType } from '../types/notification.types';
import { getNotificationIcon, getNotificationColor } from '../utils/notificationConstants';
import {
  formatTime,
  getDisplayName,
  getNotificationNavigationHref,
} from '../logic/notificationHelpers';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import {
  ENTITY_COLORS,
  type EntityType as EntityColorType,
} from '@/features/shared/utils/entity-colors';

interface NotificationItemProps {
  notification: Notification;
  onNotificationClick: (notification: Notification) => void;
  onDeleteNotification: (notificationId: string, e: React.MouseEvent) => void;
}

export function NotificationItem({
  notification,
  onNotificationClick,
  onDeleteNotification,
}: NotificationItemProps) {
  const { t } = useTranslation();
  const Icon = getNotificationIcon(notification.type as NotificationType);
  const iconColor = getNotificationColor(notification.type as NotificationType);
  const notificationHref = getNotificationNavigationHref(notification);

  // Determine if this is a personal or entity notification
  const recipientEntity =
    notification.recipient_group ||
    notification.recipient_event ||
    notification.recipient_amendment ||
    notification.recipient_blog ||
    notification.on_behalf_of_group ||
    notification.on_behalf_of_event ||
    notification.on_behalf_of_amendment ||
    notification.on_behalf_of_blog;

  const isEntityNotification = !!recipientEntity;

  // Determine entity type for color coding
  const entityType: EntityColorType | null = notification.recipient_group
    ? 'group'
    : notification.recipient_event
      ? 'event'
      : notification.recipient_amendment
        ? 'amendment'
        : notification.recipient_blog
          ? 'blog'
          : notification.on_behalf_of_group
            ? 'group'
            : notification.on_behalf_of_event
              ? 'event'
              : notification.on_behalf_of_amendment
                ? 'amendment'
                : notification.on_behalf_of_blog
                  ? 'blog'
                  : null;

  const entityColors = entityType ? ENTITY_COLORS[entityType] : null;

  // Get entity sent on behalf of
  const onBehalfEntity =
    notification.on_behalf_of_group ||
    notification.on_behalf_of_event ||
    notification.on_behalf_of_amendment ||
    notification.on_behalf_of_blog;
  const onBehalfEntityHref = onBehalfEntity
    ? notification.on_behalf_of_group
      ? `/group/${notification.on_behalf_of_group.id}`
      : notification.on_behalf_of_event
        ? `/event/${notification.on_behalf_of_event.id}`
        : notification.on_behalf_of_amendment
          ? `/amendment/${notification.on_behalf_of_amendment.id}`
          : `/blog/${notification.on_behalf_of_blog?.id}`
    : null;

  const cardContent = (
    <CardContent className="flex items-start gap-3 p-3">
      {/* Notification Icon */}
      <div
        className={cn(
          'bg-muted mt-0.5 rounded-full p-1.5',
          !notification.is_read && 'bg-primary/10'
        )}
      >
        <Icon className={cn('h-3.5 w-3.5', iconColor)} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 space-y-0.5">
        {/* Sender + On-behalf-of entity line */}
        {(notification.sender || onBehalfEntity) && (
          <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
            {notification.sender && (
              <>
                {notification.sender.id ? (
                  <SmartLink href={`/user/${notification.sender.id}`} className="shrink-0">
                    <Avatar className="hover:ring-primary h-5 w-5 hover:ring-1">
                      <AvatarImage src={notification.sender.avatar ?? undefined} />
                      <AvatarFallback className="text-[10px]">
                        {getDisplayName(notification.sender)?.[0]?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </SmartLink>
                ) : (
                  <Avatar className="h-5 w-5 shrink-0">
                    <AvatarImage src={notification.sender.avatar ?? undefined} />
                    <AvatarFallback className="text-[10px]">
                      {getDisplayName(notification.sender)?.[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                )}
                {notification.sender.id ? (
                  <SmartLink
                    href={`/user/${notification.sender.id}`}
                    className="hover:text-primary truncate font-medium hover:underline"
                  >
                    {getDisplayName(notification.sender)}
                  </SmartLink>
                ) : (
                  <span className="truncate font-medium">
                    {getDisplayName(notification.sender)}
                  </span>
                )}
              </>
            )}
            {notification.sender && onBehalfEntity && (
              <span className="shrink-0">{t('features.notifications.item.for')}</span>
            )}
            {onBehalfEntity && (
              <>
                {onBehalfEntityHref ? (
                  <SmartLink href={onBehalfEntityHref} className="shrink-0">
                    <Avatar className="h-5 w-5 hover:ring-1 hover:ring-blue-500">
                      <AvatarImage src={onBehalfEntity.image_url ?? undefined} />
                      <AvatarFallback className="bg-blue-500 text-[10px] text-white">
                        {('name' in onBehalfEntity
                          ? onBehalfEntity.name?.[0]
                          : 'title' in onBehalfEntity
                            ? onBehalfEntity.title?.[0]
                            : ''
                        )?.toUpperCase() || 'E'}
                      </AvatarFallback>
                    </Avatar>
                  </SmartLink>
                ) : (
                  <Avatar className="h-5 w-5 shrink-0">
                    <AvatarImage src={onBehalfEntity.image_url ?? undefined} />
                    <AvatarFallback className="bg-blue-500 text-[10px] text-white">
                      {('name' in onBehalfEntity
                        ? onBehalfEntity.name?.[0]
                        : 'title' in onBehalfEntity
                          ? onBehalfEntity.title?.[0]
                          : ''
                      )?.toUpperCase() || 'E'}
                    </AvatarFallback>
                  </Avatar>
                )}
                {onBehalfEntityHref ? (
                  <SmartLink
                    href={onBehalfEntityHref}
                    className="hover:text-primary truncate font-medium hover:underline"
                  >
                    {'name' in onBehalfEntity
                      ? onBehalfEntity.name
                      : 'title' in onBehalfEntity
                        ? onBehalfEntity.title
                        : translateText('generated.inline.0119_entity_c7fb3177')}
                  </SmartLink>
                ) : (
                  <span className="truncate font-medium">
                    {'name' in onBehalfEntity
                      ? onBehalfEntity.name
                      : 'title' in onBehalfEntity
                        ? onBehalfEntity.title
                        : translateText('generated.inline.0119_entity_c7fb3177')}
                  </span>
                )}
              </>
            )}
          </div>
        )}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <p className={cn('text-sm font-medium', !notification.is_read && 'font-semibold')}>
              {notification.title}
            </p>
            {isEntityNotification && recipientEntity && (
              <Badge variant="outline" className={cn('w-fit', entityColors?.badgeBg)}>
                <Users className="mr-1 h-3 w-3" />
                {'name' in recipientEntity
                  ? recipientEntity.name
                  : 'title' in recipientEntity
                    ? recipientEntity.title
                    : translateText('generated.inline.0119_entity_c7fb3177')}{' '}
                {t('features.notifications.item.notification')}
              </Badge>
            )}
          </div>
          {!notification.is_read && (
            <Badge variant="default" className="h-2 w-2 rounded-full p-0" />
          )}
        </div>
        <p className="text-muted-foreground text-sm">{notification.message}</p>
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-xs">{formatTime(notification.created_at)}</p>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={e => onDeleteNotification(notification.id, e)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </CardContent>
  );

  const cardClassName = cn(
    'cursor-pointer transition-all hover:shadow-md',
    !notification.is_read && 'border-l-primary bg-accent/50 border-l-4',
    isEntityNotification && entityColors && `border-l-4 ${entityColors.notificationBorderLeft}`
  );

  if (notificationHref) {
    return (
      <Card className={cardClassName}>
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
    <Card className={cardClassName} onClick={() => onNotificationClick(notification)}>
      {cardContent}
    </Card>
  );
}
