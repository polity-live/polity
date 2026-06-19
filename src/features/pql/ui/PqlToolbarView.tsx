import { featureThemeClassName } from '@/features/shared/theme';
import { BadgeControl } from '@/features/shared/ui/status/StatusBadges';
import { FormControlInput, SearchField } from '@/features/shared/ui/form';
import { ChevronDown, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Card, CardContent } from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import { FilterButton } from '@/features/shared/ui/filter-controls';
import {
  type SurfaceMode,
  useResolvedSurfaceMode,
} from '@/features/shared/ui/layout/SurfaceDepthContext';
import { TypeaheadSearch } from '@/features/shared/ui/typeahead/TypeaheadSearch';
import { HashtagInput } from '@/features/shared/ui/hashtags';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/features/shared/ui/ui/collapsible';
import { cn } from '@/features/shared/utils/utils';
import {
  serializePqlFilter,
  type PqlFieldDefinition,
  type PqlFilter,
  type PqlOperator,
  type PqlRule,
} from '../logic/applyPqlFilter';
import type { TypeaheadItem } from '@/features/shared/logic/typeaheadHelpers';
import { PqlFilterBuilderDialog } from './PqlFilterBuilderDialog';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

export interface ActivePqlFilterBadge {
  id: string;
  label: string;
  onClear: () => void;
}

type PqlQuickFilterValues<TFieldKey extends string> = Partial<Record<TFieldKey, string[]>>;

interface PqlQuickFilterDefinition<TFieldKey extends string> {
  fieldKey: TFieldKey;
  label?: string;
  operator?: Extract<PqlOperator, 'eq' | 'in'>;
  multiple?: boolean;
  inputKind?: 'buttons' | 'typeahead' | 'hashtag' | 'date';
  placeholder?: string;
  typeaheadItems?: readonly TypeaheadItem[];
  serializeValue?: (values: readonly string[]) => PqlRule<TFieldKey>['value'];
}

interface PqlToolbarViewProps<TItem, TFieldKey extends string> {
  activeBadges: readonly ActivePqlFilterBadge[];
  activeCustomFilterIds: readonly string[];
  activeQuickBadgeCount: number;
  builderOpen: boolean;
  customFiltersOpen: boolean;
  editingFilter: PqlFilter<TFieldKey> | null;
  fieldFiltersOpen: boolean;
  fields: readonly PqlFieldDefinition<TItem, TFieldKey>[];
  onBuilderOpenChange: (open: boolean) => void;
  onCustomFilterDelete: (filterId: string) => void;
  onCustomFilterSave: (filter: PqlFilter<TFieldKey>) => void;
  onCustomFilterToggle: (filterId: string) => void;
  onCustomFiltersOpenChange: (open: boolean) => void;
  onEditFilter: (filter: PqlFilter<TFieldKey> | null) => void;
  onFieldFiltersOpenChange: (open: boolean) => void;
  onQuickFilterClear: (fieldKey: TFieldKey) => void;
  onQuickFilterToggle: (fieldKey: TFieldKey, value: string) => void;
  onQuickFilterValuesChange: (fieldKey: TFieldKey, values: readonly string[]) => void;
  onSearchQueryChange: (query: string) => void;
  quickFilters: readonly PqlQuickFilterDefinition<TFieldKey>[];
  quickFilterValues: PqlQuickFilterValues<TFieldKey>;
  savedFilters: readonly PqlFilter<TFieldKey>[];
  searchPlaceholder: string;
  searchQuery: string;
  surface?: SurfaceMode;
}

function describeFilter<TFieldKey extends string>(filter: PqlFilter<TFieldKey>): string {
  return serializePqlFilter(filter);
}

export function PqlToolbarView<TItem, TFieldKey extends string>({
  activeBadges,
  activeCustomFilterIds,
  activeQuickBadgeCount,
  builderOpen,
  customFiltersOpen,
  editingFilter,
  fieldFiltersOpen,
  fields,
  onBuilderOpenChange,
  onCustomFilterDelete,
  onCustomFilterSave,
  onCustomFilterToggle,
  onCustomFiltersOpenChange,
  onEditFilter,
  onFieldFiltersOpenChange,
  onQuickFilterClear,
  onQuickFilterToggle,
  onQuickFilterValuesChange,
  onSearchQueryChange,
  quickFilters,
  quickFilterValues,
  savedFilters,
  searchPlaceholder,
  searchQuery,
  surface = 'auto',
}: PqlToolbarViewProps<TItem, TFieldKey>) {
  const getField = (fieldKey: TFieldKey) => fields.find((field: any) => field.key === fieldKey);
  const resolvedSurface = useResolvedSurfaceMode(surface);
  const toolbarContent = (
    <>
      <SearchField
        placeholder={searchPlaceholder}
        value={searchQuery}
        onValueChange={onSearchQueryChange}
        clearLabel={translateText('generated.inline.1132_clear_search_67300d0f')}
      />

      {activeBadges.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {activeBadges.map((badge: any) => (
            <BadgeControl key={badge.id} variant="default" className="gap-1">
              <span>{badge.label}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="hover:bg-primary-foreground/20 h-5 w-5 text-current hover:text-current"
                onClick={badge.onClear}
                aria-label={`Remove ${badge.label}`}
              >
                <X className="h-3 w-3" />
              </Button>
            </BadgeControl>
          ))}
        </div>
      ) : null}

      {quickFilters.length > 0 ? (
        <Collapsible open={fieldFiltersOpen} onOpenChange={onFieldFiltersOpenChange}>
          <div className="border-border/70 border-t pt-2" data-slot="pql-filter-section">
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="flex w-full items-center justify-between px-0 py-3 hover:bg-transparent"
              >
                <span className="font-medium">
                  {translateText('generated.inline.1095_field_filters_8d9ccc52')}
                </span>
                <div className="flex items-center gap-2">
                  <BadgeControl variant="outline">{activeQuickBadgeCount}</BadgeControl>
                  <ChevronDown
                    className={cn('h-4 w-4 transition-transform', fieldFiltersOpen && 'rotate-180')}
                  />
                </div>
              </Button>
            </CollapsibleTrigger>

            <CollapsibleContent className="border-border/70 border-t py-4">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {quickFilters.map((quickFilter: PqlQuickFilterDefinition<TFieldKey>) => {
                  const field = getField(quickFilter.fieldKey);
                  const values = quickFilterValues[quickFilter.fieldKey] ?? [];
                  const options = field?.options ?? [];

                  return (
                    <div key={quickFilter.fieldKey} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {quickFilter.label ?? field?.label ?? quickFilter.fieldKey}
                        </span>
                        {values.length > 0 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onQuickFilterClear(quickFilter.fieldKey)}
                          >
                            {translateText('generated.inline.1096_clear_719ea396')}
                          </Button>
                        ) : null}
                      </div>
                      {(quickFilter.inputKind ?? 'buttons') === 'typeahead' ? (
                        quickFilter.multiple ? (
                          <TypeaheadSearch
                            items={quickFilter.typeaheadItems ?? []}
                            multiple
                            values={values}
                            onValuesChange={nextValues =>
                              onQuickFilterValuesChange(quickFilter.fieldKey, nextValues)
                            }
                            placeholder={
                              quickFilter.placeholder ??
                              `Search ${quickFilter.label ?? field?.label ?? ''}...`
                            }
                          />
                        ) : (
                          <TypeaheadSearch
                            items={quickFilter.typeaheadItems ?? []}
                            value={values[0]}
                            onChange={item =>
                              onQuickFilterValuesChange(quickFilter.fieldKey, item ? [item.id] : [])
                            }
                            placeholder={
                              quickFilter.placeholder ??
                              `Search ${quickFilter.label ?? field?.label ?? ''}...`
                            }
                          />
                        )
                      ) : quickFilter.inputKind === 'hashtag' ? (
                        <HashtagInput
                          value={values}
                          onChange={nextValues =>
                            onQuickFilterValuesChange(quickFilter.fieldKey, nextValues)
                          }
                          showLabel={false}
                          placeholder={quickFilter.placeholder ?? 'Add a tag'}
                          suggestions={options.map((option: any) => option.value)}
                        />
                      ) : quickFilter.inputKind === 'date' ? (
                        <FormControlInput
                          type="date"
                          value={values[0] ?? ''}
                          onChange={event =>
                            onQuickFilterValuesChange(
                              quickFilter.fieldKey,
                              event.target.value ? [event.target.value] : []
                            )
                          }
                        />
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {options.map((option: any) => {
                            const isActive = values.includes(option.value);
                            return (
                              <FilterButton
                                key={option.value}
                                active={isActive}
                                onClick={() =>
                                  onQuickFilterToggle(quickFilter.fieldKey, option.value)
                                }
                              >
                                {option.label}
                              </FilterButton>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      ) : null}

      <Collapsible open={customFiltersOpen} onOpenChange={onCustomFiltersOpenChange}>
        <div className="border-border/70 border-t pt-2" data-slot="pql-filter-section">
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="flex w-full items-center justify-between px-0 py-3 hover:bg-transparent"
            >
              <span className="font-medium">
                {translateText('generated.inline.1097_custom_filters_3be34e01')}
              </span>
              <div className="flex items-center gap-2">
                <BadgeControl variant="outline">{savedFilters.length}</BadgeControl>
                <ChevronDown
                  className={cn('h-4 w-4 transition-transform', customFiltersOpen && 'rotate-180')}
                />
              </div>
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent className="border-border/70 border-t py-4">
            <div className="mb-4 flex justify-end">
              <Button
                type="button"
                onClick={() => {
                  onEditFilter(null);
                  onBuilderOpenChange(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                {translateText('generated.inline.1098_add_custom_filter_9a08c207')}
              </Button>
            </div>

            {savedFilters.length === 0 ? (
              <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-8 text-center text-sm">
                {translateText(
                  'generated.inline.1099_save_reusable_pql_filters_here_suggestions_su_d54a75af'
                )}
              </p>
            ) : (
              <div className="space-y-3">
                {savedFilters.map((filter: any) => {
                  const isActive = activeCustomFilterIds.includes(filter.id);
                  return (
                    <div
                      key={filter.id}
                      className="flex flex-col gap-3 rounded-lg border p-4 lg:flex-row lg:items-start lg:justify-between"
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        className={featureThemeClassName('pqlPqlToolbarContrastPanel')}
                        onClick={() => onCustomFilterToggle(filter.id)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{filter.label}</span>
                          <BadgeControl variant={isActive ? 'default' : 'outline'}>
                            {isActive
                              ? translateText('generated.inline.0126_active_a733b809')
                              : translateText('generated.inline.0134_inactive_09af574c')}
                          </BadgeControl>
                        </div>
                        <p className="text-muted-foreground mt-1 font-mono text-xs break-words">
                          {describeFilter(filter)}
                        </p>
                      </Button>

                      <div className="flex items-center gap-2">
                        <FilterButton
                          active={isActive}
                          onClick={() => onCustomFilterToggle(filter.id)}
                        >
                          {isActive
                            ? translateText('generated.inline.0135_applied_a3e4a569')
                            : translateText('generated.inline.0136_apply_cfea419c')}
                        </FilterButton>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            onEditFilter(filter);
                            onBuilderOpenChange(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => onCustomFilterDelete(filter.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CollapsibleContent>
        </div>
      </Collapsible>
    </>
  );

  return (
    <>
      {resolvedSurface === 'standalone' ? (
        <Card className="mb-6" data-slot="pql-toolbar-surface" data-surface={resolvedSurface}>
          <CardContent className="space-y-4 pt-6">{toolbarContent}</CardContent>
        </Card>
      ) : (
        <div
          className="mb-6 space-y-4"
          data-slot="pql-toolbar-surface"
          data-surface={resolvedSurface}
        >
          {toolbarContent}
        </div>
      )}

      <PqlFilterBuilderDialog
        open={builderOpen}
        onOpenChange={onBuilderOpenChange}
        fields={fields}
        filter={editingFilter}
        onSave={onCustomFilterSave}
      />
    </>
  );
}
