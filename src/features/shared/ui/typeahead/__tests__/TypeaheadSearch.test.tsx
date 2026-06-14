// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ALL_TYPEAHEAD_ENTITY_TYPES,
  TYPEAHEAD_ENTITY_GROUP_LABELS,
  type TypeaheadItem,
} from '@/features/shared/logic/typeaheadHelpers';
import { TypeaheadCombobox, TypeaheadSearch } from '@/features/shared/ui/typeahead/TypeaheadSearch';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function buildItem(
  id: string,
  label: string,
  entityType: TypeaheadItem['entityType'] = 'user'
): TypeaheadItem {
  return {
    id,
    entityType,
    label,
    secondaryLabel: `Meta for ${label}`,
    description: `Description for ${label}`,
  };
}

describe('TypeaheadSearch', () => {
  it('shows a compact single-selection card from the full source dataset and clears it', () => {
    const onChange = vi.fn();
    const items = Array.from({ length: 25 }, (_, index) =>
      buildItem(`item-${index + 1}`, `Item ${index + 1}`)
    );

    render(
      <TypeaheadSearch
        items={items}
        value="item-25"
        onChange={onChange}
        placeholder="Search items"
      />
    );

    expect(screen.getByText('Item 25')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Remove Item 25' }));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('supports repeated multi-selection with stacked cards and removal', () => {
    const items = [
      buildItem('user-1', 'Alice Example'),
      buildItem('user-2', 'Bob Example'),
      buildItem('user-3', 'Charlie Example'),
    ];

    function MultiHarness() {
      const [values, setValues] = useState<string[]>([]);
      return (
        <TypeaheadSearch
          items={items}
          multiple
          values={values}
          onValuesChange={setValues}
          placeholder="Search users"
        />
      );
    }

    render(<MultiHarness />);

    const input = screen.getByPlaceholderText('Search users');
    fireEvent.focus(input);
    fireEvent.click(
      screen.getByRole('button', {
        name: /Alice Example User Meta for Alice Example Description for Alice Example/,
      })
    );

    expect(screen.getByText('Alice Example')).toBeTruthy();
    expect(screen.getByText('Meta for Alice Example')).toBeTruthy();

    fireEvent.focus(input);
    fireEvent.click(
      screen.getByRole('button', {
        name: /Bob Example User Meta for Bob Example Description for Bob Example/,
      })
    );

    expect(screen.getByText('Bob Example')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /Remove .* Example/ })).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Remove Alice Example' }));

    expect(screen.queryByText('Alice Example')).toBeNull();
    expect(screen.getByText('Bob Example')).toBeTruthy();
  });

  it('renders the dropdown inline when disablePortal is enabled', () => {
    const items = [buildItem('group-1', 'Budget Circle', 'group')];

    const { container } = render(
      <TypeaheadSearch
        items={items}
        value={undefined}
        onChange={() => undefined}
        placeholder="Search groups"
        disablePortal
      />
    );

    fireEvent.focus(screen.getByPlaceholderText('Search groups'));

    expect(container.querySelector('[data-typeahead-portal]')).toBeNull();
    expect(within(container).getByText('Budget Circle')).toBeTruthy();
  });

  it('supports mixed-entity dropdown grouping with the shared all-entity constant', () => {
    const items = ALL_TYPEAHEAD_ENTITY_TYPES.map((entityType, index) =>
      buildItem(
        `${entityType}-${index}`,
        `${TYPEAHEAD_ENTITY_GROUP_LABELS[entityType]} Item`,
        entityType
      )
    );

    render(
      <TypeaheadSearch
        entityTypes={[...ALL_TYPEAHEAD_ENTITY_TYPES]}
        items={items}
        value={undefined}
        onChange={() => undefined}
        placeholder="Search everything"
      />
    );

    fireEvent.focus(screen.getByPlaceholderText('Search everything'));

    expect(screen.getAllByText('Users').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Groups').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Agenda Points').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Tasks').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Blogs').length).toBeGreaterThan(0);
  });

  it('exposes an items-only TypeaheadCombobox without the data facade', () => {
    const onChange = vi.fn();

    render(
      <TypeaheadCombobox
        items={[buildItem('role-1', 'Treasurer', 'role')]}
        value={undefined}
        onChange={onChange}
        placeholder="Search roles"
      />
    );

    fireEvent.focus(screen.getByPlaceholderText('Search roles'));
    fireEvent.click(screen.getByRole('button', { name: /Treasurer Role/ }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ id: 'role-1' }));
  });
});
