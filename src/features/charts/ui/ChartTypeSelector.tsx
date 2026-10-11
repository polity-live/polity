import { AreaChartIcon, BarChart3Icon, LineChartIcon, PieChartIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ToggleGroup, ToggleGroupItem } from '@/features/shared/ui/ui/toggle-group';
import type { ChartType } from '../types';

export function ChartTypeSelector({
  value,
  onValueChange,
  pieDisabled = false,
}: {
  value: ChartType;
  onValueChange: (value: ChartType) => void;
  pieDisabled?: boolean;
}) {
  const { t } = useTranslation();
  const options = [
    { value: 'bar', icon: <BarChart3Icon />, label: t('plateJs.chart.bar') },
    { value: 'line', icon: <LineChartIcon />, label: t('plateJs.chart.line') },
    { value: 'area', icon: <AreaChartIcon />, label: t('plateJs.chart.area') },
    { value: 'pie', icon: <PieChartIcon />, label: t('plateJs.chart.pie') },
  ] satisfies { value: ChartType; icon: ReactNode; label: string }[];

  return (
    <div>
      <p className="mb-2 text-sm font-medium">{t('plateJs.dataView.chartType')}</p>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={next => next && onValueChange(next as ChartType)}
        aria-label={t('plateJs.dataView.chartType')}
        className="grid grid-cols-4"
      >
        {options.map(option => (
          <ToggleGroupItem
            data-action-id="charts.data-view.chart.select-type"
            key={option.value}
            value={option.value}
            aria-label={option.label}
            title={option.label}
            disabled={option.value === 'pie' && pieDisabled}
            className="aria-checked:bg-success aria-checked:text-success-foreground h-9"
          >
            {option.icon}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
