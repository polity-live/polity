'use client';

import { FormControlInput } from '@/features/shared/ui/form';
import { RotateCcw, Search } from 'lucide-react';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { Button } from '@/features/shared/ui/ui/button';
import { cn } from '@/features/shared/utils/utils';

interface DecisionDashboardHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onResetLayout: () => void;
  urgentCount: number;
  activeCount: number;
  className?: string;
}

export function DecisionDashboardHeader({
  searchQuery,
  onSearchChange,
  onResetLayout,
  urgentCount,
  activeCount,
  className,
}: DecisionDashboardHeaderProps) {
  return (
    <header className={cn('pb-2', className)}>
      <div className="flex flex-col gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className="font-sans text-sm font-medium">
            {translateText('generated.inline.0340_decision_terminal_22b93bd0')}
          </h2>
          <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
            <span>
              {Math.round(activeCount)} {translateText('generated.inline.0045_active_2bb6b986')}
            </span>
            <span className={urgentCount > 0 ? 'text-destructive font-medium' : ''}>
              {Math.round(urgentCount)} {translateText('generated.inline.0046_urgent_8d0cdea0')}
            </span>
          </div>
        </div>

        <div className="flex flex-nowrap items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
            <FormControlInput
              value={searchQuery}
              onChange={event => onSearchChange(event.target.value)}
              aria-label={translateText('generated.inline.0341_search_decisions_b5f1fd2e')}
              placeholder={translateText('generated.inline.0341_search_decisions_b5f1fd2e')}
              className="bg-background h-9 rounded-md pl-8"
            />
          </div>
          <Button
            data-action-id="decision-terminal.dashboard.layout.reset"
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-md"
            onClick={onResetLayout}
            data-testid="decision-terminal-reset-layout"
            aria-label={translateText('generated.inline.reset_decision_terminal_layout_9adf66a5')}
            title={translateText('generated.inline.reset_layout_6a5f607c')}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
