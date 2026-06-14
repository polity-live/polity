import * as React from 'react';

import { ListCollapseIcon } from 'lucide-react';

import { ToolbarButton } from '@/features/shared/ui/layout';

export interface ToggleToolbarButtonViewProps {
  props: any;
  state: any;
  buttonProps: any;
  t: any;
}

export function ToggleToolbarButtonView({ props, buttonProps, t }: ToggleToolbarButtonViewProps) {
  return (
    <ToolbarButton {...props} {...buttonProps} tooltip={t('plateJs.toolbar.toggleList')}>
      <ListCollapseIcon />
    </ToolbarButton>
  );
}
