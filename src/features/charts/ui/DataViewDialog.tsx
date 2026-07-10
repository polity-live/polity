import { useDataViewDialogModel } from '../hooks/useDataViewDialogModel';
import type { TDataViewElement } from '../types';
import { DataViewDialogView } from './DataViewDialogView';
import { OPEN_DATA_VIEW_DIALOG_EVENT, openDataViewDialog } from './chartDialogEvents';

export { OPEN_DATA_VIEW_DIALOG_EVENT, openDataViewDialog };
export type { TDataViewElement };

export function DataViewDialog() {
  const model = useDataViewDialogModel();
  return <DataViewDialogView model={model} />;
}
