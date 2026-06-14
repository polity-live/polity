import type { DropdownMenuProps } from '@radix-ui/react-dropdown-menu';

import { useImportToolbarButtonController } from '@/features/shared/hooks/useImportToolbarButtonController';
import { ImportToolbarButtonView } from './ImportToolbarButtonView';

export function ImportToolbarButton(props: DropdownMenuProps) {
  return <ImportToolbarButtonView dropdownProps={props} {...useImportToolbarButtonController()} />;
}
