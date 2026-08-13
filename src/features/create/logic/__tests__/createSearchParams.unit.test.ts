import { describe, expect, it } from 'vitest';
import { mergeCreateSearchParams } from '@/features/create/logic/createSearchParams';

describe('mergeCreateSearchParams', () => {
  it('preserves unrelated search params while updating the group prefill', () => {
    expect(
      mergeCreateSearchParams(
        {
          groupId: 'group-1',
          direction: 'income',
          startDate: '2026-05-25',
        },
        {
          groupId: 'group-2',
        }
      )
    ).toEqual({
      groupId: 'group-2',
      direction: 'income',
      startDate: '2026-05-25',
    });
  });

  it('removes empty group prefills without dropping other route state', () => {
    expect(
      mergeCreateSearchParams(
        {
          groupId: 'group-1',
          returnSection: 'payments',
          direction: 'expense',
        },
        {
          groupId: undefined,
        }
      )
    ).toEqual({
      returnSection: 'payments',
      direction: 'expense',
    });
  });
});
