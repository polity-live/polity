import type { DropdownMenuProps } from '@radix-ui/react-dropdown-menu';

import { useExportToolbarButtonController } from '@/features/shared/hooks/useExportToolbarButtonController';
import { ExportToolbarButtonView } from './ExportToolbarButtonView';

export function ExportToolbarButton(props: DropdownMenuProps) {
  const viewProps = useExportToolbarButtonController();
  return <ExportToolbarButtonView {...viewProps} onOpenChange={viewProps.setOpen} {...props} />;
}
