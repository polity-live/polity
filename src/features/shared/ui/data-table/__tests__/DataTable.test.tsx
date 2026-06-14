/* @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DataTable, type ColumnDef } from '../DataTable';

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
});
