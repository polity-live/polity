import type { ReactNode } from 'react';

import { Button, type ButtonProps } from '@/features/shared/ui/ui/button';
import { cn } from '@/features/shared/utils/utils';

interface FormActionsProps {
  children?: ReactNode;
  submitLabel?: ReactNode;
  cancelLabel?: ReactNode;
  onCancel?: () => void;
  isSubmitting?: boolean;
  submitDisabled?: boolean;
  submitVariant?: ButtonProps['variant'];
  className?: string;
}

export function FormActions({
  children,
  submitLabel,
  cancelLabel,
  onCancel,
  isSubmitting,
  submitDisabled,
  submitVariant = 'default',
  className,
}: FormActionsProps) {
  return (
    <div className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}>
      {children}
      {cancelLabel ? (
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          {cancelLabel}
        </Button>
      ) : null}
      {submitLabel ? (
        <Button type="submit" variant={submitVariant} disabled={submitDisabled || isSubmitting}>
          {submitLabel}
        </Button>
      ) : null}
    </div>
  );
}
