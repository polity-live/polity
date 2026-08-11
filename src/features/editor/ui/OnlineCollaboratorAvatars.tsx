'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { featureThemeClassName } from '@/features/shared/theme';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { SmartLink } from '@/features/shared/ui/navigation/SmartLink.tsx';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { Button } from '@/features/shared/ui/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/features/shared/ui/ui/popover';
import { cn } from '@/features/shared/utils/utils';
import { translate } from '@/features/shared/hooks/use-translation';

import { generateUserColor } from '../logic/editor-helpers';
import type { EditorCollaborator, EditorPresencePeer, EditorUser } from '../types';

interface OnlineCollaboratorAvatarsProps {
  collaborators: EditorCollaborator[];
  onlinePeerMap: Map<string, EditorPresencePeer>;
  activeCursorUserIds: Set<string>;
  currentUserId?: string;
  presenceColorByUserId?: Map<string, string>;
  enabled?: boolean;
  className?: string;
}

function getDisplayName(user: EditorUser) {
  return (
    user.name ||
    [user.firstName, user.lastName].filter(Boolean).join(' ') ||
    translate('common.unknownUser')
  );
}

function getInitials(user: EditorUser) {
  const nameParts = [user.firstName, user.lastName].filter((part): part is string =>
    Boolean(part?.trim())
  );

  if (nameParts.length >= 2) {
    return `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase();
  }

  const fallback = nameParts[0] || getDisplayName(user);
  const fallbackParts = fallback.split(/\s+/).filter(Boolean);

  if (fallbackParts.length >= 2) {
    return `${fallbackParts[0][0]}${fallbackParts[1][0]}`.toUpperCase();
  }

  return fallback.replace(/\s+/g, '').slice(0, 2).toUpperCase() || '?';
}

function isCollaboratorOnline(
  collaborator: EditorCollaborator,
  onlinePeerMap: Map<string, EditorPresencePeer>,
  activeCursorUserIds: Set<string>,
  currentUserId?: string
) {
  const collaboratorUserId = collaborator.user.id;

  return (
    onlinePeerMap.has(collaboratorUserId) ||
    activeCursorUserIds.has(collaboratorUserId) ||
    collaboratorUserId === currentUserId
  );
}

export function OnlineCollaboratorAvatars({
  collaborators,
  onlinePeerMap,
  activeCursorUserIds,
  currentUserId,
  presenceColorByUserId,
  enabled = true,
  className,
}: OnlineCollaboratorAvatarsProps) {
  const { t } = useTranslation();
  const [openUserId, setOpenUserId] = useState<string | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    },
    []
  );

  const onlineCollaborators = useMemo(
    () =>
      enabled
        ? collaborators.filter(collaborator =>
            isCollaboratorOnline(collaborator, onlinePeerMap, activeCursorUserIds, currentUserId)
          )
        : [],
    [activeCursorUserIds, collaborators, currentUserId, enabled, onlinePeerMap]
  );

  if (onlineCollaborators.length === 0) {
    return null;
  }

  const clearCloseTimeout = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  const scheduleClose = () => {
    clearCloseTimeout();
    closeTimeoutRef.current = setTimeout(() => setOpenUserId(null), 120);
  };

  return (
    <div className={cn('flex items-center -space-x-1.5', className)}>
      {onlineCollaborators.map(collaborator => {
        const { user } = collaborator;
        const displayName = getDisplayName(user);
        const initials = getInitials(user);
        const userColor =
          presenceColorByUserId?.get(user.id) ??
          onlinePeerMap.get(user.id)?.color ??
          generateUserColor(user.id);
        const isOpen = openUserId === user.id;

        return (
          <Popover
            key={collaborator.id}
            open={isOpen}
            onOpenChange={open => setOpenUserId(open ? user.id : null)}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                data-action-id="editor.presence.collaborator.open"
                aria-label={displayName}
                className="focus-visible:ring-ring focus-visible:ring-offset-background relative rounded-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                onClick={() =>
                  setOpenUserId(currentOpenUserId =>
                    currentOpenUserId === user.id ? null : user.id
                  )
                }
                onFocus={() => setOpenUserId(user.id)}
                onMouseEnter={() => {
                  clearCloseTimeout();
                  setOpenUserId(user.id);
                }}
                onMouseLeave={scheduleClose}
              >
                <Avatar
                  className="border-background h-8 w-8 rounded-md border-2 shadow-sm"
                  style={{ borderColor: userColor }}
                >
                  {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={displayName} /> : null}
                  <AvatarFallback
                    className={cn(
                      'rounded-md text-xs font-semibold',
                      featureThemeClassName('documentPresenceIndicatorsContrastText')
                    )}
                    style={{ backgroundColor: userColor }}
                  >
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span
                  aria-hidden="true"
                  className="ring-background absolute -right-0.5 -bottom-0.5 block h-2.5 w-2.5 rounded-full ring-1"
                  style={{ backgroundColor: userColor }}
                />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-64 p-3"
              onMouseEnter={clearCloseTimeout}
              onMouseLeave={scheduleClose}
            >
              <div className="flex items-start gap-3">
                <Avatar
                  className="h-12 w-12 rounded-lg border-2"
                  style={{ borderColor: userColor }}
                >
                  {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={displayName} /> : null}
                  <AvatarFallback
                    className={cn(
                      'rounded-lg text-sm font-semibold',
                      featureThemeClassName('documentPresenceIndicatorsContrastText')
                    )}
                    style={{ backgroundColor: userColor }}
                  >
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{displayName}</p>
                    <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-xs">
                      <dt className="text-muted-foreground">
                        {t('features.editor.collaborators.firstName')}
                      </dt>
                      <dd className="truncate">{user.firstName || '-'}</dd>
                      <dt className="text-muted-foreground">
                        {t('features.editor.collaborators.lastName')}
                      </dt>
                      <dd className="truncate">{user.lastName || '-'}</dd>
                    </dl>
                  </div>
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="h-8 w-full"
                    data-action-id="editor.presence.profile.open"
                  >
                    <SmartLink
                      href={`/user/${user.id}`}
                      resetScroll={false}
                      data-action-id="editor.presence.profile.open"
                    >
                      {t('features.editor.collaborators.openProfile')}
                    </SmartLink>
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        );
      })}
    </div>
  );
}
