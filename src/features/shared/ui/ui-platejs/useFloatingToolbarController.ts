import * as React from 'react';

import {
  type FloatingToolbarState,
  flip,
  offset,
  useFloatingToolbar,
  useFloatingToolbarState,
} from '@platejs/floating';
import { useComposedRef } from '@udecode/cn';
import { KEYS } from 'platejs';
import { useEditorId, useEventEditorValue, usePluginOption } from 'platejs/react';

import { Toolbar } from '@/features/shared/ui/layout';

export function useFloatingToolbarController({
  children,
  className,
  state,
  ...props
}: React.ComponentProps<typeof Toolbar> & {
  state?: FloatingToolbarState;
}) {
  const editorId = useEditorId();

  const focusedEditorId = useEventEditorValue('focus');

  const isFloatingLinkOpen = !!usePluginOption({ key: KEYS.link }, 'mode');

  const isAIChatOpen = usePluginOption({ key: KEYS.aiChat }, 'open');

  const floatingToolbarState = useFloatingToolbarState({
    editorId,
    focusedEditorId,
    hideToolbar: isFloatingLinkOpen || isAIChatOpen,
    ...state,
    floatingOptions: {
      middleware: [
        offset(12),
        flip({
          fallbackPlacements: ['top-start', 'top-end', 'bottom-start', 'bottom-end'],
          padding: 12,
        }),
      ],
      placement: 'top',
      ...state?.floatingOptions,
    },
  });

  const {
    clickOutsideRef,
    hidden,
    props: rootProps,
    ref: floatingRef,
  } = useFloatingToolbar(floatingToolbarState);

  const ref = useComposedRef<HTMLDivElement>(props.ref, floatingRef);

  return {
    children,
    className,
    state,
    props,
    editorId,
    focusedEditorId,
    isFloatingLinkOpen,
    isAIChatOpen,
    floatingToolbarState,
    clickOutsideRef,
    hidden,
    rootProps,
    floatingRef,
    ref,
  };
}
