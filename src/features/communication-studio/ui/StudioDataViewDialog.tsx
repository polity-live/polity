import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@/zero/observed-query';
import { queries } from '@/zero/queries';
import { ChartDatasetContextProvider } from '@/features/charts/context/ChartDatasetContext';
import { getGroupDatasetRights } from '@/features/charts/logic/groupDatasetRights';
import { useDataViewBuilderModel } from '@/features/charts/hooks/useDataViewBuilderModel';
import { DataViewDialogView } from '@/features/charts/ui/DataViewDialogView';
import type { TDataViewElement, DataViewProjection } from '@/features/charts/types';
import { validateStudioDataProjection } from '../logic/data-view-import';
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disabled: boolean;
  groupId: string | null;
  userId: string;
  editingElement?: TDataViewElement;
  onInsert: (configuration: TDataViewElement, projection: DataViewProjection) => void;
}
export function StudioDataViewDialog(props: Props) {
  const [groups] = useQuery(
    props.groupId ? queries.groups.byIdFull({ id: props.groupId }) : undefined
  );
  const rights = getGroupDatasetRights(groups?.[0], props.userId);
  return (
    <ChartDatasetContextProvider
      value={{ defaultGroupId: props.groupId, ...rights, canUploadDatasets: !props.disabled }}
    >
      <StudioDataViewDialogContent {...props} />
    </ChartDatasetContextProvider>
  );
}
function StudioDataViewDialogContent({
  open,
  onOpenChange,
  disabled,
  onInsert,
  editingElement,
}: Props) {
  const { t } = useTranslation();
  const model = useDataViewBuilderModel({
    onInsert: (configuration, projection) => {
      onInsert(configuration, projection);
      onOpenChange(false);
    },
    canInsert: !disabled,
    validate: (projection, kind) =>
      disabled
        ? t('features.studio.dataImport.readOnly')
        : validateStudioDataProjection(projection, kind),
  });
  const { resetDialog, setOpen } = model;
  const currentReset = useRef(resetDialog);
  const currentElement = useRef(editingElement);
  currentReset.current = resetDialog;
  currentElement.current = editingElement;
  useEffect(() => {
    // Strict Mode replays mount effects after aborting their first request.
    // Restart preparation on that replay, without resetting an open editor on token refresh.
    if (open) currentReset.current(currentElement.current);
    setOpen(open);
  }, [open, setOpen]);
  return (
    <DataViewDialogView
      model={{
        ...model,
        setOpen: next => {
          const value = typeof next === 'function' ? next(model.open) : next;
          setOpen(value);
          onOpenChange(value);
        },
        save: () => {
          if (model.canInsert) {
            model.save();
          }
        },
      }}
    />
  );
}
