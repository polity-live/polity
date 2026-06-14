'use client';

import { LayoutDashboard, RotateCcw, Search } from 'lucide-react';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { Button } from '@/features/shared/ui/ui/button';
import { Input } from '@/features/shared/ui/ui/input';
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
    <header className={cn('bg-card border-b', className)}>
      <div className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="bg-background flex h-10 w-10 items-center justify-center rounded-md border">
            <LayoutDashboard className="text-primary h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold">
              {translateText('generated.inline.0340_decision_terminal_22b93bd0')}
            </h2>
            <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-3 text-xs">
              <span>
                {Math.round(activeCount)}
                {translateText('generated.inline.0045_active_2bb6b986')}
              </span>
              <span className={urgentCount > 0 ? 'text-destructive font-medium' : ''}>
                {Math.round(urgentCount)}
                {translateText('generated.inline.0046_urgent_8d0cdea0')}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1 sm:flex-none">
            <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
            <Input
              value={searchQuery}
              onChange={event => onSearchChange(event.target.value)}
              placeholder={translateText('generated.inline.0341_search_decisions_b5f1fd2e')}
              className="bg-background h-9 rounded-md pl-8"
            />
          </div>
          <Button
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
