import * as React from 'react';

import { DatabaseIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ToolbarButton } from '@/features/shared/ui/layout';
import { openDataViewDialog } from '@/features/charts/ui/ChartDialog';

export function ChartToolbarButton(props: React.ComponentProps<typeof ToolbarButton>) {
  const { t } = useTranslation();

  return (
    <ToolbarButton
      {...props}
      data-plate-focus
      tooltip={t('plateJs.dataView.insertTitle', 'Insert data')}
      onClick={event => {
        props.onClick?.(event);
        if (event.defaultPrevented) return;
        openDataViewDialog();
      }}
    >
      <DatabaseIcon />
    </ToolbarButton>
  );
}
