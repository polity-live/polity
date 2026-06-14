'use client';

import { featureThemeClassName } from '@/features/shared/theme';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import {
  RIGHT_TYPES,
  RightFilterOptionButton,
  getRightLabel,
  type RightType,
} from '@/features/shared/ui/status';

export {
  RIGHT_GRADIENTS,
  RIGHT_LABELS,
  RIGHT_TYPES,
  formatRights,
  getRightLabel,
  isEdgeVisible,
  isRightType,
  type RightType,
} from '@/features/shared/ui/status';

interface RightFiltersProps {
  selectedRights: Set<string>;
  onToggleRight: (right: string) => void;
}

export function RightFilters({ selectedRights, onToggleRight }: RightFiltersProps) {
  const { t } = useTranslation();

  const getTranslatedRightLabel = (right: RightType): string =>
    getRightLabel(right, (key, fallback) => t(key) || fallback || key);

  return (
    <div className={featureThemeClassName('networkRightFiltersThemedSurface')}>
      <h3 className="mb-2 text-sm font-semibold">{t('common.labels.filterByRights')}:</h3>
      <div className="flex flex-wrap gap-2">
        {RIGHT_TYPES.map(right => {
          const isActive = selectedRights.has(right);
          return (
            <RightFilterOptionButton
              key={right}
              right={right}
              active={isActive}
              onClick={() => onToggleRight(right)}
            >
              {getTranslatedRightLabel(right)}
            </RightFilterOptionButton>
          );
        })}
      </div>
    </div>
  );
}
