import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/features/shared/ui/ui/badge';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/features/shared/ui/ui/dialog';
import { Input } from '@/features/shared/ui/ui/input';
import { Label } from '@/features/shared/ui/ui/label';
import {
  serializePqlFilter,
  type PqlFieldDefinition,
  type PqlFilter,
} from '../logic/applyPqlFilter';
import { buildPqlCodeFilter, parsePqlExpression } from '../logic/pqlQueryLanguage';
import { PqlQueryEditor } from './PqlQueryEditor';

function formatPlaceholderValue(value: string): string {
  return /^[A-Za-z0-9_.:-]+$/.test(value) ? value : JSON.stringify(value);
}

function buildQueryPlaceholder<TItem, TFieldKey extends string>(
  fields: readonly PqlFieldDefinition<TItem, TFieldKey>[]
): string {
  const firstField = fields[0];
  if (!firstField) {
    return 'field == value AND (other_field IN (value1, value2) OR third_field IS SET)';
  }

  const firstOperator = firstField.operators.includes('contains') ? 'CONTAINS' : '==';
  const firstValue = firstField.options?.[0]?.label ?? 'value';
  const firstClause = `${firstField.key} ${firstOperator} ${formatPlaceholderValue(firstValue)}`;

  const inField = fields.find(
    field => field.key !== firstField.key && field.operators.includes('in')
  );
  if (inField?.options && inField.options.length > 0) {
    const inValues = inField.options
      .slice(0, 2)
      .map(option => formatPlaceholderValue(option.label))
      .join(', ');

    return `${firstClause} AND (${inField.key} IN (${inValues}))`;
  }

  const isSetField = fields.find(
    field => field.key !== firstField.key && field.operators.includes('is_set')
  );
  if (isSetField) {
    return `${firstClause} AND ${isSetField.key} IS SET`;
  }

  return firstClause;
}

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
  const [label, setLabel] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }

    if (filter) {
      setLabel(filter.label);
      setQuery(serializePqlFilter(filter));
      return;
    }

    setLabel('');
    setQuery('');
  }, [filter, open]);

  const parseResult = useMemo(
    () =>
      query.trim().length === 0
        ? { expression: null, issues: [] as const }
        : parsePqlExpression(query, fields),
    [fields, query]
  );

  const queryPlaceholder = useMemo(() => buildQueryPlaceholder(fields), [fields]);

  const isValid =
    label.trim().length > 0 &&
    query.trim().length > 0 &&
    Boolean(parseResult.expression) &&
    parseResult.issues.length === 0;

  const handleSave = () => {
    if (!isValid) {
      return;
    }

    const nextFilter = buildPqlCodeFilter({
      id: filter?.id,
      label,
      query,
      fields,
    });

    if (!nextFilter.filter) {
      return;
    }

    onSave(nextFilter.filter);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{filter ? 'Edit custom filter' : 'Add custom filter'}</DialogTitle>
          <DialogDescription>
            Write reusable PQL queries with typed suggestions for fields, operators, parentheses,
            AND, OR, and IN.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid gap-4 md:grid-cols-[2fr_auto] md:items-end">
            <div className="space-y-2">
              <Label htmlFor="pql-filter-label">Name</Label>
              <Input
                id="pql-filter-label"
                value={label}
                onChange={event => setLabel(event.target.value)}
                placeholder="Board work due soon"
              />
            </div>

            <Badge variant="outline" className="h-10 justify-center px-3 font-mono text-xs">
              PQL
            </Badge>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pql-filter-query">Query</Label>
            <PqlQueryEditor
              fields={fields}
              value={query}
              onChange={setQuery}
              issues={parseResult.issues}
              placeholder={queryPlaceholder}
            />
          </div>

          <div className="text-muted-foreground rounded-lg border border-dashed px-4 py-3 text-sm">
            <p className="text-foreground font-medium">Syntax</p>
            <p className="mt-1 font-mono text-xs">
              field == value AND (other_field IN (value1, value2) OR third_field IS SET)
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={!isValid}>
            Save filter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
