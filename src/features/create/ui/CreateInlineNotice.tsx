import type React from 'react';

import { cn } from '@/features/shared/utils/utils';

interface CreateInlineNoticeProps {
  children?: React.ReactNode;
  className?: string;
  text?: React.ReactNode;
}

export function CreateInlineNotice({ children, className, text }: CreateInlineNoticeProps) {
  return (
    <div
      className={cn(
        'bg-muted/40 text-muted-foreground rounded-md border px-3 py-2 text-sm',
        className
      )}
    >
      {children ?? text}
    </div>
  );
}

export function CreateCharacterCountNotice({
  text,
  isWarning,
}: {
  text: string;
  isWarning: boolean;
}) {
  return (
    <p className={`text-xs ${isWarning ? 'text-destructive' : 'text-muted-foreground'}`}>{text}</p>
  );
}
