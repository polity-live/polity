import * as React from 'react';

import { BlockSelectionPlugin } from '@platejs/selection/react';

import { ToolbarButton } from '@/features/shared/ui/layout';
export interface AIToolbarButtonViewProps {
  api: any;
  editor: any;
  props: React.ComponentProps<typeof ToolbarButton>;
}

export function AIToolbarButtonView({ props, api, editor }: AIToolbarButtonViewProps) {
  const getFallbackBlock = () => {
    const currentBlock = editor.api.block({ highest: true });

    if (currentBlock) {
      return currentBlock;
    }

    return editor.api.blocks({ at: [], mode: 'lowest' }).at(-1);
  };

  const selectBlock = (block: any) => {
    const blockId = block?.[0]?.id;

    if (typeof blockId === 'string' && blockId.length > 0) {
      editor.getApi(BlockSelectionPlugin).blockSelection.set(blockId);
    }
  };

  const handleClick: React.MouseEventHandler<HTMLButtonElement> = event => {
    props.onClick?.(event);

    if (event.defaultPrevented) {
      return;
    }

    const isBlockSelecting = editor.getOption(BlockSelectionPlugin, 'isSelectingSome');
    const isTextSelecting = !isBlockSelecting && editor.api.isExpanded();

    if (isBlockSelecting) {
      api.aiChat.show();
      return;
    }

    const fallbackBlock = editor.selection
      ? editor.api.block({ highest: true })
      : getFallbackBlock();

    if (editor.selection) {
      editor.tf.focus();
    } else {
      if (fallbackBlock) {
        editor.tf.select(fallbackBlock[1], { edge: 'end' });
        editor.tf.focus();
      } else {
        editor.tf.focus({ edge: 'endEditor' });
      }
    }

    if (!isTextSelecting) {
      selectBlock(fallbackBlock);
    }

    api.aiChat.show();
  };

  const handleMouseDown: React.MouseEventHandler<HTMLButtonElement> = event => {
    props.onMouseDown?.(event);
    event.preventDefault();
  };

  return <ToolbarButton {...props} onClick={handleClick} onMouseDown={handleMouseDown} />;
}
