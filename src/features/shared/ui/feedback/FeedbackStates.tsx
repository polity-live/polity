import { AlertCircle, CheckCircle2, Info, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyIcon,
  EmptyTitle,
} from '@/features/shared/ui/ui/empty';
import { Spinner } from '@/features/shared/ui/ui/spinner';
import { cn } from '@/features/shared/utils/utils';

interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, icon, className }: EmptyStateProps) {
  return (
    <Empty className={className}>
      <EmptyHeader>
        {icon ? <EmptyIcon>{icon}</EmptyIcon> : null}
        <EmptyTitle>{title}</EmptyTitle>
        {description ? <EmptyDescription>{description}</EmptyDescription> : null}
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  );
}

interface LoadingStateProps {
  label?: ReactNode;
  className?: string;
}

export function LoadingState({ label = 'Loading...', className }: LoadingStateProps) {
  return (
    <div
      role="status"
      className={cn(
        'text-muted-foreground flex min-h-32 items-center justify-center gap-2 text-sm',
        className
      )}
    >
      <Spinner />
      <span>{label}</span>
    </div>
  );
}

interface ErrorStateProps {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  description,
  action,
  className,
}: ErrorStateProps) {
  return (
    <EmptyState
      className={cn('border-destructive/30 bg-destructive/5', className)}
      icon={<AlertCircle className="size-5" />}
      title={title}
      description={description}
      action={action}
    />
  );
}

const noticeVariantClasses = {
  default: 'border-border bg-muted/40 text-foreground',
  info: 'border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-100',
  success:
    'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100',
  warning:
    'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100',
  destructive:
    'border-destructive/30 bg-destructive/10 text-destructive dark:border-destructive/40',
} as const;

const noticeIcons = {
  default: Info,
  info: Info,
  success: CheckCircle2,
  warning: AlertCircle,
  destructive: XCircle,
} as const;

interface NoticeProps {
  children: ReactNode;
  title?: ReactNode;
  variant?: keyof typeof noticeVariantClasses;
  icon?: ReactNode;
  className?: string;
}

export function InlineNotice({
  children,
  title,
  variant = 'default',
  icon,
  className,
}: NoticeProps) {
  const Icon = noticeIcons[variant];

  return (
    <div
      className={cn(
        'flex gap-3 rounded-md border p-3 text-sm',
        noticeVariantClasses[variant],
        className
      )}
    >
      <div className="mt-0.5 shrink-0">{icon ?? <Icon className="size-4" />}</div>
      <div className="space-y-1">
        {title ? <p className="font-medium">{title}</p> : null}
        <div className="leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

export function ResultBanner(props: NoticeProps) {
  return <InlineNotice {...props} className={cn('items-start', props.className)} />;
}
