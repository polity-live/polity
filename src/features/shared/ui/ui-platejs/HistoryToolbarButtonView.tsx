import type { ComponentProps, ReactNode } from 'react';

import { ToolbarButton } from '@/features/shared/ui/layout';

interface HistoryToolbarButtonViewProps extends ComponentProps<typeof ToolbarButton> {
  icon: ReactNode;
}

export function HistoryToolbarButtonView({ icon, ...props }: HistoryToolbarButtonViewProps) {
  return <ToolbarButton {...props}>{icon}</ToolbarButton>;
}
