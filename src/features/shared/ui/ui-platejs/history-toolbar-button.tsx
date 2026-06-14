import * as React from 'react';

import { Redo2Icon, Undo2Icon } from 'lucide-react';

import { useHistoryToolbarButtonController } from '@/features/shared/hooks/useHistoryToolbarButtonController';
import { ToolbarButton } from '@/features/shared/ui/layout';
import { HistoryToolbarButtonView } from './HistoryToolbarButtonView';

export function RedoToolbarButton(props: React.ComponentProps<typeof ToolbarButton>) {
  return (
    <HistoryToolbarButtonView
      {...props}
      {...useHistoryToolbarButtonController('redo')}
      icon={<Redo2Icon />}
    />
  );
}

export function UndoToolbarButton(props: React.ComponentProps<typeof ToolbarButton>) {
  return (
    <HistoryToolbarButtonView
      {...props}
      {...useHistoryToolbarButtonController('undo')}
      icon={<Undo2Icon />}
    />
  );
}
