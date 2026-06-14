import * as React from 'react';

import { ToolbarButton } from '@/features/shared/ui/layout';

export interface MarkToolbarButtonViewProps {
  clear: any;
  nodeType: any;
  props: any;
  state: any;
  buttonProps: any;
}

export function MarkToolbarButtonView({ props, buttonProps }: MarkToolbarButtonViewProps) {
  return <ToolbarButton {...props} {...buttonProps} />;
}
