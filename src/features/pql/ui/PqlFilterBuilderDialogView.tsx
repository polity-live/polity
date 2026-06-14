import { featureThemeClassName } from '@/features/shared/theme';
import { BadgeControl } from '@/features/shared/ui/status/StatusBadges';
import { FormControlInput, FormControlLabel } from '@/features/shared/ui/form';
import { ScrollableDialogContent } from '@/features/shared/ui/dialog';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/features/shared/ui/ui/dialog';
import type { PqlFieldDefinition, PqlFilter } from '../logic/applyPqlFilter';
import type { PqlQueryIssue } from '../logic/pqlQueryLanguage';
import { PqlQueryEditor } from './PqlQueryEditor';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface PqlFilterBuilderDialogViewProps<TItem, TFieldKey extends string> {
  fields: readonly PqlFieldDefinition<TItem, TFieldKey>[];
  filter?: PqlFilter<TFieldKey> | null;
  isLabelValid: boolean;
  isQueryValid: boolean;
  isValid: boolean;
  issues: readonly PqlQueryIssue[];
  label: string;
  onLabelChange: (label: string) => void;
  onOpenChange: (open: boolean) => void;
  onQueryChange: (query: string) => void;
  onSave: () => void;
  open: boolean;
  query: string;
  queryPlaceholder: string;
}

export function PqlFilterBuilderDialogView<TItem, TFieldKey extends string>({
  fields,
  filter,
  isLabelValid,
  isQueryValid,
  isValid,
  issues,
  label,
  onLabelChange,
  onOpenChange,
  onQueryChange,
  onSave,
  open,
  query,
  queryPlaceholder,
}: PqlFilterBuilderDialogViewProps<TItem, TFieldKey>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ScrollableDialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {filter
              ? translateText('generated.inline.0132_edit_custom_filter_bcef0a89')
              : translateText('generated.inline.0133_add_custom_filter_9a08c207')}
          </DialogTitle>
          <DialogDescription>
            {translateText(
              'generated.inline.1088_write_reusable_pql_queries_with_typed_suggest_9dd2fd7f'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid gap-4 md:grid-cols-[2fr_auto] md:items-end">
            <div className="space-y-2">
              <FormControlLabel htmlFor="pql-filter-label">
                {translateText('generated.inline.1000_name_709a2322')}
              </FormControlLabel>
              <FormControlInput
                id="pql-filter-label"
                value={label}
                onChange={event => onLabelChange(event.target.value)}
                placeholder={translateText('generated.inline.1089_board_work_due_soon_34c8753d')}
                className={
                  isLabelValid
                    ? featureThemeClassName('pqlPqlFilterBuilderDialogSuccessBorder')
                    : undefined
                }
              />
            </div>

            <BadgeControl
              variant="outline"
              size="xs"
              textStyle="mono"
              className="h-10 justify-center px-3"
            >
              {translateText('generated.inline.0141_pql_4ef7dac2')}
            </BadgeControl>
          </div>

          <div className="space-y-2">
            <FormControlLabel htmlFor="pql-filter-query">
              {translateText('generated.inline.1090_query_a618b4be')}
            </FormControlLabel>
            <PqlQueryEditor
              fields={fields}
              value={query}
              onChange={onQueryChange}
              issues={issues}
              placeholder={queryPlaceholder}
              textareaClassName={
                isQueryValid
                  ? featureThemeClassName('pqlPqlFilterBuilderDialogSuccessBorder')
                  : undefined
              }
            />
          </div>

          <div className="text-muted-foreground rounded-lg border border-dashed px-4 py-3 text-sm">
            <p className="text-foreground font-medium">
              {translateText('generated.inline.1091_syntax_17c7ba76')}
            </p>
            <p className="mt-1 font-mono text-xs">
              {translateText(
                'generated.inline.1092_field_value_and_other_field_in_value1_value2__8cf94dee'
              )}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {translateText('generated.inline.0065_cancel_77dfd213')}
          </Button>
          <Button type="button" onClick={onSave} disabled={!isValid}>
            {translateText('generated.inline.1093_save_filter_f7f579af')}
          </Button>
        </DialogFooter>
      </ScrollableDialogContent>
    </Dialog>
  );
}
