import type { TElement, TSuggestionData, TSuggestionText } from 'platejs';
import type { SlateLeafProps } from 'platejs/static';

import { BaseSuggestionPlugin } from '@platejs/suggestion';
import { CornerDownLeftIcon } from 'lucide-react';
import { SlateLeaf } from 'platejs/static';

import { getMotionPreset, getSemanticToneClasses } from '@/features/shared/theme';
import { cn } from '@/features/shared/utils/utils.ts';

const INLINE_SUGGESTION_MARK_CLASSES = 'box-decoration-clone rounded-sm border px-0.5 no-underline';

function hasSuggestionData(
  element: TElement
): element is TElement & { suggestion?: TSuggestionData } {
  return 'suggestion' in element;
}

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

export function BlockSuggestionStatic({ element }: { element: TElement }) {
  const suggestionData = hasSuggestionData(element) ? element.suggestion : undefined;

  if (suggestionData?.isLineBreak) return null;

  const isRemove = suggestionData?.type === 'remove';
  const insertTone = getSemanticToneClasses('success');
  const removeTone = getSemanticToneClasses('danger');
  const tone = isRemove ? removeTone : insertTone;

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 z-1 border-2 transition-opacity',
        getMotionPreset('colors'),
        tone.border
      )}
      contentEditable={false}
    >
      <div
        aria-hidden
        className={cn(
          'absolute inset-0 opacity-40',
          isRemove ? 'bg-[var(--badge-danger-bg)]' : 'bg-[var(--badge-success-bg)]'
        )}
      />
    </div>
  );
}

export function SuggestionLineBreakStatic({ suggestionData }: { suggestionData: TSuggestionData }) {
  const isRemove = suggestionData.type === 'remove';
  const isInsert = suggestionData.type === 'insert';
  const insertTone = getSemanticToneClasses('success');
  const removeTone = getSemanticToneClasses('danger');

  return (
    <span
      className={cn(
        'absolute rounded-sm border border-b-2 px-0.5 text-justify no-underline',
        getMotionPreset('colors'),
        isInsert && insertTone.surface,
        isRemove && `${removeTone.surface} line-through`
      )}
      style={{
        bottom: 4.5,
        height: 21,
      }}
      contentEditable={false}
    >
      <CornerDownLeftIcon className="mt-0.5 size-4" />
    </span>
  );
}
