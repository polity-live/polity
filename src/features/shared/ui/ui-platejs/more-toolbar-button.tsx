import type { DropdownMenuProps } from '@radix-ui/react-dropdown-menu';

import { useMoreToolbarButtonController } from '@/features/shared/hooks/useMoreToolbarButtonController';
import { MoreToolbarButtonView } from './MoreToolbarButtonView';

export function MoreToolbarButton(props: DropdownMenuProps) {
  return <MoreToolbarButtonView dropdownProps={props} {...useMoreToolbarButtonController()} />;
}
