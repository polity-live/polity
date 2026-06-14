import type { ComponentProps, ReactNode } from 'react';

import { Badge } from '@/features/shared/ui/ui/badge';
import { cn } from '@/features/shared/utils/utils';

export type BadgeTone =
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'destructive'
  | 'accent'
  | 'outline';

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'border-transparent bg-muted text-muted-foreground',
  info: 'border-transparent bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100',
  success:
    'border-transparent bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100',
  warning:
    'border-transparent bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100',
  destructive: 'border-transparent bg-destructive/10 text-destructive dark:bg-destructive/20',
  accent: 'border-transparent bg-primary/10 text-primary',
  outline: 'bg-background text-foreground',
};

function statusTone(status: string | null | undefined): BadgeTone {
  const value = String(status ?? '').toLowerCase();

  if (
    ['active', 'approved', 'accepted', 'completed', 'confirmed', 'success', 'paid'].includes(value)
  ) {
    return 'success';
  }

  if (['pending', 'draft', 'scheduled', 'invited', 'waiting', 'open'].includes(value)) {
    return 'warning';
  }

  if (
    ['failed', 'rejected', 'declined', 'cancelled', 'canceled', 'inactive', 'error'].includes(value)
  ) {
    return 'destructive';
  }

  if (['public', 'published', 'visible', 'live'].includes(value)) {
    return 'info';
  }

  return 'neutral';
}

interface BaseStatusBadgeProps extends Omit<ComponentProps<typeof Badge>, 'children'> {
  children: ReactNode;
  tone?: BadgeTone;
}

function BaseStatusBadge({
  children,
  tone = 'neutral',
  className,
  ...props
}: BaseStatusBadgeProps) {
  return (
    <Badge
      variant={tone === 'outline' ? 'outline' : 'secondary'}
      className={cn('gap-1 whitespace-nowrap', toneClasses[tone], className)}
      {...props}
    >
      {children}
    </Badge>
  );
}

interface StatusBadgeProps extends Omit<BaseStatusBadgeProps, 'tone'> {
  status?: string | null;
  tone?: BadgeTone;
}

export function StatusBadge({ status, tone, children, ...props }: StatusBadgeProps) {
  return (
    <BaseStatusBadge tone={tone ?? statusTone(status)} {...props}>
      {children}
    </BaseStatusBadge>
  );
}

export function EntityBadge(props: StatusBadgeProps) {
  return <StatusBadge tone={props.tone ?? 'info'} {...props} />;
}

export function RoleBadge(props: StatusBadgeProps) {
  return <StatusBadge tone={props.tone ?? 'accent'} {...props} />;
}

interface CountBadgeProps extends Omit<BaseStatusBadgeProps, 'children'> {
  count: number | string;
  label?: ReactNode;
}

export function CountBadge({ count, label, tone = 'neutral', ...props }: CountBadgeProps) {
  return (
    <BaseStatusBadge tone={tone} {...props}>
      <span>{count}</span>
      {label ? <span className="text-current/75">{label}</span> : null}
    </BaseStatusBadge>
  );
}

interface NamedBadgeProps extends Omit<StatusBadgeProps, 'status'> {
  value?: string | null;
}

export function VisibilityBadge({ value, tone, children, ...props }: NamedBadgeProps) {
  return (
    <StatusBadge
      status={value}
      tone={tone ?? (value === 'private' ? 'warning' : 'info')}
      {...props}
    >
      {children}
    </StatusBadge>
  );
}

export function PhaseBadge({ value, tone, children, ...props }: NamedBadgeProps) {
  return (
    <StatusBadge status={value} tone={tone ?? statusTone(value)} {...props}>
      {children}
    </StatusBadge>
  );
}

export function PriorityBadge({ value, tone, children, ...props }: NamedBadgeProps) {
  const normalizedValue = String(value ?? '').toLowerCase();
  const priorityTone =
    tone ??
    (normalizedValue === 'high' || normalizedValue === 'urgent'
      ? 'destructive'
      : normalizedValue === 'medium'
        ? 'warning'
        : 'neutral');

  return (
    <StatusBadge status={value} tone={priorityTone} {...props}>
      {children}
    </StatusBadge>
  );
}

function relationshipTone(value: string | null | undefined): BadgeTone {
  const normalized = String(value ?? '').toLowerCase();

  if (['parent', 'incoming', 'final'].includes(normalized)) {
    return 'success';
  }

  if (['child', 'outgoing', 'start'].includes(normalized)) {
    return 'info';
  }

  if (['sibling', 'co-owner', 'co_owner'].includes(normalized)) {
    return 'accent';
  }

  return 'outline';
}

export function RelationshipBadge({ value, tone, children, ...props }: NamedBadgeProps) {
  return (
    <StatusBadge status={value} tone={tone ?? relationshipTone(value)} {...props}>
      {children}
    </StatusBadge>
  );
}

interface RightBadgeBaseProps extends Omit<StatusBadgeProps, 'status'> {
  right?: string | null;
}

export function RightBadgeBase({ right, tone, children, ...props }: RightBadgeBaseProps) {
  return (
    <StatusBadge status={right} tone={tone ?? 'accent'} {...props}>
      {children ?? right}
    </StatusBadge>
  );
}

export function TokenBadge(props: StatusBadgeProps) {
  return <StatusBadge tone={props.tone ?? 'outline'} {...props} />;
}

export function StateBadge(props: StatusBadgeProps) {
  return <StatusBadge tone={props.tone ?? statusTone(props.status)} {...props} />;
}

interface StatusBadgeWithDotProps extends Omit<StatusBadgeProps, 'children'> {
  children: ReactNode;
  dotClassName?: string;
  pulse?: boolean;
}

export function StatusBadgeWithDot({
  children,
  dotClassName,
  pulse = false,
  className,
  ...props
}: StatusBadgeWithDotProps) {
  return (
    <StatusBadge
      className={cn(
        'font-mono text-xs font-bold tracking-wide uppercase',
        pulse && 'animate-pulse',
        className
      )}
      {...props}
    >
      <span className={cn('mr-1 h-1.5 w-1.5 rounded-full', dotClassName)} />
      {children}
    </StatusBadge>
  );
}

export function BadgeControl(props: ComponentProps<typeof Badge>) {
  return <Badge data-slot="badge-control" {...props} />;
}
