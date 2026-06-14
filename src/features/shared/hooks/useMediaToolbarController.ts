import { useEffect } from 'react';

import {
  FloatingMediaStore,
  useFloatingMediaValue,
  useImagePreviewValue,
} from '@platejs/media/react';
import {
  useEditorRef,
  useEditorSelector,
  useElement,
  useReadOnly,
  useRemoveNodeButton,
  useSelected,
} from 'platejs/react';
import { useTranslation } from 'react-i18next';

export function useMediaToolbarController() {
  const editor = useEditorRef();
  const readOnly = useReadOnly();
  const selected = useSelected();
  const { t } = useTranslation();

  const selectionCollapsed = useEditorSelector(editor => !editor.api.isExpanded(), []);
  const isImagePreviewOpen = useImagePreviewValue('isOpen', editor.id);
  const isOpen = !readOnly && selected && selectionCollapsed && !isImagePreviewOpen;
  const isEditing = useFloatingMediaValue('isEditing');

  useEffect(() => {
    if (!isOpen && isEditing) {
      FloatingMediaStore.set('isEditing', false);
    }
  }, [isOpen, isEditing]);

  const element = useElement();
  const { props: removeButtonProps } = useRemoveNodeButton({ element });

  return {
    readOnly,
    isOpen,
    isEditing,
    removeButtonProps,
    labels: {
      embedLinkPlaceholder: t('plateJs.media.toolbar.embedLinkPlaceholder'),
      editLink: t('plateJs.media.toolbar.editLink'),
      caption: t('plateJs.media.toolbar.caption'),
    },
  };
}
