import { type ReactNode } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/features/shared/ui/ui/dialog';
import { Button, type ButtonProps } from '@/features/shared/ui/ui/button';
import { cn } from '@/features/shared/utils/utils';

interface EntityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  trigger?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function ScrollableDialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogContent>) {
  return (
    <DialogContent className={cn('max-h-[calc(100vh-2rem)] overflow-y-auto', className)} {...props}>
      {children}
    </DialogContent>
  );
}

export function EntityDialog({
  open,
  onOpenChange,
  title,
  description,
  trigger,
  children,
  footer,
  className,
  bodyClassName,
}: EntityDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <ScrollableDialogContent className={className}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className={cn('py-4', bodyClassName)}>{children}</div>
        {footer ? <DialogFooter>{footer}</DialogFooter> : null}
      </ScrollableDialogContent>
    </Dialog>
  );
}

interface FormDialogProps extends EntityDialogProps {
  formId?: string;
  onSubmit?: React.FormEventHandler<HTMLFormElement>;
}

export function FormDialog({
  formId,
  onSubmit,
  children,
  bodyClassName,
  ...props
}: FormDialogProps) {
  return (
    <EntityDialog {...props} bodyClassName={cn('py-4', bodyClassName)}>
      <form id={formId} onSubmit={onSubmit} className="space-y-4">
        {children}
      </form>
    </EntityDialog>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  trigger?: ReactNode;
  cancelLabel: ReactNode;
  confirmLabel: ReactNode;
  onConfirm: () => void;
  confirmVariant?: ButtonProps['variant'];
  disabled?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  trigger,
  cancelLabel,
  confirmLabel,
  onConfirm,
  confirmVariant = 'default',
  disabled,
}: ConfirmDialogProps) {
  return (
    <EntityDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      trigger={trigger}
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button type="button" variant={confirmVariant} disabled={disabled} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {description ? null : <span className="sr-only">{title}</span>}
    </EntityDialog>
  );
}
