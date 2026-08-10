import { createPlatePlugin } from 'platejs/react';

import { FixedToolbar } from '@/features/shared/ui/ui-platejs/fixed-toolbar.tsx';
import { FixedToolbarButtons } from '@/features/shared/ui/ui-platejs/fixed-toolbar-buttons.tsx';

export function FixedToolbarContent() {
  return (
    <FixedToolbar>
      <FixedToolbarButtons />
    </FixedToolbar>
  );
}

export const FixedToolbarKit = [
  createPlatePlugin({
    key: 'fixed-toolbar',
    render: {
      beforeEditable: FixedToolbarContent,
    },
  }),
];
