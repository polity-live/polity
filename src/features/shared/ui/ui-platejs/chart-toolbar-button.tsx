import * as React from 'react';

import { ChartNoAxesCombinedIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ToolbarButton } from '@/features/shared/ui/ui/toolbar.tsx';
import { openChartDialog } from '@/features/charts/ui/ChartDialog';

export function ChartToolbarButton(props: React.ComponentProps<typeof ToolbarButton>) {
  const { t } = useTranslation();

  return (
    <ToolbarButton
      {...props}
      data-plate-focus
      tooltip={t('plateJs.toolbar.chart')}
      onClick={event => {
        props.onClick?.(event);
        if (event.defaultPrevented) return;
        openChartDialog();
      }}
    >
      <ChartNoAxesCombinedIcon />
    </ToolbarButton>
  );
}
