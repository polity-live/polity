import { useMemo, useState } from 'react';
import { ChevronDown, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { Card, CardContent } from '@/features/shared/ui/ui/card';
import { Input } from '@/features/shared/ui/ui/input';
import { Button } from '@/features/shared/ui/ui/button';
import { Badge } from '@/features/shared/ui/ui/badge';
import { TypeaheadSearch } from '@/features/shared/ui/typeahead/TypeaheadSearch';
import { HashtagInput } from '@/features/shared/ui/ui/hashtag-input';
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
} from '../logic/applyPqlFilter';
import type { PqlQuickFilterDefinition, PqlQuickFilterValues } from '../hooks/usePqlCollection';
import { PqlFilterBuilderDialog } from './PqlFilterBuilderDialog';

function getOptionLabel<TItem, TFieldKey extends string>(
  field: PqlFieldDefinition<TItem, TFieldKey> | undefined,
  value: string
): string {
  return field?.options?.find(option => option.value === value)?.label ?? value;
}

function describeFilter<TFieldKey extends string>(filter: PqlFilter<TFieldKey>): string {
  return serializePqlFilter(filter);
}

interface PqlToolbarProps<TItem, TFieldKey extends string> {
  fields: readonly PqlFieldDefinition<TItem, TFieldKey>[];
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  searchPlaceholder: string;
  quickFilters: readonly PqlQuickFilterDefinition<TFieldKey>[];
  quickFilterValues: PqlQuickFilterValues<TFieldKey>;
  onQuickFilterValuesChange: (fieldKey: TFieldKey, values: readonly string[]) => void;
  onQuickFilterToggle: (fieldKey: TFieldKey, value: string) => void;
  onQuickFilterClear: (fieldKey: TFieldKey) => void;
  savedFilters: readonly PqlFilter<TFieldKey>[];
  activeCustomFilterIds: readonly string[];
  onCustomFilterToggle: (filterId: string) => void;
  onCustomFilterDelete: (filterId: string) => void;
  onCustomFilterSave: (filter: PqlFilter<TFieldKey>) => void;
}

export function PqlToolbar<TItem, TFieldKey extends string>({
  fields,
  searchQuery,
  onSearchQueryChange,
  searchPlaceholder,
  quickFilters,
  quickFilterValues,
  onQuickFilterValuesChange,
  onQuickFilterToggle,
  onQuickFilterClear,
  savedFilters,
  activeCustomFilterIds,
  onCustomFilterToggle,
  onCustomFilterDelete,
  onCustomFilterSave,
}: PqlToolbarProps<TItem, TFieldKey>) {
  const [fieldFiltersOpen, setFieldFiltersOpen] = useState(false);
  const [customFiltersOpen, setCustomFiltersOpen] = useState(false);
  const [editingFilter, setEditingFilter] = useState<PqlFilter<TFieldKey> | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);

  const fieldMap = useMemo(() => new Map(fields.map(field => [field.key, field])), [fields]);

  const activeQuickBadges = quickFilters.flatMap(quickFilter => {
    const field = fieldMap.get(quickFilter.fieldKey);
    const values = quickFilterValues[quickFilter.fieldKey] ?? [];
    return values.map(value => ({
      id: `${quickFilter.fieldKey}-${value}`,
      label: `${quickFilter.label ?? field?.label ?? quickFilter.fieldKey}: ${getOptionLabel(field, value)}`,
      onClear: () => onQuickFilterToggle(quickFilter.fieldKey, value),
    }));
  });

  const activeCustomBadges = savedFilters
    .filter(filter => activeCustomFilterIds.includes(filter.id))
    .map(filter => ({
      id: filter.id,
      label: filter.label,
      onClear: () => onCustomFilterToggle(filter.id),
    }));

  const activeBadges = [...activeQuickBadges, ...activeCustomBadges];

  return (
    <>
      <Card className="mb-6">
        <CardContent className="space-y-4 pt-6">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={event => onSearchQueryChange(event.target.value)}
              className="pr-10 pl-10"
            />
            {searchQuery ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-1/2 right-1 h-7 w-7 -translate-y-1/2"
                onClick={() => onSearchQueryChange('')}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            ) : null}
          </div>

          {activeBadges.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {activeBadges.map(badge => (
                <Badge key={badge.id} variant="secondary" className="gap-1">
                  <span>{badge.label}</span>
                  <button
                    type="button"
                    onClick={badge.onClear}
                    aria-label={`Remove ${badge.label}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          ) : null}

          {quickFilters.length > 0 ? (
            <Collapsible open={fieldFiltersOpen} onOpenChange={setFieldFiltersOpen}>
              <div className="rounded-lg border">
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className="flex w-full items-center justify-between rounded-lg px-4 py-3"
                  >
                    <span className="font-medium">Field filters</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{activeQuickBadges.length}</Badge>
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 transition-transform',
                          fieldFiltersOpen && 'rotate-180'
                        )}
                      />
                    </div>
                  </Button>
                </CollapsibleTrigger>

                <CollapsibleContent className="border-t px-4 py-4">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {quickFilters.map(quickFilter => {
                      const field = fieldMap.get(quickFilter.fieldKey);
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
                                Clear
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
                                  onQuickFilterValuesChange(
                                    quickFilter.fieldKey,
                                    item ? [item.id] : []
                                  )
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
                              suggestions={options.map(option => option.value)}
                            />
                          ) : quickFilter.inputKind === 'date' ? (
                            <Input
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
                              {options.map(option => {
                                const isActive = values.includes(option.value);
                                return (
                                  <Button
                                    key={option.value}
                                    type="button"
                                    variant={isActive ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() =>
                                      onQuickFilterToggle(quickFilter.fieldKey, option.value)
                                    }
                                  >
                                    {option.label}
                                  </Button>
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

          <Collapsible open={customFiltersOpen} onOpenChange={setCustomFiltersOpen}>
            <div className="rounded-lg border">
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="flex w-full items-center justify-between rounded-lg px-4 py-3"
                >
                  <span className="font-medium">Custom filters</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{savedFilters.length}</Badge>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 transition-transform',
                        customFiltersOpen && 'rotate-180'
                      )}
                    />
                  </div>
                </Button>
              </CollapsibleTrigger>

              <CollapsibleContent className="border-t px-4 py-4">
                <div className="mb-4 flex justify-end">
                  <Button
                    type="button"
                    onClick={() => {
                      setEditingFilter(null);
                      setBuilderOpen(true);
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add custom filter
                  </Button>
                </div>

                {savedFilters.length === 0 ? (
                  <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-8 text-center text-sm">
                    Save reusable PQL filters here. Suggestions support fields, operators, IN, AND,
                    OR, and parentheses.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {savedFilters.map(filter => {
                      const isActive = activeCustomFilterIds.includes(filter.id);
                      return (
                        <div
                          key={filter.id}
                          className="flex flex-col gap-3 rounded-lg border p-4 lg:flex-row lg:items-start lg:justify-between"
                        >
                          <button
                            type="button"
                            className="flex-1 text-left"
                            onClick={() => onCustomFilterToggle(filter.id)}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{filter.label}</span>
                              <Badge variant={isActive ? 'default' : 'outline'}>
                                {isActive ? 'Active' : 'Inactive'}
                              </Badge>
                            </div>
                            <p className="text-muted-foreground mt-1 font-mono text-xs break-words">
                              {describeFilter(filter)}
                            </p>
                          </button>

                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant={isActive ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => onCustomFilterToggle(filter.id)}
                            >
                              {isActive ? 'Applied' : 'Apply'}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => {
                                setEditingFilter(filter);
                                setBuilderOpen(true);
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
        </CardContent>
      </Card>

      <PqlFilterBuilderDialog
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        fields={fields}
        filter={editingFilter}
        onSave={onCustomFilterSave}
      />
    </>
  );
}
