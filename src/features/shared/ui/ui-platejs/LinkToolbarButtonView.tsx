import * as React from 'react';

import { Link } from 'lucide-react';

import { ToolbarButton } from '@/features/shared/ui/layout';

export interface LinkToolbarButtonViewProps {
  props: any;
  state: any;
  buttonProps: any;
  t: any;
}

export function LinkToolbarButtonView({ props, buttonProps, t }: LinkToolbarButtonViewProps) {
  return (
    <ToolbarButton {...props} {...buttonProps} data-plate-focus tooltip={t('plateJs.toolbar.link')}>
      <Link />
    </ToolbarButton>
  );
}
