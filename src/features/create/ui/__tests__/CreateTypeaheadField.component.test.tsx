// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { TypeaheadItem } from '@/features/shared/logic/typeaheadHelpers';
import { CreateTypeaheadField } from '@/features/shared/ui/form';

const items: TypeaheadItem[] = [
  {
    id: 'group-1',
    entityType: 'group',
    label: 'Budget Circle',
    secondaryLabel: 'Meta',
  },
  {
    id: 'user-1',
    entityType: 'user',
    label: 'Alice Example',
    secondaryLabel: '@alice',
  },
];

describe('CreateTypeaheadField', () => {
  it('validates required single-select fields', async () => {
    function SingleHarness() {
      const [value, setValue] = useState<string | undefined>(undefined);
      return (
        <CreateTypeaheadField
          items={[items[0]]}
          value={value}
          onChange={item => setValue(item?.id)}
          label="Group"
          hint="Pick a group"
          required
          placeholder="Search groups"
        />
      );
    }

    render(<SingleHarness />);

    expect(screen.getByText('Pick a group')).toBeTruthy();

    fireEvent.focus(screen.getByPlaceholderText('Search groups'));
    expect(screen.getByText('Required.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Budget Circle/i }));

    await waitFor(() => {
      expect(screen.getByText('Pick a group')).toBeTruthy();
    });
    expect(screen.getByText('Budget Circle')).toBeTruthy();
  });

  it('validates required multi-select fields', async () => {
    function MultiHarness() {
      const [values, setValues] = useState<string[]>([]);
      return (
        <CreateTypeaheadField
          items={[items[1]]}
          multiple
          values={values}
          onValuesChange={setValues}
          label="People"
          hint="Pick collaborators"
          required
          placeholder="Search people"
        />
      );
    }

    render(<MultiHarness />);

    expect(screen.getByText('Pick collaborators')).toBeTruthy();

    fireEvent.focus(screen.getByPlaceholderText('Search people'));
    expect(screen.getAllByText('Required.').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /Alice Example/i }));

    await waitFor(() => {
      expect(screen.getByText('Pick collaborators')).toBeTruthy();
    });
    expect(screen.getByText('Alice Example')).toBeTruthy();
  });
});
