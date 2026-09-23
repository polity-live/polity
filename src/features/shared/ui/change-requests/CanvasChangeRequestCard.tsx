import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/features/shared/utils/utils';
import { Button } from '@/features/shared/ui/ui/button';

export function CanvasChangeRequestCard({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <div
      role={label ? 'region' : undefined}
      aria-label={label}
      className={cn('space-y-4', className)}
    >
      {children}
    </div>
  );
}

export function CanvasChangeRequestCloseButton({
  actionId,
  label,
  onClose,
}: {
  actionId?: string;
  label: string;
  onClose: () => void;
}) {
  return (
    <Button
      data-action-id={actionId}
      type="button"
      variant="ghost"
      size="icon"
      className="size-8"
      aria-label={label}
      onClick={onClose}
    >
      <X className="size-4" />
    </Button>
  );
}
