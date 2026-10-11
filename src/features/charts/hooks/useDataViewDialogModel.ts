import * as React from 'react';
import { useEditorRef } from 'platejs/react';
import { useTranslation } from 'react-i18next';
import { useDataViewBuilderModel } from './useDataViewBuilderModel';
import { OPEN_DATA_VIEW_DIALOG_EVENT } from '../ui/chartDialogEvents';
import type { TDataViewElement } from '../types';
import { DataViewInsertionError } from '../logic/dataViewInsertion';
/** Plate adapter: Studio instances use the builder directly and never listen to these events. */
export function useDataViewDialogModel() {
  const editor = useEditorRef();
  const { t } = useTranslation();
  const model = useDataViewBuilderModel({
    onInsert: (node, _projection, editingElement) => {
      if (editingElement) {
        const path = editor.api.findPath(editingElement);
        if (!path) throw new DataViewInsertionError(t('plateJs.dataView.elementMissing'));
        editor.tf.setNodes(node, { at: path });
      } else editor.tf.insertNodes(node);
      window.setTimeout(() => editor.tf.focus(), 0);
    },
  });
  const { resetDialog, setOpen } = model;
  React.useEffect(() => {
    const listener = (event: Event) => {
      resetDialog((event as CustomEvent<{ element?: TDataViewElement }>).detail?.element);
      setOpen(true);
    };
    window.addEventListener(OPEN_DATA_VIEW_DIALOG_EVENT, listener);
    return () => window.removeEventListener(OPEN_DATA_VIEW_DIALOG_EVENT, listener);
  }, [resetDialog, setOpen]);
  const { resetDialog: _resetDialog, ...viewModel } = model;
  return viewModel;
}
export type DataViewDialogModel = ReturnType<typeof useDataViewDialogModel>;
