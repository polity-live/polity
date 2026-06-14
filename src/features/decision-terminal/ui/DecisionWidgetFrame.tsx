'use client';

import type { ReactNode } from 'react';
import { GripHorizontal } from 'lucide-react';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { Badge } from '@/features/shared/ui/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/features/shared/ui/ui/tooltip';
import { cn } from '@/features/shared/utils/utils';

interface DecisionWidgetFrameProps {
  title: string;
  count?: number;
  children: ReactNode;
  className?: string;
}

export function DecisionWidgetFrame({
  title,
  count,
  children,
  className,
}: DecisionWidgetFrameProps) {
  return (
    <section
      className={cn(
        'bg-card flex h-full min-h-0 flex-col overflow-hidden rounded-md border shadow-sm',
        className
      )}
    >
      <div className="bg-muted/40 flex h-10 shrink-0 items-center gap-2 border-b px-2.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={translateText('generated.inline.0352_move_widget_bfba359d')}
              title={translateText('generated.inline.0352_move_widget_bfba359d')}
              className="decision-widget-drag-handle bg-background text-muted-foreground hover:text-foreground flex h-7 w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-md border active:cursor-grabbing"
              data-testid="decision-widget-drag-handle"
            >
              <GripHorizontal className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent sideOffset={6}>
            {translateText('generated.inline.0352_move_widget_bfba359d')}
          </TooltipContent>
        </Tooltip>
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</h3>
        {typeof count === 'number' ? (
          <Badge variant="secondary" className="rounded-md font-mono text-[10px]">
            {Math.round(count)}
          </Badge>
        ) : null}
      </div>
      <div className="decision-widget-content min-h-0 flex-1 overflow-auto">{children}</div>
    </section>
  );
}
