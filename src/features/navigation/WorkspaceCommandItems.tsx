import { useRef, useState } from 'react';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { Star, Plus } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/zero/rbac';
import { useWorkspacePreferences } from '@/zero/preferences/useWorkspacePreferences';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import {
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from '@/features/shared/ui/ui/command';
import { toast } from '@/features/shared/ui/ui/sonner';
import { usePreloadCoordinator } from '@/zero/preloads';
import { availableWorkspaceCommands, type WorkspaceCommand } from './logic/workspaceCommands';
import type { UserMenuGroup, UserMenuEvent, UserMenuAmendment } from './logic/userMenuItems';

export function WorkspaceCommandItems(props: {
  groups: UserMenuGroup[];
  events: UserMenuEvent[];
  amendments: UserMenuAmendment[];
  onComplete: () => void;
}) {
  const { user } = useAuth();
  return user ? <AuthenticatedWorkspaceCommands {...props} /> : null;
}

function AuthenticatedWorkspaceCommands({
  groups,
  events,
  amendments,
  onComplete,
}: {
  groups: UserMenuGroup[];
  events: UserMenuEvent[];
  amendments: UserMenuAmendment[];
  onComplete: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useRouterState({ select: state => state.location });
  const { favorites, setFavorite, isLoading } = useWorkspacePreferences();
  const preload = usePreloadCoordinator();
  const saving = useRef(false);
  const [pending, setPending] = useState(false);
  const groupId = /^\/group\/([^/]+)/.exec(location.pathname)?.[1];
  const eventId = /^\/event\/([^/]+)/.exec(location.pathname)?.[1];
  const amendmentId = /^\/amendment\/([^/]+)/.exec(location.pathname)?.[1];
  const { can } = usePermissions({ groupId, eventId });
  const group = groups.find(row => row.id === groupId);
  const event = events.find(row => row.id === eventId);
  const amendment = amendments.find(row => row.id === amendmentId);
  const commands: WorkspaceCommand[] = [];
  const addCreate = (kind: string, href: string, available: boolean, context?: string | null) => {
    commands.push({
      id: `create-${kind}`,
      label: `${t(`common.workspace.create.${kind}`)}${context ? ` · ${context}` : ''}`,
      group: 'context',
      available,
      shortcut: '↵',
      href,
      handler: () => {
        void navigate({ to: href });
        onComplete();
      },
    });
  };
  addCreate(
    'todo',
    groupId
      ? `/create/todo?groupId=${encodeURIComponent(groupId)}&returnSection=todos`
      : '/create/todo',
    !groupId || can('create', 'groupTodos'),
    group?.name
  );
  if (groupId) {
    addCreate(
      'amendment',
      `/create/amendment?groupId=${encodeURIComponent(groupId)}`,
      can('create', 'amendments'),
      group?.name
    );
    addCreate(
      'event',
      `/create/event?groupId=${encodeURIComponent(groupId)}`,
      can('create', 'events'),
      group?.name
    );
  }
  if (eventId)
    addCreate(
      'agendaItem',
      `/create/agenda-item?eventId=${encodeURIComponent(eventId)}`,
      can('create', 'agendaItems'),
      event?.title
    );
  const current = group
    ? {
        kind: 'group' as const,
        href: `/group/${group.id}`,
        title: group.name || t('common.entities.group'),
      }
    : event
      ? {
          kind: 'event' as const,
          href: `/event/${event.id}`,
          title: event.title || t('common.entities.event'),
        }
      : amendment
        ? {
            kind: 'amendment' as const,
            href: `/amendment/${amendment.id}`,
            title: amendment.title || t('common.entities.amendment'),
          }
        : location.pathname === '/search'
          ? {
              kind: 'view' as const,
              href: `/search${location.searchStr}`,
              title: `${t('features.search.title')}${location.search.q ? ` · ${String(location.search.q)}` : ''}`,
            }
          : null;
  if (current) {
    const active = favorites.some(row => row.href === current.href);
    commands.push({
      id: 'favorite-current',
      label: t(
        active
          ? 'common.workspace.unfavorite'
          : current.kind === 'view'
            ? 'common.workspace.saveView'
            : 'common.workspace.favorite'
      ),
      group: 'context',
      available: !isLoading,
      shortcut: '↵',
      handler: () => {
        if (saving.current) return;
        saving.current = true;
        setPending(true);
        void setFavorite(current, !active)
          .then(onComplete)
          .catch(() => toast.error(t('common.workspace.saveFailed')))
          .finally(() => {
            saving.current = false;
            setPending(false);
          });
      },
    });
  }
  favorites.forEach(favorite =>
    commands.push({
      id: `favorite-${favorite.href}`,
      label: favorite.title,
      group: 'favorites',
      available: true,
      href: favorite.href,
      shortcut: '↵',
      handler: () => {
        void navigate({ to: favorite.href });
        onComplete();
      },
    })
  );
  const available = availableWorkspaceCommands(commands);
  return (
    <>
      {(['context', 'favorites'] as const).map(section => {
        const items = available.filter(command => command.group === section);
        if (!items.length) return null;
        return (
          <CommandGroup
            key={section}
            heading={t(
              section === 'favorites'
                ? 'common.workspace.favorites'
                : 'common.workspace.currentActions'
            )}
          >
            {items.map(command => (
              <CommandItem
                key={command.id}
                value={`${command.label} ${command.id}`}
                disabled={pending}
                onSelect={command.handler}
                onMouseEnter={() => command.href && preload?.beginIntent(command.href)}
                onMouseLeave={() => command.href && preload?.cancelIntent(command.href)}
                onFocus={() => command.href && preload?.beginIntent(command.href)}
                onBlur={() => command.href && preload?.cancelIntent(command.href)}
              >
                {section === 'favorites' ? (
                  <Star className="size-4" />
                ) : (
                  <Plus className="size-4" />
                )}
                <span className="truncate">{command.label}</span>
                <CommandShortcut>{command.shortcut}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        );
      })}
      <CommandSeparator />
    </>
  );
}
