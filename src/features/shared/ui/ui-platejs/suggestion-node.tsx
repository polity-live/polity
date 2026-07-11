import * as React from 'react';

import type { TSuggestionData, TSuggestionText } from 'platejs';
import type { PlateLeafProps, RenderNodeWrapper } from 'platejs/react';

import { CornerDownLeftIcon } from 'lucide-react';
import { PlateLeaf, useEditorPlugin, usePluginOption } from 'platejs/react';

import { cn } from '@/features/shared/utils/utils.ts';
import {
  type SuggestionConfig,
  suggestionPlugin,
} from '@/features/shared/ui/kit-platejs/suggestion-kit.tsx';
import { discussionPlugin } from '@/features/shared/ui/kit-platejs/discussion-kit.tsx';
import { useModeContext } from '@/features/shared/ui/kit-platejs/mode-context.tsx';
import { getMotionPreset, getSemanticToneClasses } from '@/features/shared/theme';

const INLINE_SUGGESTION_MARK_CLASSES = 'box-decoration-clone rounded-sm border px-0.5 no-underline';

export function SuggestionLeaf(props: PlateLeafProps<TSuggestionText>) {
  const { api, setOption } = useEditorPlugin(suggestionPlugin);
  const leaf = props.leaf;

  const leafId: string = api.suggestion.nodeId(leaf) ?? '';
  const activeSuggestionId = usePluginOption(suggestionPlugin, 'activeId');
  const hoverSuggestionId = usePluginOption(suggestionPlugin, 'hoverId');
  const dataList = api.suggestion.dataList(leaf);

  // CR filtering: when specific CRs are selected, hide marks from other CRs
  const { selectedCrIds } = useModeContext();
  const discussions = usePluginOption(discussionPlugin, 'discussions');
  const leafCrId = discussions?.find((d: { id: string; crId?: string }) => d.id === leafId)?.crId;
  const isFilteredOut = selectedCrIds != null && leafCrId != null && !selectedCrIds.has(leafCrId);

  const hasRemove = dataList.some(data => data.type === 'remove');
  const hasActive = dataList.some(data => data.id === activeSuggestionId);
  const hasHover = dataList.some(data => data.id === hoverSuggestionId);

  // When filtered out: inserts (green) should be hidden, removes (red) should appear as plain text
  if (isFilteredOut) {
    if (!hasRemove) {
      // Insert from another CR: hide entirely
      return (
        <PlateLeaf {...props} as="span" className="hidden">
          {props.children}
        </PlateLeaf>
      );
    }
    // Remove from another CR: show as plain text (no suggestion styling)
    return (
      <PlateLeaf {...props} as="span">
        {props.children}
      </PlateLeaf>
    );
  }

  const diffOperation = { type: hasRemove ? 'delete' : 'insert' } as const;
  const insertTone = getSemanticToneClasses('success');
  const removeTone = getSemanticToneClasses('danger');

  const Component = ({ delete: 'del', insert: 'ins', update: 'span' } as const)[diffOperation.type];

  return (
    <PlateLeaf
      {...props}
      as={Component}
      className={cn(
        INLINE_SUGGESTION_MARK_CLASSES,
        getMotionPreset('colors'),
        insertTone.surface,
        (hasActive || hasHover) && `ring-1 ${insertTone.ring}`,
        hasRemove && `${removeTone.surface} line-through`,
        (hasActive || hasHover) && hasRemove && `no-underline ring-1 ${removeTone.ring}`
      )}
      attributes={{
        ...props.attributes,
        'data-suggestion-id': leafId || undefined,
        'data-suggestion-type': hasRemove ? 'remove' : 'insert',
        onMouseEnter: () => setOption('hoverId', leafId),
        onMouseLeave: () => setOption('hoverId', null),
      }}
    >
      {props.children}
    </PlateLeaf>
  );
}

export const SuggestionLineBreak: RenderNodeWrapper<SuggestionConfig> = ({ api, element }) => {
  if (!api.suggestion.isBlockSuggestion(element)) return;

  const suggestionData = element.suggestion;

  if (!suggestionData?.isLineBreak) return;

  return function Component({ children }) {
    return (
      <React.Fragment>
        {children}
        <SuggestionLineBreakContent suggestionData={suggestionData} />
      </React.Fragment>
    );
  };
};

function SuggestionLineBreakContent({ suggestionData }: { suggestionData: TSuggestionData }) {
  const { type } = suggestionData;
  const isRemove = type === 'remove';
  const isInsert = type === 'insert';

  const activeSuggestionId = usePluginOption(suggestionPlugin, 'activeId');
  const hoverSuggestionId = usePluginOption(suggestionPlugin, 'hoverId');

  // CR filtering: hide line break indicators from other CRs
  const { selectedCrIds } = useModeContext();
  const discussions = usePluginOption(discussionPlugin, 'discussions');
  const lineBreakCrId = discussions?.find(
    (d: { id: string; crId?: string }) => d.id === suggestionData.id
  )?.crId;
  const isFilteredOut =
    selectedCrIds != null && lineBreakCrId != null && !selectedCrIds.has(lineBreakCrId);

  if (isFilteredOut) return null;

  const isActive = activeSuggestionId === suggestionData.id;
  const isHover = hoverSuggestionId === suggestionData.id;
  const insertTone = getSemanticToneClasses('success');
  const removeTone = getSemanticToneClasses('danger');

  const spanRef = React.useRef<HTMLSpanElement>(null);

  return (
    <span
      ref={spanRef}
      className={cn(
        'absolute rounded-sm border border-b-2 px-0.5 text-justify no-underline',
        getMotionPreset('colors'),
        isInsert && insertTone.surface,
        isInsert && (isActive || isHover) && `ring-1 ${insertTone.ring}`,
        isRemove && `${removeTone.surface} line-through`,
        isRemove && (isActive || isHover) && `no-underline ring-1 ${removeTone.ring}`
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
