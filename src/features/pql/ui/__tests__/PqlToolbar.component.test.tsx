// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TypeaheadItem } from '@/features/shared/logic/typeaheadHelpers';
import { PqlToolbar } from '@/features/pql/ui/PqlToolbar';
import { PqlToolbarView } from '@/features/pql/ui/PqlToolbarView';
import { Card } from '@/features/shared/ui/ui/card';

type FieldKey = 'assignee_ids' | 'status';

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

function ToolbarHarness({
  embedded = false,
  withActions = false,
}: {
  embedded?: boolean;
  withActions?: boolean;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [values, setValues] = useState<Partial<Record<FieldKey, string[]>>>({});

  const toolbar = (
    <PqlToolbar<unknown, FieldKey>
      fields={[
        {
          key: 'status',
          label: 'Status',
          kind: 'enum',
          operators: ['eq', 'in'],
          options: [
            { value: 'open', label: 'Open' },
            { value: 'closed', label: 'Closed' },
          ],
          getValue: () => 'open',
        },
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
          fieldKey: 'status',
          label: 'Status',
          multiple: true,
        },
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
      onQuickFilterToggle={(fieldKey, value) =>
        setValues(currentValues => {
          const currentFieldValues = currentValues[fieldKey] ?? [];
          const nextFieldValues = currentFieldValues.includes(value)
            ? currentFieldValues.filter(currentValue => currentValue !== value)
            : [...currentFieldValues, value];

          return { ...currentValues, [fieldKey]: nextFieldValues };
        })
      }
      onQuickFilterClear={fieldKey =>
        setValues(currentValues => ({ ...currentValues, [fieldKey]: [] }))
      }
      savedFilters={[]}
      activeCustomFilterIds={[]}
      onCustomFilterToggle={() => undefined}
      onCustomFilterDelete={() => undefined}
      onCustomFilterSave={() => undefined}
      actions={withActions ? <button type="button">New item</button> : undefined}
    />
  );

  return embedded ? <Card>{toolbar}</Card> : toolbar;
}

afterEach(() => {
  cleanup();
});

describe('PqlToolbar', () => {
  it('renders optional actions in the same responsive row as search', () => {
    const { container } = render(<ToolbarHarness withActions />);

    const searchRow = container.querySelector('[data-slot="pql-search-row"]');
    const actions = container.querySelector('[data-slot="pql-actions"]');

    expect(searchRow?.className).toContain('sm:flex-row');
    expect(actions?.parentElement).toBe(searchRow);
    expect(screen.getByRole('button', { name: 'New item' })).toBeTruthy();
  });

  it('renders active button quick filters as pressed colored controls', () => {
    render(<ToolbarHarness />);

    fireEvent.click(screen.getByRole('button', { name: /Field filters/i }));

    const openButton = screen.getByRole('button', { name: 'Open' });
    expect(openButton.getAttribute('aria-pressed')).toBe('false');
    expect(openButton.getAttribute('data-active')).toBe('false');

    fireEvent.click(openButton);

    expect(openButton.getAttribute('aria-pressed')).toBe('true');
    expect(openButton.getAttribute('data-active')).toBe('true');
    expect(openButton.className).toContain('bg-primary');
    expect(screen.getByText('Status: Open')).toBeTruthy();
  });

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

  it('dispatches every toolbar command through a distinct stable action', () => {
    const handlers = {
      onBuilderOpenChange: vi.fn(),
      onCustomFilterDelete: vi.fn(),
      onCustomFilterToggle: vi.fn(),
      onEditFilter: vi.fn(),
      onFieldFiltersOpenChange: vi.fn(),
      onQuickFilterClear: vi.fn(),
      onQuickFilterToggle: vi.fn(),
    };
    const filter = { id: 'saved-1', label: 'Open work', query: 'status = open' };
    const { container } = render(
      <PqlToolbarView
        activeBadges={[{ id: 'status', label: 'Status: Open', onClear: vi.fn() }]}
        activeCustomFilterIds={[]}
        activeQuickBadgeCount={1}
        builderOpen={false}
        customFiltersOpen
        editingFilter={null}
        fieldFiltersOpen
        fields={[
          {
            key: 'status',
            label: 'Status',
            kind: 'enum',
            operators: ['eq'],
            options: [{ value: 'open', label: 'Open' }],
            getValue: () => 'open',
          },
        ]}
        onCustomFilterSave={vi.fn()}
        onCustomFiltersOpenChange={vi.fn()}
        onQuickFilterValuesChange={vi.fn()}
        onSearchQueryChange={vi.fn()}
        quickFilters={[{ fieldKey: 'status', label: 'Status' }]}
        quickFilterValues={{ status: ['open'] }}
        savedFilters={[filter]}
        searchPlaceholder="Search"
        searchQuery=""
        {...handlers}
      />
    );

    const ids = [
      'pql.toolbar.active-badge.clear',
      'pql.toolbar.field-filters.toggle',
      'pql.toolbar.quick-filter.clear',
      'pql.toolbar.quick-filter.toggle',
      'pql.toolbar.custom-filters.toggle',
      'pql.toolbar.custom-filter.add',
      'pql.toolbar.custom-filter.card.toggle',
      'pql.toolbar.custom-filter.apply.toggle',
      'pql.toolbar.custom-filter.edit',
      'pql.toolbar.custom-filter.delete',
    ];
    for (const id of ids) {
      const button = container.querySelector<HTMLElement>(`[data-action-id="${id}"]`);
      expect(button, id).not.toBeNull();
      fireEvent.click(button!);
    }

    expect(handlers.onQuickFilterClear).toHaveBeenCalledWith('status');
    expect(handlers.onQuickFilterToggle).toHaveBeenCalledWith('status', 'open');
    expect(handlers.onCustomFilterToggle).toHaveBeenCalledTimes(2);
    expect(handlers.onCustomFilterDelete).toHaveBeenCalledWith('saved-1');
    expect(handlers.onEditFilter).toHaveBeenCalledWith(null);
    expect(handlers.onEditFilter).toHaveBeenCalledWith(filter);
    expect(handlers.onBuilderOpenChange).toHaveBeenCalledWith(true);
  });
});
