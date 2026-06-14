import { BadgeControl } from '@/features/shared/ui/status';
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
  };
  primaryNavItems: NavigationItem[];
  userNavItems: NavigationItem[];
  onSelectPrimaryItem: (item: NavigationItem) => void;
  onSelectUserItem: (item: NavigationItem) => void;
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

export function NavigationCommandDialogView({
  open,
  onOpenChange,
  copy,
  primaryNavItems,
  userNavItems,
  onSelectPrimaryItem,
  onSelectUserItem,
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
      </CommandList>
    </CommandDialog>
  );
}
