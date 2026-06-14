import type { TLinkElement } from 'platejs';
import type { PlateElementProps } from 'platejs/react';

import { useLink } from '@platejs/link/react';
import { LinkElementView } from './LinkElementView';
export function LinkElement(props: PlateElementProps<TLinkElement>) {
  const { props: linkProps } = useLink({ element: props.element });
  return <LinkElementView props={props} linkProps={linkProps} />;
}
