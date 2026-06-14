import type { ComponentProps } from 'react';

import { cn } from '@/features/shared/utils/utils';

export function FieldGrid({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('grid gap-4 md:grid-cols-2', className)} {...props} />;
}

export function FieldList({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('space-y-4', className)} {...props} />;
}
