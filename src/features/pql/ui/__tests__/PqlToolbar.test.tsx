// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { TypeaheadItem } from '@/features/shared/logic/typeaheadHelpers';
import { PqlToolbar } from '@/features/pql/ui/PqlToolbar';

type FieldKey = 'assignee_ids';

const assigneeItems: TypeaheadItem[] = [
  {
    id: 'user-1',
    entityType: 'user',
    label: 'Alice Example',
    secondaryLabel: '@alice',
  },
  {
    id: 'user-2',
    entityType: 'user',
    label: 'Bob Example',
    secondaryLabel: '@bob',
  },
];

describe('PqlToolbar', () => {
  it('uses the reusable multi-select typeahead for quick filters', () => {
    function Harness() {
      const [searchQuery, setSearchQuery] = useState('');
      const [values, setValues] = useState<Partial<Record<FieldKey, string[]>>>({});

      return (
        <PqlToolbar<unknown, FieldKey>
          fields={[
            {
              key: 'assignee_ids',
              label: 'Assignees',
              kind: 'entity',
              operators: ['eq', 'in'],
              options: [
                { value: 'user-1', label: 'Alice Example' },
                { value: 'user-2', label: 'Bob Example' },
              ],
              getValue: () => [],
            },
          ]}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          searchPlaceholder="Search todos"
          quickFilters={[
            {
              fieldKey: 'assignee_ids',
              label: 'Assignees',
              multiple: true,
              inputKind: 'typeahead',
              placeholder: 'Search assignees',
              typeaheadItems: assigneeItems,
            },
          ]}
          quickFilterValues={values}
          onQuickFilterValuesChange={(fieldKey, nextValues) =>
            setValues(currentValues => ({ ...currentValues, [fieldKey]: [...nextValues] }))
          }
          onQuickFilterToggle={() => undefined}
          onQuickFilterClear={fieldKey =>
            setValues(currentValues => ({ ...currentValues, [fieldKey]: [] }))
          }
          savedFilters={[]}
          activeCustomFilterIds={[]}
          onCustomFilterToggle={() => undefined}
          onCustomFilterDelete={() => undefined}
          onCustomFilterSave={() => undefined}
        />
      );
    }

    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: /Field filters/i }));
    fireEvent.focus(screen.getByPlaceholderText('Search assignees'));
    fireEvent.mouseDown(screen.getByText('Alice Example'));

    expect(screen.getByText('@alice')).toBeTruthy();
    expect(screen.getByText('Assignees: Alice Example')).toBeTruthy();
  });
});
