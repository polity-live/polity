import * as React from 'react';

import { useLinkToolbarButton, useLinkToolbarButtonState } from '@platejs/link/react';
import { useTranslation } from 'react-i18next';

import { ToolbarButton } from '@/features/shared/ui/layout';

export function useLinkToolbarButtonController(props: React.ComponentProps<typeof ToolbarButton>) {
  const state = useLinkToolbarButtonState();

  const { props: buttonProps } = useLinkToolbarButton(state);

  const { t } = useTranslation();

  return {
    props,
    state,
    buttonProps,
    t,
  };
}
