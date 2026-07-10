import { createSlatePlugin } from 'platejs';
import { DATA_VIEW_NODE_TYPE } from '@/features/charts/types';
import { ChartElementStatic } from '@/features/shared/ui/ui-platejs/chart-node-static';

export const BaseChartPlugin = createSlatePlugin({
  key: DATA_VIEW_NODE_TYPE,
  node: {
    isElement: true,
    isVoid: true,
  },
  render: {
    node: ChartElementStatic,
  },
});

export const BaseChartKit = [BaseChartPlugin];
