import { type PqlFieldDefinition, type PqlFilter } from '../logic/applyPqlFilter';
import { usePqlFilterBuilderDialogController } from '../hooks/usePqlFilterBuilderDialogController';
import { PqlFilterBuilderDialogView } from './PqlFilterBuilderDialogView';

interface PqlFilterBuilderDialogProps<TItem, TFieldKey extends string> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fields: readonly PqlFieldDefinition<TItem, TFieldKey>[];
  filter?: PqlFilter<TFieldKey> | null;
  onSave: (filter: PqlFilter<TFieldKey>) => void;
}

export function PqlFilterBuilderDialog<TItem, TFieldKey extends string>({
  open,
  onOpenChange,
  fields,
  filter,
  onSave,
}: PqlFilterBuilderDialogProps<TItem, TFieldKey>) {
  return (
    <PqlFilterBuilderDialogView
      fields={fields}
      filter={filter}
      onOpenChange={onOpenChange}
      open={open}
      {...usePqlFilterBuilderDialogController({
        open,
        onOpenChange,
        fields,
        filter,
        onSave,
      })}
    />
  );
}
