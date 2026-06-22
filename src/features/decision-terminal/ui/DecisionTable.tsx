'use client';

import { featureThemeClassName } from '@/features/shared/theme';
import { cn } from '@/features/shared/utils/utils';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { DecisionRow } from './DecisionRow';
import type { DecisionItem } from './types';

export interface DecisionTableProps {
  decisions: DecisionItem[];
  className?: string;
}

/**
 * Decision table for terminal view
 * Sortable columns, fixed header, scrollable body
 */
export function DecisionTable({ decisions, className }: DecisionTableProps) {
  const { t } = useTranslation();
  const gridColumnsClass = 'grid-cols-[70px_minmax(0,0.9fr)_120px_92px_104px_170px_72px]';

  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      {/* Table header */}
      <div className="bg-muted/95 sticky top-0 z-10 min-w-[860px] backdrop-blur">
        <div className={cn('grid gap-2 border-b px-2 py-1.5', gridColumnsClass)}>
          <div className={featureThemeClassName('decisionterminalDecisionTableThemedText')}>
            {t('features.timeline.terminal.columns.id')}
          </div>
          <div className={featureThemeClassName('decisionterminalDecisionTableThemedText')}>
            {t('features.timeline.terminal.columns.title')}
          </div>
          <div className={featureThemeClassName('decisionterminalDecisionTableThemedText')}>
            {t('features.timeline.terminal.columns.body')}
          </div>
          <div className={featureThemeClassName('decisionterminalDecisionTableThemedText')}>
            {t('features.timeline.terminal.columns.time')}
          </div>
          <div className={featureThemeClassName('decisionterminalDecisionTableThemedText')}>
            {t('features.timeline.terminal.columns.status')}
          </div>
          <div className={featureThemeClassName('decisionterminalDecisionTableThemedText')}>
            {t('features.timeline.terminal.columns.votes')}
          </div>
          <div className={featureThemeClassName('decisionterminalDecisionTableThemedText')}>
            {t('features.timeline.terminal.columns.trend')}
          </div>
        </div>
      </div>

      {/* Table body */}
      <div className="min-w-[860px] divide-y">
        {decisions.map(decision => (
          <DecisionRow key={decision.id} decision={decision} />
        ))}
      </div>
    </div>
  );
}
