import { useState } from 'react';

import { LineHeightPlugin } from '@platejs/basic-styles/react';
import { useEditorRef, useSelectionFragmentProp } from 'platejs/react';
import { useTranslation } from 'react-i18next';

export function useLineHeightToolbarButtonController() {
  const editor = useEditorRef();
  const { defaultNodeValue, validNodeValues: values = [] } =
    editor.getInjectProps(LineHeightPlugin);

  const value = useSelectionFragmentProp({
    defaultValue: defaultNodeValue,
    getProp: node => node.lineHeight,
  });

  const [open, setOpen] = useState(false);
  const { t } = useTranslation();

  const handleValueChange = (newValue: string) => {
    editor.getTransforms(LineHeightPlugin).lineHeight.setNodes(Number(newValue));
    editor.tf.focus();
  };

  return {
    label: t('plateJs.toolbar.lineHeight'),
    open,
    onOpenChange: setOpen,
    value,
    values,
    onValueChange: handleValueChange,
  };
}
