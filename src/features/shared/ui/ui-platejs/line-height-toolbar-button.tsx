import type { DropdownMenuProps } from '@radix-ui/react-dropdown-menu';

import { useLineHeightToolbarButtonController } from '@/features/shared/hooks/useLineHeightToolbarButtonController';
import { LineHeightToolbarButtonView } from './LineHeightToolbarButtonView';

export function LineHeightToolbarButton(props: DropdownMenuProps) {
  return (
    <LineHeightToolbarButtonView
      dropdownProps={props}
      {...useLineHeightToolbarButtonController()}
    />
  );
}
