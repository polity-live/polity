/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { DataTable, type ColumnDef } from '../DataTable';
import { Card } from '../../ui/card';

interface Row {
  id: string;
  name: string;
}

const columns: ColumnDef<Row>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: info => info.getValue(),
  },
];

afterEach(() => {
  cleanup();
});

describe('DataTable', () => {
  it('renders rows and row test ids', () => {
    render(
      <DataTable
        columns={columns}
        data={[{ id: '1', name: 'Ada Lovelace' }]}
        rowTestId={row => `row-${row.id}`}
      />
    );

    expect(screen.getByText('Ada Lovelace')).toBeTruthy();
    expect(screen.getByTestId('row-1')).toBeTruthy();
  });

  it('supports the emptyState object API', () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        emptyState={{ title: 'No delegates', description: 'Invite a delegate first.' }}
      />
    );

    expect(screen.getByText('No delegates')).toBeTruthy();
    expect(screen.getByText('Invite a delegate first.')).toBeTruthy();
  });

  it('renders a first-layer card surface when used directly on the page', () => {
    render(<DataTable columns={columns} data={[{ id: '1', name: 'Ada Lovelace' }]} />);

    const surface = document.querySelector('[data-slot="data-table-surface"]');

    expect(surface).toBeTruthy();
    expect(surface?.getAttribute('data-surface')).toBe('standalone');
    expect(surface?.className).toContain('bg-card');
    expect(surface?.className).toContain('rounded-md');
    expect(surface?.className).toContain('shadow-[var(--shadow-panel)]');
  });

  it('keeps the table as a card by default even inside another surface', () => {
    render(
      <Card>
        <DataTable columns={columns} data={[{ id: '1', name: 'Ada Lovelace' }]} />
      </Card>
    );

    const surface = document.querySelector('[data-slot="data-table-surface"]');

    expect(surface).toBeTruthy();
    expect(surface?.getAttribute('data-surface')).toBe('standalone');
    expect(surface?.className).toContain('bg-card');
    expect(surface?.className).toContain('rounded-md');
    expect(surface?.className).toContain('shadow-[var(--shadow-panel)]');
  });

  it('can flatten table chrome when explicitly requested', () => {
    render(
      <DataTable columns={columns} data={[{ id: '1', name: 'Ada Lovelace' }]} surface="embedded" />
    );

    const surface = document.querySelector('[data-slot="data-table-surface"]');

    expect(surface).toBeTruthy();
    expect(surface?.getAttribute('data-surface')).toBe('embedded');
    expect(surface?.className).toContain('border-y');
    expect(surface?.className).not.toContain('bg-card');
  });
});
