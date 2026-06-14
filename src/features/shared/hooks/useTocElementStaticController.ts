import type { SlateEditor, TElement } from 'platejs';
import { NodeApi } from 'platejs';
import { useTranslation } from 'react-i18next';
import { type Heading, BaseTocPlugin, isHeading } from '@platejs/toc';

const headingDepth: Record<string, number> = {
  h1: 1,
  h2: 2,
  h3: 3,
  h4: 4,
  h5: 5,
  h6: 6,
};

const getHeadingList = (editor?: SlateEditor) => {
  if (!editor) return [];

  const options = editor.getOptions(BaseTocPlugin);

  if (options.queryHeading) {
    return options.queryHeading(editor);
  }

  const headingList: Heading[] = [];

  const values = editor.api.nodes<TElement>({
    at: [],
    match: node => isHeading(node),
  });

  if (!values) return [];

  Array.from(values, ([node, path]) => {
    const { type } = node;
    const title = NodeApi.string(node);
    const depth = headingDepth[type];
    const id = node.id as string;

    if (title) {
      headingList.push({ id, depth, path, title, type });
    }
  });

  return headingList;
};

export function useTocElementStaticController(editor?: SlateEditor) {
  const { t } = useTranslation();

  return {
    headingList: getHeadingList(editor),
    emptyLabel: t('plateJs.toolbar.tableOfContents.createHeading'),
  };
}
