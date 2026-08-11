import { describe, expect, it } from 'vitest';

import { getBranchPreservingAmendmentNavTarget } from '../amendmentBranchNavigation';

describe('getBranchPreservingAmendmentNavTarget', () => {
  it('preserves branch search params for text, change requests, and process pages', () => {
    expect(
      getBranchPreservingAmendmentNavTarget({
        itemId: 'text',
        amendmentId: 'amendment-1',
        branchId: 'branch/a',
      })
    ).toEqual({
      to: '/amendment/$id/text',
      params: { id: 'amendment-1' },
      href: '/amendment/amendment-1/text?branch=branch%2Fa',
      search: { branch: 'branch/a' },
    });

    expect(
      getBranchPreservingAmendmentNavTarget({
        itemId: 'changeRequests',
        amendmentId: 'amendment-1',
        branchId: 'branch-2',
      })?.href
    ).toBe('/amendment/amendment-1/change-requests?branch=branch-2');

    expect(
      getBranchPreservingAmendmentNavTarget({
        itemId: 'process',
        amendmentId: 'amendment-1',
        branchId: 'branch-2',
      })?.href
    ).toBe('/amendment/amendment-1/process?branch=branch-2');
  });

  it('ignores amendment nav items that are not branch scoped', () => {
    expect(
      getBranchPreservingAmendmentNavTarget({
        itemId: 'overview',
        amendmentId: 'amendment-1',
        branchId: 'branch-1',
      })
    ).toBeNull();

    expect(
      getBranchPreservingAmendmentNavTarget({
        itemId: 'text',
        amendmentId: null,
        branchId: 'branch-1',
      })
    ).toBeNull();
    expect(
      getBranchPreservingAmendmentNavTarget({
        itemId: 'text',
        amendmentId: 'amendment-1',
        branchId: null,
      })
    ).toBeNull();
  });
});
