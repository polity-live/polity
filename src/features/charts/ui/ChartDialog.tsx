import { useChartDialogModel } from '../hooks/useChartDialogModel';
import type { TChartElement } from '../types';
import { ChartDialogView } from './ChartDialogView';
import { OPEN_CHART_DIALOG_EVENT, openChartDialog } from './chartDialogEvents';

export { OPEN_CHART_DIALOG_EVENT, openChartDialog };
export type { TChartElement };

export function ChartDialog() {
  const model = useChartDialogModel();

  return <ChartDialogView model={model} />;
}
