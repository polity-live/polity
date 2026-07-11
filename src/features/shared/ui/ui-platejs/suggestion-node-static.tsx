import type { SlateLeafProps, TSuggestionText } from 'platejs';

import { BaseSuggestionPlugin } from '@platejs/suggestion';
import { SlateLeaf } from 'platejs/static';

import { getMotionPreset, getSemanticToneClasses } from '@/features/shared/theme';
import { cn } from '@/features/shared/utils/utils.ts';

const INLINE_SUGGESTION_MARK_CLASSES = 'box-decoration-clone rounded-sm border px-0.5 no-underline';

export function SuggestionLeafStatic(props: SlateLeafProps<TSuggestionText>) {
  const { editor, leaf } = props;

  const dataList = editor.getApi(BaseSuggestionPlugin).suggestion.dataList(leaf);
  const hasRemove = dataList.some(data => data.type === 'remove');
  const diffOperation = { type: hasRemove ? 'delete' : 'insert' } as const;
  const insertTone = getSemanticToneClasses('success');
  const removeTone = getSemanticToneClasses('danger');

  const Component = ({ delete: 'del', insert: 'ins', update: 'span' } as const)[diffOperation.type];

  return (
    <SlateLeaf
      {...props}
      as={Component}
      className={cn(
        INLINE_SUGGESTION_MARK_CLASSES,
        getMotionPreset('colors'),
        insertTone.surface,
        hasRemove && `${removeTone.surface} line-through`
      )}
    >
      {props.children}
    </SlateLeaf>
  );
}
