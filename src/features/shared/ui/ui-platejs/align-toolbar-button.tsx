import type { DropdownMenuProps } from '@radix-ui/react-dropdown-menu';

import { useAlignToolbarButtonController } from '@/features/shared/hooks/useAlignToolbarButtonController';
import { AlignToolbarButtonView } from './AlignToolbarButtonView';

export function AlignToolbarButton(props: DropdownMenuProps) {
  return <AlignToolbarButtonView dropdownProps={props} {...useAlignToolbarButtonController()} />;
}
