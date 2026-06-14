import { useState } from 'react';

import { MarkdownPlugin } from '@platejs/markdown';
import { getEditorDOMFromHtmlString } from 'platejs';
import { useEditorRef } from 'platejs/react';
import { useTranslation } from 'react-i18next';
import { useFilePicker } from 'use-file-picker';

type ImportType = 'html' | 'markdown';

export function useImportToolbarButtonController() {
  const editor = useEditorRef();
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();

  const getFileNodes = (text: string, type: ImportType) => {
    if (type === 'html') {
      const editorNode = getEditorDOMFromHtmlString(text);
      const nodes = editor.api.html.deserialize({
        element: editorNode,
      });

      return nodes;
    }

    if (type === 'markdown') {
      return editor.getApi(MarkdownPlugin).markdown.deserialize(text);
    }

    return [];
  };

  const { openFilePicker: openMdFilePicker } = useFilePicker({
    accept: ['.md', '.mdx'],
    multiple: false,
    onFilesSuccessfullySelected: async ({ plainFiles }: { plainFiles: File[] }) => {
      const text = await plainFiles[0].text();
      const nodes = getFileNodes(text, 'markdown');
      editor.tf.insertNodes(nodes);
    },
  });

  const { openFilePicker: openHtmlFilePicker } = useFilePicker({
    accept: ['text/html'],
    multiple: false,
    onFilesSuccessfullySelected: async ({ plainFiles }: { plainFiles: File[] }) => {
      const text = await plainFiles[0].text();
      const nodes = getFileNodes(text, 'html');
      editor.tf.insertNodes(nodes);
    },
  });

  return {
    open,
    onOpenChange: setOpen,
    labels: {
      import: t('plateJs.toolbar.import'),
      importFromHTML: t('plateJs.toolbar.importFromHTML'),
      importFromMarkdown: t('plateJs.toolbar.importFromMarkdown'),
    },
    onOpenHtmlFilePicker: openHtmlFilePicker,
    onOpenMarkdownFilePicker: openMdFilePicker,
  };
}
