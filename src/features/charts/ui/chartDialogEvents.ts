import type { TDataViewElement } from '../types';

export const OPEN_DATA_VIEW_DIALOG_EVENT = 'plate:open-data-view-dialog';

export function openDataViewDialog(element?: TDataViewElement) {
  window.dispatchEvent(
    new CustomEvent<{ element?: TDataViewElement }>(OPEN_DATA_VIEW_DIALOG_EVENT, {
      detail: { element },
    })
  );
}
