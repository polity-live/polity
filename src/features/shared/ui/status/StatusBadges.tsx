import type { ComponentProps, ComponentType, ReactNode } from 'react';

import { AlertCircle, Flag } from 'lucide-react';
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

const dotToneClasses: Record<BadgeTone, string> = {
  neutral: 'bg-muted-foreground',
  info: 'bg-sky-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  destructive: 'bg-destructive',
  accent: 'bg-primary',
  outline: 'bg-muted-foreground',
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

interface PriorityBadgeProps extends NamedBadgeProps {
  showIcon?: boolean;
}

export function PriorityIcon({ value, className }: { value?: string | null; className?: string }) {
  const normalizedValue = String(value ?? '').toLowerCase();
  const Icon = normalizedValue === 'urgent' ? AlertCircle : Flag;
  const colorClass =
    normalizedValue === 'urgent' || normalizedValue === 'high'
      ? 'text-destructive'
      : normalizedValue === 'medium'
        ? 'text-amber-500'
        : 'text-sky-500';

  return <Icon className={cn('mr-1 h-3.5 w-3.5', colorClass, className)} />;
}

export function PriorityBadge({
  value,
  tone,
  children,
  showIcon = false,
  ...props
}: PriorityBadgeProps) {
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
      {showIcon ? <PriorityIcon value={value} /> : null}
      {children}
    </StatusBadge>
  );
}

export function TodoPriorityBadge({
  priority,
  showIcon = false,
}: {
  priority: string;
  showIcon?: boolean;
}) {
  return (
    <PriorityBadge value={priority} showIcon={showIcon}>
      {priority}
    </PriorityBadge>
  );
}

export function TodoPriorityIcon({ priority }: { priority: string }) {
  return <PriorityIcon value={priority} />;
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
  dotTone?: BadgeTone;
  pulse?: boolean;
}

export function StatusBadgeWithDot({
  children,
  dotClassName,
  dotTone,
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
      <span
        className={cn(
          'mr-1 h-1.5 w-1.5 rounded-full',
          dotTone && dotToneClasses[dotTone],
          dotClassName
        )}
      />
      {children}
    </StatusBadge>
  );
}

export function StatusDotIndicator({
  tone = 'neutral',
  pulse = false,
  className,
  title,
}: {
  tone?: BadgeTone;
  pulse?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <span
      className={cn(
        'border-background inline-flex h-2 w-2 items-center justify-center rounded-full border',
        dotToneClasses[tone],
        pulse && 'animate-pulse',
        className
      )}
      title={title}
    />
  );
}

interface SemanticBadgeProps extends Omit<StatusBadgeProps, 'children'> {
  label: ReactNode;
  Icon?: ComponentType<{ className?: string }>;
  leading?: ReactNode;
  size?: 'xs' | 'sm' | 'md';
  strong?: boolean;
  uppercase?: boolean;
  pulse?: boolean;
}

export function SemanticBadge({
  label,
  Icon,
  leading,
  size = 'xs',
  strong = true,
  uppercase = true,
  pulse = false,
  className,
  ...props
}: SemanticBadgeProps) {
  return (
    <StatusBadge
      className={cn(
        'max-w-full rounded-md tracking-wide',
        size === 'xs' && 'px-2 py-0.5 text-[11px]',
        size === 'sm' && 'px-2 py-0.5 text-xs',
        size === 'md' && 'px-2.5 py-1 text-sm',
        strong && 'font-mono font-bold',
        uppercase && 'uppercase',
        pulse && 'animate-pulse',
        className
      )}
      {...props}
    >
      {leading ? <span className="mr-1">{leading}</span> : null}
      {Icon ? <Icon className="mr-1 h-3.5 w-3.5" /> : null}
      <span className="truncate">{label}</span>
    </StatusBadge>
  );
}

export function StatusPillFrame({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'inline-flex rounded-xl border px-3 py-2 shadow-sm',
        toneClasses[tone],
        className
      )}
    >
      {children}
    </div>
  );
}

export type BadgeControlTone =
  | BadgeTone
  | 'primary'
  | 'infoStrong'
  | 'successStrong'
  | 'successSoft'
  | 'successTint'
  | 'mutedContrast'
  | 'successPale'
  | 'dangerPale'
  | 'warningPale'
  | 'skyTint'
  | 'emeraldTint'
  | 'gradientSuccess'
  | 'gradientNeutral'
  | 'gradientInfo';

const badgeControlToneClasses: Record<BadgeControlTone, string> = {
  ...toneClasses,
  primary: 'border-transparent bg-primary text-primary-foreground',
  infoStrong: 'border-transparent bg-blue-500 text-white',
  successStrong: 'border-transparent bg-green-600 text-white',
  successSoft: 'bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-200',
  successTint: 'border-transparent bg-green-500/15 text-green-700 dark:text-green-400',
  mutedContrast: 'border-muted bg-muted/50 text-foreground hover:opacity-100',
  successPale: 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-50',
  dangerPale: 'border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-50',
  warningPale: 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50',
  skyTint: 'border-0 bg-sky-500/15 text-sky-700 dark:text-sky-300',
  emeraldTint: 'border-0 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  gradientSuccess:
    'border-0 bg-gradient-to-r from-emerald-500/20 via-green-500/20 to-lime-500/20 text-emerald-800 dark:text-emerald-200',
  gradientNeutral:
    'border-0 bg-gradient-to-r from-slate-500/20 via-zinc-500/20 to-stone-500/20 text-slate-800 dark:text-slate-200',
  gradientInfo:
    'border-0 bg-gradient-to-r from-cyan-500/20 via-sky-500/20 to-blue-500/20 text-sky-800 dark:text-sky-200',
};

interface BadgeControlProps extends ComponentProps<typeof Badge> {
  tone?: BadgeControlTone;
  size?: 'default' | 'tiny' | 'xs' | 'sm' | 'md' | 'dot';
  shape?: 'pill' | 'rounded';
  textStyle?: 'default' | 'mono';
  textTransform?: 'none' | 'uppercase' | 'capitalize';
  pulse?: boolean;
  borderStyle?: 'default' | 'dashed';
}

export function BadgeControl({
  tone,
  size = 'default',
  shape = 'pill',
  textStyle = 'default',
  textTransform = 'none',
  pulse = false,
  borderStyle = 'default',
  className,
  ...props
}: BadgeControlProps) {
  return (
    <Badge
      data-slot="badge-control"
      className={cn(
        tone && badgeControlToneClasses[tone],
        size === 'tiny' && 'text-[10px]',
        size === 'xs' && 'text-xs',
        size === 'sm' && 'text-sm',
        size === 'md' && 'px-4 py-2 text-base',
        size === 'dot' && 'h-2 w-2 rounded-full p-0',
        shape === 'rounded' && 'rounded-md',
        textStyle === 'mono' && 'font-mono',
        textTransform === 'uppercase' && 'uppercase',
        textTransform === 'capitalize' && 'capitalize',
        pulse && 'animate-pulse',
        borderStyle === 'dashed' && 'border-dashed',
        className
      )}
      {...props}
    />
  );
}
