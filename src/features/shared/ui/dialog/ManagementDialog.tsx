import type { ComponentProps } from 'react';

import { DialogContent, DialogFooter, DialogHeader } from '@/features/shared/ui/ui/dialog';
import { cn } from '@/features/shared/utils/utils';

export function ManagementDialogContent({
  className,
  ...props
}: ComponentProps<typeof DialogContent>) {
  return (
    <DialogContent
      data-slot="management-dialog-content"
      className={cn(
        'flex max-h-[calc(100dvh-2rem)] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl',
        className
      )}
      {...props}
    />
  );
}

export function ManagementDialogHeader({
  className,
  ...props
}: ComponentProps<typeof DialogHeader>) {
  return (
    <DialogHeader
      data-slot="management-dialog-header"
      className={cn('border-border/60 shrink-0 border-b px-5 py-4 pr-12 sm:px-6', className)}
      {...props}
    />
  );
}

export function ManagementDialogBody({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="management-dialog-body"
      className={cn('min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6', className)}
      {...props}
    />
  );
}

export function ManagementDialogFooter({
  className,
  ...props
}: ComponentProps<typeof DialogFooter>) {
  return (
    <DialogFooter
      data-slot="management-dialog-footer"
      className={cn(
        'border-border/60 bg-background/95 shrink-0 border-t px-5 py-4 backdrop-blur sm:px-6',
        className
      )}
      {...props}
    />
  );
}

export function ManagementDialogSection({ className, ...props }: ComponentProps<'section'>) {
  return (
    <section
      data-slot="management-dialog-section"
      className={cn('border-border/60 bg-muted/15 rounded-lg border p-4 shadow-none', className)}
      {...props}
    />
  );
}
