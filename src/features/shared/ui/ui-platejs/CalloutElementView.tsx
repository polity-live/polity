import * as React from 'react';

import { PlateElement } from 'platejs/react';

import { Button } from '@/features/shared/ui/ui/button.tsx';
import { cn } from '@/features/shared/utils/utils.ts';

import { EmojiPicker, EmojiPopover } from './emoji-toolbar-button.tsx';

export interface CalloutElementViewProps {
  attributes: any;
  children: any;
  className: any;
  props: any;
  emojiPickerState: any;
  isOpen: any;
  setIsOpen: any;
  emojiToolbarDropdownProps: any;
  calloutProps: any;
}

export function CalloutElementView({
  attributes,
  children,
  className,
  props,
  emojiPickerState,
  emojiToolbarDropdownProps,
  calloutProps,
}: CalloutElementViewProps) {
  return (
    <PlateElement
      className={cn('bg-muted my-1 flex rounded-sm p-4 pl-3', className)}
      style={{
        backgroundColor: (props.element as { backgroundColor?: string }).backgroundColor,
      }}
      attributes={{
        ...attributes,
        'data-plate-open-context-menu': true,
      }}
      {...props}
    >
      <div className="flex w-full gap-2 rounded-md">
        <EmojiPopover
          {...emojiToolbarDropdownProps}
          control={
            <Button
              variant="ghost"
              className="hover:bg-muted-foreground/15 size-6 p-1 text-[18px] select-none"
              style={{
                fontFamily:
                  '"Apple Color Emoji", "Segoe UI Emoji", NotoColorEmoji, "Noto Color Emoji", "Segoe UI Symbol", "Android Emoji", EmojiSymbols',
              }}
              contentEditable={false}
            >
              {(props.element as { icon?: string }).icon || '💡'}
            </Button>
          }
        >
          <EmojiPicker {...emojiPickerState} {...calloutProps} />
        </EmojiPopover>
        <div className="w-full">{children}</div>
      </div>
    </PlateElement>
  );
}
