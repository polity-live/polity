import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useMemo } from 'react';
import { Plate, PlateContent, ParagraphPlugin, usePlateEditor } from 'platejs/react';
import { suggestionPreviewClassName } from '@/features/shared/ui/ui-platejs/suggestion-mark-style';
import type { RichTextNode, StudioPlateElement } from '../logic/document-v3';

export function studioText(node: RichTextNode): string {
  const read = (children: StudioPlateElement['children']): string =>
    children.map(child => ('text' in child ? child.text : read(child.children))).join('');
  return node.content.map(block => read(block.children)).join('\n');
}

export function StudioPlateDiff({ before, after }: { before: string; after: string }) {
  const { t } = useTranslation();
  const value = useMemo(() => {
    let prefix = 0;
    while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix])
      prefix++;
    let suffix = 0;
    while (
      suffix < before.length - prefix &&
      suffix < after.length - prefix &&
      before[before.length - suffix - 1] === after[after.length - suffix - 1]
    )
      suffix++;
    const leaves = [
      { text: before.slice(0, prefix) },
      { text: before.slice(prefix, before.length - suffix), suggestionKind: 'remove' },
      { text: after.slice(prefix, after.length - suffix), suggestionKind: 'insert' },
      { text: after.slice(after.length - suffix) },
    ].filter(leaf => leaf.text.length);
    return [{ type: 'p', children: leaves.length ? leaves : [{ text: '' }] }];
  }, [before, after]);
  const editor = usePlateEditor({ plugins: [ParagraphPlugin], value: value as never }, [
    before,
    after,
  ]);
  return (
    <Plate editor={editor}>
      <PlateContent
        readOnly
        aria-label={t('features.studio.textChanges')}
        className="rounded border p-2 text-sm whitespace-pre-wrap"
        renderLeaf={({ attributes, children, leaf }) => (
          <span
            {...attributes}
            className={
              leaf.suggestionKind === 'remove' || leaf.suggestionKind === 'insert'
                ? suggestionPreviewClassName(leaf.suggestionKind)
                : undefined
            }
          >
            {children}
          </span>
        )}
      />
    </Plate>
  );
}
