import type { TChartElement } from '../types';

export const OPEN_CHART_DIALOG_EVENT = 'plate:open-chart-dialog';

export function openChartDialog(element?: TChartElement) {
  window.dispatchEvent(
    new CustomEvent<{ element?: TChartElement }>(OPEN_CHART_DIALOG_EVENT, {
      detail: { element },
    })
  );
}
