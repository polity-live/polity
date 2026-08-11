import { Info } from 'lucide-react';

import { Button } from '@/features/shared/ui/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/features/shared/ui/ui/tooltip';
import { cn } from '@/features/shared/utils/utils';

import type { getReasonConfig } from '../../logic/reasonDisplay';

interface ReasonTooltipViewProps {
  className?: string;
  config: ReturnType<typeof getReasonConfig>;
  open: boolean;
  reasonText: string;
  whySeeingLabel: string;
  onOpenChange: (open: boolean) => void;
  onTriggerClick: () => void;
}

export function ReasonTooltipView({
  className,
  config,
  open,
  reasonText,
  whySeeingLabel,
  onOpenChange,
  onTriggerClick,
}: ReasonTooltipViewProps) {
  const Icon = config.Icon;

  return (
    <TooltipProvider>
      <Tooltip open={open} onOpenChange={onOpenChange}>
        <TooltipTrigger asChild>
          <Button
            data-action-id="timeline.reason.open"
            data-action-kind="selection"
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              'h-auto w-auto rounded-md p-1 transition-colors',
              'hover:bg-muted focus:ring-ring focus:ring-2 focus:outline-none',
              className
            )}
            onClick={event => {
              event.stopPropagation();
              onTriggerClick();
            }}
            aria-label={whySeeingLabel}
          >
            <Info className="text-muted-foreground h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" variant="rich">
          <div className="flex items-center gap-2">
            <Icon className={cn('h-4 w-4', config.colorClass)} />
            <span className="text-sm">{reasonText}</span>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
