'use client';

import type { CSSProperties } from 'react';
import { CheckCircle2, GitPullRequest, PencilLine, Vote } from 'lucide-react';

import { cn } from '@/features/shared/utils/utils';

export type ChangeRequestSummaryItemVariant = 'compact' | 'preview' | 'trigger';

export interface ChangeRequestSummaryItemProps {
  identifier: string;
  title: string;
  description?: string | null;
  status?: string | null;
  changeType?: string | null;
  selected?: boolean;
  interactive?: boolean;
  motionDelayMs?: number;
  variant?: ChangeRequestSummaryItemVariant;
  className?: string;
  onClick?: () => void;
}

function getChangeTypeSwatchClass(changeType?: string | null) {
  switch (changeType) {
    case 'insert':
    case 'add':
      return 'bg-[var(--badge-success-border)]';
    case 'remove':
    case 'delete':
      return 'bg-[var(--badge-danger-border)]';
    case 'replace':
    case 'update':
      return 'bg-[var(--badge-info-border)]';
    case 'final':
      return 'bg-[var(--badge-accent-border)]';
    default:
      return 'bg-border';
  }
}

function getChangeRequestIcon(changeType?: string | null, status?: string | null) {
  if (status === 'completed') {
    return CheckCircle2;
  }

  if (changeType === 'final') {
    return Vote;
  }

  if (changeType === 'insert' || changeType === 'add') {
    return GitPullRequest;
  }

  return PencilLine;
}

export function ChangeRequestSummaryItem({
  identifier,
  title,
  description,
  status,
  changeType,
  selected,
  interactive,
  motionDelayMs,
  variant = 'compact',
  className,
  onClick,
}: ChangeRequestSummaryItemProps) {
  const Icon = getChangeRequestIcon(changeType, status);
  const isPreview = variant === 'preview';
  const isTrigger = variant === 'trigger';
  const shouldRenderAsButton = Boolean(onClick);
  const style: CSSProperties | undefined =
    motionDelayMs === undefined ? undefined : { animationDelay: `${motionDelayMs}ms` };

  const content = (
    <>
      <span
        className={cn(
          'landing-amendment-request-swatch h-8 w-1.5 shrink-0 rounded-full',
          getChangeTypeSwatchClass(changeType)
        )}
      />
      <span
        className={cn(
          'landing-amendment-request-icon bg-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-md border',
          selected && 'border-primary/40 bg-primary/10 text-primary'
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-muted-foreground block font-mono text-[11px] leading-none">
          {identifier}
        </span>
        <span
          className={cn(
            'block truncate font-medium',
            isPreview ? 'text-sm' : isTrigger ? 'text-sm sm:text-base' : 'text-sm'
          )}
        >
          {title}
        </span>
        {description && !isPreview ? (
          <span className="text-muted-foreground mt-0.5 block truncate text-xs">{description}</span>
        ) : null}
      </span>
    </>
  );

  const classes = cn(
    'flex min-w-0 items-center gap-3 rounded-md border px-3 py-2 shadow-sm',
    isPreview ? 'landing-amendment-request-chip bg-background/85' : 'bg-card/85 border-border/70',
    isTrigger && 'w-full border-transparent bg-transparent px-0 py-0 text-left shadow-none',
    selected && !isTrigger && 'border-primary/50 bg-primary/5',
    (interactive || shouldRenderAsButton) &&
      'cursor-pointer transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    className
  );

  if (shouldRenderAsButton) {
    return (
      <button
        type="button"
        className={classes}
        data-change-type={changeType ?? undefined}
        data-selected={selected ? 'true' : undefined}
        style={style}
        onClick={onClick}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      className={classes}
      data-change-type={changeType ?? undefined}
      data-selected={selected ? 'true' : undefined}
      style={style}
    >
      {content}
    </div>
  );
}
