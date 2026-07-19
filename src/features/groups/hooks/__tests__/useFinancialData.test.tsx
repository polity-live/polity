/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { GroupPayment } from '../../types/group.types';
import { useFinancialData } from '../useFinancialData';

describe('useFinancialData', () => {
  it('shows only payment types in the income breakdown', () => {
    const payments = [
      {
        amount: 300,
        type: 'campaign',
        receiver_group: { id: 'group-1' },
      },
      {
        amount: 200,
        type: 'donation',
        receiver_group: { id: 'group-1' },
      },
      {
        amount: 100,
        type: 'material',
        receiver_group: { id: 'another-group' },
      },
    ] as GroupPayment[];

    const { result } = renderHook(() => useFinancialData(payments, 'group-1'));

    expect(result.current.summary).toEqual({
      income: 500,
      expenditure: 100,
      balance: 400,
    });
    expect(result.current.incomeData.map(({ name, value }) => ({ name, value }))).toEqual([
      { name: 'campaign', value: 300 },
      { name: 'donation', value: 200 },
    ]);
    expect(result.current.incomeData).not.toContainEqual(
      expect.objectContaining({ name: 'Available' })
    );
  });
});
