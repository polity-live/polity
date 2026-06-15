// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { TypeaheadItem } from '@/features/shared/logic/typeaheadHelpers';
import { PqlToolbar } from '@/features/pql/ui/PqlToolbar';
import { Card } from '@/features/shared/ui/ui/card';

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

function ToolbarHarness({ embedded = false }: { embedded?: boolean }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [values, setValues] = useState<Partial<Record<FieldKey, string[]>>>({});

  const toolbar = (
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

  return embedded ? <Card>{toolbar}</Card> : toolbar;
}

afterEach(() => {
  cleanup();
});

describe('PqlToolbar', () => {
  it('uses the reusable multi-select typeahead for quick filters', () => {
    render(<ToolbarHarness />);

    fireEvent.click(screen.getByRole('button', { name: /Field filters/i }));
    fireEvent.focus(screen.getByPlaceholderText('Search assignees'));
    fireEvent.click(screen.getByText('Alice Example'));

    expect(screen.getByText('@alice')).toBeTruthy();
    expect(screen.getByText('Assignees: Alice Example')).toBeTruthy();
  });

  it('uses a standalone card surface on the page and flat divider sections inside it', () => {
    render(<ToolbarHarness />);

    const surface = document.querySelector('[data-slot="pql-toolbar-surface"]');
    const sections = document.querySelectorAll('[data-slot="pql-filter-section"]');

    expect(surface?.getAttribute('data-surface')).toBe('standalone');
    expect(surface?.className).toContain('bg-card');
    expect(sections.length).toBeGreaterThan(0);
    sections.forEach(section => {
      expect(section.className).toContain('border-t');
      expect(section.className).not.toContain('rounded-lg');
    });
  });

  it('drops the outer card surface when embedded inside another card', () => {
    render(<ToolbarHarness embedded />);

    const surface = document.querySelector('[data-slot="pql-toolbar-surface"]');

    expect(surface?.getAttribute('data-surface')).toBe('embedded');
    expect(surface?.className).not.toContain('bg-card');
    expect(surface?.className).not.toContain('rounded-lg');
    expect(surface?.className).not.toContain('shadow-[var(--shadow-panel)]');
  });
});
