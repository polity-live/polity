import { createPlatePlugin } from 'platejs/react';
import { CHART_NODE_TYPE } from '@/features/charts/types';
import { ChartDialog } from '@/features/charts/ui/ChartDialog';
import { ChartElement } from '@/features/shared/ui/ui-platejs/chart-node';

export const ChartPlugin = createPlatePlugin({
  key: CHART_NODE_TYPE,
  node: {
    isElement: true,
    isVoid: true,
  },
  render: {
    node: ChartElement,
    afterEditable: ChartDialog,
  },
});

export const ChartKit = [ChartPlugin];
