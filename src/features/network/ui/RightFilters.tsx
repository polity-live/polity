'use client';

import { Button } from '@/features/shared/ui/ui/button';
import { cn } from '@/features/shared/utils/utils';
import { useTranslation } from '@/features/shared/hooks/use-translation';

export const RIGHT_TYPES = [
  'informationRight',
  'amendmentRight',
  'rightToSpeak',
  'activeVotingRight',
  'passiveVotingRight',
] as const;

export type RightType = (typeof RIGHT_TYPES)[number];

// Translation keys mapping
const RIGHT_TRANSLATION_KEYS: Record<RightType, string> = {
  informationRight: 'common.rights.information',
  amendmentRight: 'common.rights.amendment',
  rightToSpeak: 'common.rights.speak',
  activeVotingRight: 'common.rights.activeVoting',
  passiveVotingRight: 'common.rights.passiveVoting',
};

// Fallback labels (used for non-hook contexts)
export const RIGHT_LABELS: Record<RightType, string> = {
  informationRight: 'Info',
  amendmentRight: 'Antrag',
  rightToSpeak: 'Rede',
  activeVotingRight: 'Aktiv',
  passiveVotingRight: 'Passiv',
};

export function isRightType(right: string): right is RightType {
  return RIGHT_TYPES.includes(right as RightType);
}

type RightLabelTranslateFn = (key: string, fallback?: string) => string;

export function getRightLabel(right: string, t?: RightLabelTranslateFn): string {
  if (!isRightType(right)) {
    return right;
  }

  const fallback = RIGHT_LABELS[right];
  if (!t) {
    return fallback;
  }

  return t(RIGHT_TRANSLATION_KEYS[right], fallback) || fallback;
}

export function formatRights(rights: string[], t?: RightLabelTranslateFn): string {
  return rights.map(right => getRightLabel(right, t)).join(', ');
}

export function isEdgeVisible(edgeRights: string[], selectedRights: Set<string>): boolean {
  return edgeRights.some(right => selectedRights.has(right));
}

/** Deterministic gradient classes for each right type — shared with RightBadge */
export const RIGHT_GRADIENTS: Record<RightType, string> = {
  informationRight:
    'bg-gradient-to-r from-blue-500 to-cyan-400 dark:from-blue-700 dark:to-cyan-600',
  amendmentRight:
    'bg-gradient-to-r from-violet-500 to-purple-400 dark:from-violet-700 dark:to-purple-600',
  rightToSpeak:
    'bg-gradient-to-r from-teal-500 to-emerald-400 dark:from-teal-700 dark:to-emerald-600',
  activeVotingRight:
    'bg-gradient-to-r from-orange-500 to-red-400 dark:from-orange-700 dark:to-red-600',
  passiveVotingRight:
    'bg-gradient-to-r from-pink-500 to-rose-400 dark:from-pink-700 dark:to-rose-600',
};

interface RightFiltersProps {
  selectedRights: Set<string>;
  onToggleRight: (right: string) => void;
}

export function RightFilters({ selectedRights, onToggleRight }: RightFiltersProps) {
  const { t } = useTranslation();

  const getTranslatedRightLabel = (right: RightType): string =>
    getRightLabel(right, (key, fallback) => t(key) || fallback || key);

  return (
    <div className="border-border/70 bg-background/95 dark:bg-card/95 mt-4 rounded-lg border p-3 shadow-sm">
      <h3 className="mb-2 text-sm font-semibold">{t('common.labels.filterByRights')}:</h3>
      <div className="flex flex-wrap gap-2">
        {RIGHT_TYPES.map(right => {
          const isActive = selectedRights.has(right);
          return (
            <Button
              key={right}
              size="sm"
              variant="outline"
              onClick={() => onToggleRight(right)}
              className={cn(
                'text-xs',
                isActive
                  ? `${RIGHT_GRADIENTS[right]} border-0 text-white hover:text-white`
                  : 'border-border bg-background/90 text-foreground hover:bg-accent hover:text-accent-foreground dark:bg-card/90 dark:text-foreground'
              )}
            >
              {getTranslatedRightLabel(right)}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
