import type { PlateElementProps } from 'platejs/react';
import { useTranslation } from 'react-i18next';
import { useTocElement, useTocElementState } from '@platejs/toc/react';
export function useTocElementController(props: PlateElementProps) {
  const { t } = useTranslation();

  const state = useTocElementState();

  const { props: btnProps } = useTocElement(state);

  const { headingList } = state;

  return {
    props,
    t,
    state,
    btnProps,
    headingList,
  };
}
