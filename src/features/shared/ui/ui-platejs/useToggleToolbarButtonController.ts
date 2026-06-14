import * as React from 'react';

import { useToggleToolbarButton, useToggleToolbarButtonState } from '@platejs/toggle/react';
import { useTranslation } from 'react-i18next';

import { ToolbarButton } from '@/features/shared/ui/layout';

export function useToggleToolbarButtonController(
  props: React.ComponentProps<typeof ToolbarButton>
) {
  const state = useToggleToolbarButtonState();

  const { props: buttonProps } = useToggleToolbarButton(state);

  const { t } = useTranslation();

  return {
    props,
    state,
    buttonProps,
    t,
  };
}
