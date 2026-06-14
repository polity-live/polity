import { type ComponentProps, type FormEventHandler, type ReactNode } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/features/shared/ui/ui/alert-dialog';
import { Button, type ButtonProps } from '@/features/shared/ui/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/features/shared/ui/ui/dialog';
import { SheetContent } from '@/features/shared/ui/ui/sheet';
import { cn } from '@/features/shared/utils/utils';

const dialogShellSizeClassNames = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
  '2xl': 'sm:max-w-2xl',
  full: 'sm:max-w-[calc(100vw-2rem)]',
} as const;

export interface DialogShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  trigger?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: keyof typeof dialogShellSizeClassNames;
  scrollable?: boolean;
  className?: string;
  bodyClassName?: string;
}

export function ScrollableDialogContent({
  className,
  children,
  ...props
}: ComponentProps<typeof DialogContent>) {
  return (
    <DialogContent className={cn('max-h-[calc(100vh-2rem)] overflow-y-auto', className)} {...props}>
      {children}
    </DialogContent>
  );
}

export function ScrollableAlertDialogContent({
  className,
  children,
  ...props
}: ComponentProps<typeof AlertDialogContent>) {
  return (
    <AlertDialogContent
      className={cn('max-h-[calc(100vh-2rem)] overflow-y-auto', className)}
      {...props}
    >
      {children}
    </AlertDialogContent>
  );
}

export function ScrollableSheetContent({
  className,
  children,
  ...props
}: ComponentProps<typeof SheetContent>) {
  return (
    <SheetContent className={cn('max-h-screen overflow-y-auto', className)} {...props}>
      {children}
    </SheetContent>
  );
}

export function DialogShell({
  open,
  onOpenChange,
  title,
  description,
  trigger,
  children,
  footer,
  size = 'lg',
  scrollable = true,
  className,
  bodyClassName,
}: DialogShellProps) {
  const Content = scrollable ? ScrollableDialogContent : DialogContent;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <Content className={cn(dialogShellSizeClassNames[size], className)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className={cn('py-4', bodyClassName)}>{children}</div>
        {footer ? <DialogFooter>{footer}</DialogFooter> : null}
      </Content>
    </Dialog>
  );
}

export function EntityDialog(props: DialogShellProps) {
  return <DialogShell {...props} />;
}

interface FormDialogProps extends DialogShellProps {
  formId?: string;
  onSubmit?: FormEventHandler<HTMLFormElement>;
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
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
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
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger> : null}
      <ScrollableAlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={disabled}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button type="button" variant={confirmVariant} disabled={disabled} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </ScrollableAlertDialogContent>
    </AlertDialog>
  );
}

export function DangerConfirmDialog(props: Omit<ConfirmDialogProps, 'confirmVariant'>) {
  return <ConfirmDialog {...props} confirmVariant="destructive" />;
}

interface SelectionDialogOption {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}

interface SelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  trigger?: ReactNode;
  options: SelectionDialogOption[];
  selectedValue?: string | null;
  onSelect: (value: string) => void;
  footer?: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function SelectionDialog({
  options,
  selectedValue,
  onSelect,
  bodyClassName,
  ...props
}: SelectionDialogProps) {
  return (
    <EntityDialog {...props} bodyClassName={cn('grid gap-2', bodyClassName)}>
      {options.map(option => {
        const isSelected = option.value === selectedValue;

        return (
          <button
            key={option.value}
            type="button"
            disabled={option.disabled}
            className={cn(
              'flex w-full flex-col gap-1 rounded-md border p-3 text-left text-sm transition-colors',
              isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
              option.disabled && 'cursor-not-allowed opacity-50'
            )}
            onClick={() => onSelect(option.value)}
          >
            <span className="font-medium">{option.label}</span>
            {option.description ? (
              <span className="text-muted-foreground text-xs">{option.description}</span>
            ) : null}
          </button>
        );
      })}
    </EntityDialog>
  );
}
