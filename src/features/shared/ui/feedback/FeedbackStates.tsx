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
import { getBadgeToneClasses } from '@/features/shared/theme';
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
      className={cn(getBadgeToneClasses('danger'), className)}
      icon={<AlertCircle className="size-5" />}
      title={title}
      description={description}
      action={action}
    />
  );
}

const noticeVariantClasses = {
  default: 'border-border bg-[var(--surface)] text-foreground',
  info: getBadgeToneClasses('info'),
  success: getBadgeToneClasses('success'),
  warning: getBadgeToneClasses('warning'),
  destructive: getBadgeToneClasses('danger'),
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
