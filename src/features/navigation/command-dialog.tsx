import { memo } from 'react';
import { useNavigationCommandDialogController } from '@/features/navigation/hooks/useNavigationCommandDialogController';
import type { NavigationItem } from '@/features/navigation/types/navigation.types.tsx';
import { NavigationCommandDialogView } from './NavigationCommandDialogView';

export const NavigationCommandDialog = memo(function NavigationCommandDialog({
  primaryNavItems,
  secondaryNavItems,
}: {
  primaryNavItems: NavigationItem[];
  secondaryNavItems: NavigationItem[] | null;
}) {
  const viewProps = useNavigationCommandDialogController({ primaryNavItems, secondaryNavItems });
  return (
    <NavigationCommandDialogView
      {...viewProps}
      primaryNavItems={primaryNavItems}
      onOpenChange={viewProps.setOpen}
    />
  );
});
