'use client';

import { useLayoutEffect, type FormEventHandler, type ReactNode, type RefObject } from 'react';
import { CardContent } from '@/features/shared/ui/ui/card';
import { cn } from '@/features/shared/utils/utils';

export interface ChatComposerProps {
  value: string;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onSubmit: FormEventHandler<HTMLFormElement>;
  chips?: ReactNode;
  children: ReactNode;
  toolbar?: ReactNode;
  helper?: ReactNode;
  className?: string;
  minTextareaHeight?: number;
}

export function ChatComposer({
  value,
  textareaRef,
  onSubmit,
  chips,
  children,
  toolbar,
  helper,
  className,
  minTextareaHeight = 44,
}: ChatComposerProps) {
  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = '0px';
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, minTextareaHeight), 176)}px`;
    textarea.style.overflowY = textarea.scrollHeight > 176 ? 'auto' : 'hidden';
  }, [minTextareaHeight, textareaRef, value]);

  return (
    <CardContent
      separator
      className="flex-shrink-0 px-0 py-2.5 md:px-4"
      data-swipe-lock
      data-tutorial-anchor="message-composer"
    >
      <form onSubmit={onSubmit} className={cn('mx-auto w-full max-w-3xl space-y-2', className)}>
        <div className="border-input bg-card focus-within:border-ring focus-within:ring-ring/35 rounded-2xl border px-3 py-2 shadow-sm transition-[border-color,box-shadow] focus-within:ring-[3px]">
          {chips ? <div className="flex flex-wrap gap-1.5 pb-1.5">{chips}</div> : null}
          <div className="relative">{children}</div>
          {toolbar ? <div className="flex min-h-9 items-center gap-2 pt-1">{toolbar}</div> : null}
        </div>
        {helper ? <div className="px-1">{helper}</div> : null}
      </form>
    </CardContent>
  );
}

export const chatComposerTextareaClassName =
  'min-h-11 max-h-44 resize-none border-0 bg-transparent px-1 py-2 shadow-none focus-visible:border-transparent focus-visible:ring-0';
