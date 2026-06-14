import type { MouseEvent } from 'react';

import { useEditorRef, useEditorSelector } from 'platejs/react';
import { useTranslation } from 'react-i18next';

type HistoryToolbarAction = 'redo' | 'undo';

export function useHistoryToolbarButtonController(action: HistoryToolbarAction) {
  const editor = useEditorRef();
  const { t } = useTranslation();
  const disabled = useEditorSelector(
    editor =>
      action === 'redo' ? editor.history.redos.length === 0 : editor.history.undos.length === 0,
    [action]
  );

  return {
    disabled,
    onClick: () => {
      if (action === 'redo') {
        editor.redo();
        return;
      }
      editor.undo();
    },
    onMouseDown: (event: MouseEvent) => event.preventDefault(),
    tooltip: t(action === 'redo' ? 'plateJs.toolbar.redo' : 'plateJs.toolbar.undo'),
  };
}
