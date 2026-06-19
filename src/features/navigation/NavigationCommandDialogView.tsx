import { Calendar, Users } from 'lucide-react';

import type { UserMenuEvent, UserMenuGroup } from '@/features/navigation/logic/userMenuItems';
import { BadgeControl } from '@/features/shared/ui/status';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar.tsx';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/features/shared/ui/ui/command.tsx';
import { getIconComponent } from '@/features/navigation/nav-items/icon-map.tsx';
import { getShortcutForItem } from '@/features/navigation/nav-keyboard/keyboard-navigation.ts';
import type { NavigationItem } from '@/features/navigation/types/navigation.types.tsx';

interface NavigationCommandDialogViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  copy: {
    placeholder: string;
    noResults: string;
    primaryNavigation: string;
    userNavigation: string;
    groups: string;
    events: string;
    eventFallback: string;
  };
  primaryNavItems: NavigationItem[];
  userNavItems: NavigationItem[];
  groupItems: UserMenuGroup[];
  eventItems: UserMenuEvent[];
  onSelectPrimaryItem: (item: NavigationItem) => void;
  onSelectUserItem: (item: NavigationItem) => void;
  onSelectGroupItem: (group: UserMenuGroup) => void;
  onSelectEventItem: (event: UserMenuEvent) => void;
}

function NavigationCommandItem({
  item,
  onSelect,
}: {
  item: NavigationItem;
  onSelect: (item: NavigationItem) => void;
}) {
  const IconComponent = getIconComponent(item.icon);

  return (
    <CommandItem key={item.id} onSelect={() => onSelect(item)}>
      <div className="flex items-center">
        <IconComponent className="mr-2 h-4 w-4" />
        <span>{item.label}</span>
        {item.badge && (
          <BadgeControl className="ml-2" variant="secondary">
            {item.badge}
          </BadgeControl>
        )}
      </div>
      <CommandShortcut>{getShortcutForItem(item.id).display}</CommandShortcut>
    </CommandItem>
  );
}

function NavigationGroupCommandItem({
  group,
  onSelect,
}: {
  group: UserMenuGroup;
  onSelect: (group: UserMenuGroup) => void;
}) {
  return (
    <CommandItem
      key={group.id}
      value={['group', group.name, group.id].filter(Boolean).join(' ')}
      onSelect={() => onSelect(group)}
    >
      <Avatar className="h-6 w-6">
        <AvatarImage src={group.image_url ?? undefined} alt={group.name ?? undefined} />
        <AvatarFallback className="text-xs">
          {group.name?.[0]?.toUpperCase() || <Users className="h-3 w-3" />}
        </AvatarFallback>
      </Avatar>
      <span className="truncate">{group.name}</span>
    </CommandItem>
  );
}

function NavigationEventCommandItem({
  event,
  eventFallback,
  onSelect,
}: {
  event: UserMenuEvent;
  eventFallback: string;
  onSelect: (event: UserMenuEvent) => void;
}) {
  const title = event.title || eventFallback;
  const meta = formatEventMeta(event);

  return (
    <CommandItem
      key={event.key}
      value={['event', title, event.groupName, event.locationName, String(event.start_date)]
        .filter(Boolean)
        .join(' ')}
      onSelect={() => onSelect(event)}
      className="items-start"
    >
      <Calendar className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block truncate">{title}</span>
        {meta ? <span className="text-muted-foreground block truncate text-xs">{meta}</span> : null}
      </span>
    </CommandItem>
  );
}

export function NavigationCommandDialogView({
  open,
  onOpenChange,
  copy,
  primaryNavItems,
  userNavItems,
  groupItems,
  eventItems,
  onSelectPrimaryItem,
  onSelectUserItem,
  onSelectGroupItem,
  onSelectEventItem,
}: NavigationCommandDialogViewProps) {
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder={copy.placeholder} />
      <CommandList>
        <CommandEmpty>{copy.noResults}</CommandEmpty>
        <CommandGroup heading={copy.primaryNavigation}>
          {primaryNavItems.map((item: any) => (
            <NavigationCommandItem key={item.id} item={item} onSelect={onSelectPrimaryItem} />
          ))}
        </CommandGroup>

        {userNavItems.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={copy.userNavigation}>
              {userNavItems.map((item: any) => (
                <NavigationCommandItem key={item.id} item={item} onSelect={onSelectUserItem} />
              ))}
            </CommandGroup>
          </>
        )}

        {groupItems.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={copy.groups}>
              {groupItems.map(group => (
                <NavigationGroupCommandItem
                  key={group.id}
                  group={group}
                  onSelect={onSelectGroupItem}
                />
              ))}
            </CommandGroup>
          </>
        )}

        {eventItems.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={copy.events}>
              {eventItems.map(event => (
                <NavigationEventCommandItem
                  key={event.key}
                  event={event}
                  eventFallback={copy.eventFallback}
                  onSelect={onSelectEventItem}
                />
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}

function formatEventMeta(event: UserMenuEvent) {
  return [formatEventDate(event.start_date), event.groupName, event.locationName]
    .filter(Boolean)
    .join(' - ');
}

function formatEventDate(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
