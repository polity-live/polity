import { useEffect, useMemo, useState } from 'react';
import {
  serializePqlFilter,
  type PqlFieldDefinition,
  type PqlFilter,
} from '../logic/applyPqlFilter';
import { buildPqlCodeFilter, parsePqlExpression } from '../logic/pqlQueryLanguage';
import { PqlFilterBuilderDialogView } from './PqlFilterBuilderDialogView';

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

  const isLabelValid = label.trim().length > 0;
  const isQueryValid =
    query.trim().length > 0 && Boolean(parseResult.expression) && parseResult.issues.length === 0;

  const isValid = isLabelValid && isQueryValid;

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
    <PqlFilterBuilderDialogView
      fields={fields}
      filter={filter}
      isLabelValid={isLabelValid}
      isQueryValid={isQueryValid}
      isValid={isValid}
      issues={parseResult.issues}
      label={label}
      onLabelChange={setLabel}
      onOpenChange={onOpenChange}
      onQueryChange={setQuery}
      onSave={handleSave}
      open={open}
      query={query}
      queryPlaceholder={queryPlaceholder}
    />
  );
}
