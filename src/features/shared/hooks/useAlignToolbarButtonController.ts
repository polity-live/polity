import { useState } from 'react';

import type { Alignment } from '@platejs/basic-styles';
import { TextAlignPlugin } from '@platejs/basic-styles/react';
import { useEditorPlugin, useSelectionFragmentProp } from 'platejs/react';
import { useTranslation } from 'react-i18next';

export function useAlignToolbarButtonController() {
  const { editor, tf } = useEditorPlugin(TextAlignPlugin);
  const value =
    useSelectionFragmentProp({
      defaultValue: 'start',
      getProp: node => node.align,
    }) ?? 'left';

  const [open, setOpen] = useState(false);
  const { t } = useTranslation();

  return {
    label: t('plateJs.toolbar.align'),
    open,
    onOpenChange: setOpen,
    value,
    onValueChange: (nextValue: string) => {
      tf.textAlign.setNodes(nextValue as Alignment);
      editor.tf.focus();
    },
  };
}
