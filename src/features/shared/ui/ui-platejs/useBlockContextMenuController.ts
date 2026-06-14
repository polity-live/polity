import * as React from 'react';

import { BlockMenuPlugin, BlockSelectionPlugin } from '@platejs/selection/react';
import { KEYS } from 'platejs';
import { useEditorPlugin, usePlateState } from 'platejs/react';

import { useIsTouchDevice } from '@/features/shared/hooks/use-is-touch-device.ts';
import { useTranslation } from 'react-i18next';

type Value = 'askAI' | null;

export function useBlockContextMenuController({ children }: { children: React.ReactNode }) {
  const { api, editor } = useEditorPlugin(BlockMenuPlugin);

  const [value, setValue] = React.useState<Value>(null);

  const isTouch = useIsTouchDevice();

  const [readOnly] = usePlateState('readOnly');

  const { t } = useTranslation();

  const handleTurnInto = React.useCallback(
    (type: string) => {
      editor
        .getApi(BlockSelectionPlugin)
        .blockSelection.getNodes()
        .forEach(([node, path]) => {
          if (node[KEYS.listType]) {
            editor.tf.unsetNodes([KEYS.listType, 'indent'], {
              at: path,
            });
          }

          editor.tf.toggleBlock(type, { at: path });
        });
    },
    [editor]
  );

  const handleAlign = React.useCallback(
    (align: 'center' | 'left' | 'right') => {
      editor.getTransforms(BlockSelectionPlugin).blockSelection.setNodes({ align });
    },
    [editor]
  );

  return {
    children,
    api,
    editor,
    value,
    setValue,
    isTouch,
    readOnly,
    t,
    handleTurnInto,
    handleAlign,
  };
}
