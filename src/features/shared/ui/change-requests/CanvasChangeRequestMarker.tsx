import type { CSSProperties } from 'react';
import { TooltipHint } from '@/features/shared/ui/ui/tooltip';
import { cn } from '@/features/shared/utils/utils';

export type CanvasChangeRequestTone = 'add' | 'remove' | 'update' | 'neutral';

export function getChangeRequestMarkerClassName(tone: CanvasChangeRequestTone) {
  switch (tone) {
    case 'add':
      return 'border-[var(--badge-success-border)] bg-[var(--badge-success-bg)] text-[var(--badge-success-fg)]';
    case 'remove':
      return 'border-dashed border-[var(--badge-danger-border)] bg-[var(--badge-danger-bg)] text-[var(--badge-danger-fg)]';
    case 'update':
      return 'border-[var(--badge-info-border)] bg-[var(--badge-info-bg)] text-[var(--badge-info-fg)]';
    default:
      return 'border-border bg-background/90 text-foreground';
  }
}

export function CanvasChangeRequestMarker({
  actionId,
  displayId,
  label,
  title,
  tone,
  selected,
  style,
  testId,
  positioningClassName = '-translate-x-1/2 -translate-y-1/2',
  onSelect,
}: {
  actionId: string;
  displayId: string;
  label: string;
  title: string;
  tone: CanvasChangeRequestTone;
  selected: boolean;
  style: CSSProperties;
  testId?: string;
  positioningClassName?: string;
  onSelect: () => void;
}) {
  return (
    <TooltipHint content={label}>
      <button
        data-action-id={actionId}
        type="button"
        className={cn(
          'focus-visible:ring-ring pointer-events-auto absolute flex min-h-8 max-w-52 items-center gap-2 rounded-md border px-2.5 py-1 text-xs font-semibold shadow-lg backdrop-blur transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:outline-none',
          positioningClassName,
          getChangeRequestMarkerClassName(tone),
          selected && 'ring-ring ring-2'
        )}
        style={style}
        data-testid={testId}
        data-change-request-tone={tone}
        aria-label={label}
        aria-pressed={selected}
        onPointerDown={event => event.stopPropagation()}
        onClick={event => {
          event.stopPropagation();
          onSelect();
        }}
      >
        <span className="font-mono text-[11px]">{displayId}</span>
        <span
          className={cn(
            'size-3 flex-none rounded-full border',
            tone === 'remove' && 'border-dashed',
            tone === 'update' && 'ring-2 ring-current/30'
          )}
        />
        <span className="min-w-0 truncate">{title}</span>
      </button>
    </TooltipHint>
  );
}
