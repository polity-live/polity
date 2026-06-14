import { useState } from 'react';

import { KEYS } from 'platejs';
import { useEditorRef } from 'platejs/react';
import { useTranslation } from 'react-i18next';

export function useMoreToolbarButtonController() {
  const editor = useEditorRef();
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();

  return {
    open,
    onOpenChange: setOpen,
    labels: {
      more: t('plateJs.toolbar.more'),
      keyboardInput: t('plateJs.toolbar.keyboardInput'),
      superscript: t('plateJs.toolbar.superscript'),
      subscript: t('plateJs.toolbar.subscript'),
    },
    onKeyboardInput: () => {
      editor.tf.toggleMark(KEYS.kbd);
      editor.tf.collapse({ edge: 'end' });
      editor.tf.focus();
    },
    onSuperscript: () => {
      editor.tf.toggleMark(KEYS.sup, {
        remove: KEYS.sub,
      });
      editor.tf.focus();
    },
    onSubscript: () => {
      editor.tf.toggleMark(KEYS.sub, {
        remove: KEYS.sup,
      });
      editor.tf.focus();
    },
  };
}
