import type { PlateElementProps } from 'platejs/react';

import { useToggleButton, useToggleButtonState } from '@platejs/toggle/react';

export function useToggleElementController(props: PlateElementProps) {
  const element = props.element;

  const state = useToggleButtonState(element.id as string);

  const { buttonProps, open } = useToggleButton(state);

  return {
    props,
    element,
    state,
    buttonProps,
    open,
  };
}
