import { useDataViewDialogModel } from '../hooks/useDataViewDialogModel';
import { useZeroReady } from '@/providers/zero-ready-context';
import type { TDataViewElement } from '../types';
import { DataViewDialogView } from './DataViewDialogView';
import { OPEN_DATA_VIEW_DIALOG_EVENT, openDataViewDialog } from './chartDialogEvents';

export { OPEN_DATA_VIEW_DIALOG_EVENT, openDataViewDialog };
export type { TDataViewElement };

export function DataViewDialog() {
  const zeroReady = useZeroReady();

  if (!zeroReady) return null;

  return <ConnectedDataViewDialog />;
}

function ConnectedDataViewDialog() {
  const model = useDataViewDialogModel();
  return <DataViewDialogView model={model} />;
}
