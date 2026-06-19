import type { ComponentProps, ComponentType, ReactNode } from 'react';

import { AlertCircle, Flag } from 'lucide-react';
import { Badge } from '@/features/shared/ui/ui/badge';
import {
  getBadgeToneClasses,
  getEntityToneClasses,
  getSemanticToneClasses,
  type BadgeToneKind,
  type EntityTone,
  type SemanticTone,
} from '@/features/shared/theme';
import { cn } from '@/features/shared/utils/utils';

export type BadgeTone = BadgeToneKind;

const BADGE_TONES = [
  'neutral',
  'info',
  'success',
  'warning',
  'danger',
  'destructive',
  'accent',
  'outline',
  'user',
  'group',
  'event',
  'amendment',
  'blog',
  'agenda_item',
  'vote',
  'election',
  'todo',
  'role',
] as const satisfies readonly BadgeToneKind[];

const toneClasses = Object.fromEntries(
  BADGE_TONES.map(tone => [tone, getBadgeToneClasses(tone)])
) as Record<BadgeTone, string>;

const dotToneClasses = Object.fromEntries(
  BADGE_TONES.map(tone => [tone, getBadgeDotToneClasses(tone)])
) as Record<BadgeTone, string>;

function getBadgeDotToneClasses(tone: BadgeToneKind): string {
  if (
    [
      'neutral',
      'info',
      'success',
      'warning',
      'danger',
      'destructive',
      'accent',
      'outline',
    ].includes(tone)
  ) {
    return getSemanticToneClasses(tone as SemanticTone).dot;
  }

  return getEntityToneClasses(tone as EntityTone).dot;
}

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
      className={cn(
        'gap-1 whitespace-nowrap shadow-[0_1px_0_rgb(255_255_255/0.35)]',
        toneClasses[tone],
        className
      )}
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

interface EntityBadgeProps extends StatusBadgeProps {
  entityType?: EntityTone;
}

export function EntityBadge({ entityType, className, tone, ...props }: EntityBadgeProps) {
  return (
    <StatusBadge
      tone={tone ?? 'info'}
      className={cn(entityType && getEntityToneClasses(entityType).badge, className)}
      {...props}
    />
  );
}

export function RoleBadge(props: StatusBadgeProps) {
  return <StatusBadge tone={props.tone ?? 'neutral'} {...props} />;
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
      ? getSemanticToneClasses('danger').text
      : normalizedValue === 'medium'
        ? getSemanticToneClasses('warning').text
        : getSemanticToneClasses('info').text;

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
  infoStrong: getBadgeToneClasses('info'),
  successStrong: 'border-transparent bg-success text-success-foreground',
  successSoft: getBadgeToneClasses('success'),
  successTint: getBadgeToneClasses('success'),
  mutedContrast: 'border-muted bg-muted/50 text-foreground hover:opacity-100',
  successPale: getBadgeToneClasses('success'),
  dangerPale: getBadgeToneClasses('danger'),
  warningPale: getBadgeToneClasses('warning'),
  skyTint: getBadgeToneClasses('info'),
  emeraldTint: getBadgeToneClasses('success'),
  gradientSuccess: getBadgeToneClasses('success'),
  gradientNeutral:
    'border-[var(--badge-neutral-border)] bg-[var(--badge-neutral-bg)] text-[var(--badge-neutral-fg)]',
  gradientInfo: getBadgeToneClasses('info'),
};

const badgeControlToneHoverClasses: Record<BadgeControlTone, string> = {
  neutral: 'hover:bg-[var(--badge-neutral-bg)] hover:text-[var(--badge-neutral-fg)]',
  info: 'hover:bg-[var(--badge-info-bg)] hover:text-[var(--badge-info-fg)]',
  success: 'hover:bg-[var(--badge-success-bg)] hover:text-[var(--badge-success-fg)]',
  warning: 'hover:bg-[var(--badge-warning-bg)] hover:text-[var(--badge-warning-fg)]',
  danger: 'hover:bg-[var(--badge-danger-bg)] hover:text-[var(--badge-danger-fg)]',
  destructive: 'hover:bg-[var(--badge-danger-bg)] hover:text-[var(--badge-danger-fg)]',
  accent: 'hover:bg-[var(--badge-accent-bg)] hover:text-[var(--badge-accent-fg)]',
  outline: 'hover:bg-accent/60 hover:text-accent-foreground',
  user: 'hover:bg-[var(--entity-user-bg)] hover:text-[var(--entity-user-fg)]',
  group: 'hover:bg-[var(--entity-group-bg)] hover:text-[var(--entity-group-fg)]',
  event: 'hover:bg-[var(--entity-event-bg)] hover:text-[var(--entity-event-fg)]',
  amendment: 'hover:bg-[var(--entity-amendment-bg)] hover:text-[var(--entity-amendment-fg)]',
  blog: 'hover:bg-[var(--entity-blog-bg)] hover:text-[var(--entity-blog-fg)]',
  agenda_item: 'hover:bg-[var(--badge-info-bg)] hover:text-[var(--badge-info-fg)]',
  vote: 'hover:bg-[var(--badge-danger-bg)] hover:text-[var(--badge-danger-fg)]',
  election: 'hover:bg-[var(--badge-accent-bg)] hover:text-[var(--badge-accent-fg)]',
  todo: 'hover:bg-[var(--badge-success-bg)] hover:text-[var(--badge-success-fg)]',
  role: 'hover:bg-[var(--badge-neutral-bg)] hover:text-[var(--badge-neutral-fg)]',
  primary: 'hover:bg-primary/90 hover:text-primary-foreground',
  infoStrong: 'hover:bg-[var(--badge-info-bg)] hover:text-[var(--badge-info-fg)]',
  successStrong: 'hover:bg-success hover:text-success-foreground',
  successSoft: 'hover:bg-[var(--badge-success-bg)] hover:text-[var(--badge-success-fg)]',
  successTint: 'hover:bg-[var(--badge-success-bg)] hover:text-[var(--badge-success-fg)]',
  mutedContrast: 'hover:bg-muted/50 hover:text-foreground hover:opacity-100',
  successPale: 'hover:bg-[var(--badge-success-bg)] hover:text-[var(--badge-success-fg)]',
  dangerPale: 'hover:bg-[var(--badge-danger-bg)] hover:text-[var(--badge-danger-fg)]',
  warningPale: 'hover:bg-[var(--badge-warning-bg)] hover:text-[var(--badge-warning-fg)]',
  skyTint: 'hover:bg-[var(--badge-info-bg)] hover:text-[var(--badge-info-fg)]',
  emeraldTint: 'hover:bg-[var(--badge-success-bg)] hover:text-[var(--badge-success-fg)]',
  gradientSuccess: 'hover:bg-[var(--badge-success-bg)] hover:text-[var(--badge-success-fg)]',
  gradientNeutral: 'hover:bg-[var(--badge-neutral-bg)] hover:text-[var(--badge-neutral-fg)]',
  gradientInfo: 'hover:bg-[var(--badge-info-bg)] hover:text-[var(--badge-info-fg)]',
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
        tone && badgeControlToneHoverClasses[tone],
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
