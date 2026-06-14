import * as React from 'react';

import { AIChatPlugin } from '@platejs/ai/react';
import { BLOCK_CONTEXT_MENU_ID, BlockSelectionPlugin } from '@platejs/selection/react';
import { KEYS } from 'platejs';

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/features/shared/ui/ui/context-menu.tsx';
export interface BlockContextMenuViewProps {
  children: any;
  api: any;
  editor: any;
  value: any;
  setValue: any;
  isTouch: any;
  readOnly: any;
  t: any;
  handleTurnInto: any;
  handleAlign: any;
}

export function BlockContextMenuView({
  children,
  api,
  editor,
  value,
  setValue,
  isTouch,
  readOnly,
  t,
  handleTurnInto,
  handleAlign,
}: BlockContextMenuViewProps) {
  if (isTouch) {
    return <>{children}</>;
  }

  return (
    <ContextMenu
      onOpenChange={open => {
        if (!open) {
          // prevent unselect the block selection
          setTimeout(() => {
            api.blockMenu.hide();
          }, 0);
        }
      }}
      modal={false}
    >
      <ContextMenuTrigger
        asChild
        onContextMenu={event => {
          const dataset = (event.target as HTMLElement).dataset;

          const disabled = dataset?.slateEditor === 'true' || readOnly;

          if (disabled) return event.preventDefault();

          api.blockMenu.show(BLOCK_CONTEXT_MENU_ID, {
            x: event.clientX,
            y: event.clientY,
          });
        }}
      >
        <div className="w-full">{children}</div>
      </ContextMenuTrigger>
      <ContextMenuContent
        className="w-64"
        onCloseAutoFocus={e => {
          e.preventDefault();
          editor.getApi(BlockSelectionPlugin).blockSelection.focus();

          if (value === 'askAI') {
            editor.getApi(AIChatPlugin).aiChat.show();
          }

          setValue(null);
        }}
      >
        <ContextMenuGroup>
          <ContextMenuItem
            onClick={() => {
              setValue('askAI');
            }}
          >
            {t('plateJs.blockContextMenu.askAI')}
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => {
              editor.getTransforms(BlockSelectionPlugin).blockSelection.removeNodes();
              editor.tf.focus();
            }}
          >
            {t('plateJs.blockContextMenu.delete')}
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => {
              editor.getTransforms(BlockSelectionPlugin).blockSelection.duplicate();
            }}
          >
            {t('plateJs.blockContextMenu.duplicate')}
            {/* <ContextMenuShortcut>⌘ + D</ContextMenuShortcut> */}
          </ContextMenuItem>
          <ContextMenuSub>
            <ContextMenuSubTrigger>{t('plateJs.blockContextMenu.turnInto')}</ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-48">
              <ContextMenuItem onClick={() => handleTurnInto(KEYS.p)}>
                {t('plateJs.blockContextMenu.paragraph')}
              </ContextMenuItem>

              <ContextMenuItem onClick={() => handleTurnInto(KEYS.h1)}>
                {t('plateJs.headings.heading1')}
              </ContextMenuItem>
              <ContextMenuItem onClick={() => handleTurnInto(KEYS.h2)}>
                {t('plateJs.blockContextMenu.heading2')}
              </ContextMenuItem>
              <ContextMenuItem onClick={() => handleTurnInto(KEYS.h3)}>
                {t('plateJs.blockContextMenu.heading3')}
              </ContextMenuItem>
              <ContextMenuItem onClick={() => handleTurnInto(KEYS.blockquote)}>
                {t('plateJs.blockContextMenu.blockquote')}
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
        </ContextMenuGroup>

        <ContextMenuGroup>
          <ContextMenuItem
            onClick={() => editor.getTransforms(BlockSelectionPlugin).blockSelection.setIndent(1)}
          >
            {t('plateJs.blockContextMenu.indent')}
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => editor.getTransforms(BlockSelectionPlugin).blockSelection.setIndent(-1)}
          >
            {t('plateJs.blockContextMenu.outdent')}
          </ContextMenuItem>
          <ContextMenuSub>
            <ContextMenuSubTrigger>{t('plateJs.blockContextMenu.align')}</ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-48">
              <ContextMenuItem onClick={() => handleAlign('left')}>
                {t('plateJs.blockContextMenu.alignLeft')}
              </ContextMenuItem>
              <ContextMenuItem onClick={() => handleAlign('center')}>
                {t('plateJs.blockContextMenu.alignCenter')}
              </ContextMenuItem>
              <ContextMenuItem onClick={() => handleAlign('right')}>
                {t('plateJs.blockContextMenu.alignRight')}
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
        </ContextMenuGroup>
      </ContextMenuContent>
    </ContextMenu>
  );
}
