import type { DropdownMenuProps } from '@radix-ui/react-dropdown-menu';

import { useTurnIntoToolbarButtonController } from '@/features/shared/hooks/useTurnIntoToolbarButtonController';

import { TurnIntoToolbarButtonView } from './TurnIntoToolbarButtonView';

export function TurnIntoToolbarButton(props: DropdownMenuProps) {
  const controller = useTurnIntoToolbarButtonController();

  return <TurnIntoToolbarButtonView dropdownProps={props} {...controller} />;
}
