import { describe, expect, it } from 'vitest';
import { hasGroupOperationAccess } from '../hasGroupOperationAccess';

describe('hasGroupOperationAccess', () => {
  it('returns true when at least one operation section is viewable', () => {
    expect(
      hasGroupOperationAccess({
        canViewDocuments: false,
        canViewLinks: true,
        canViewPayments: false,
        canViewTodos: false,
      })
    ).toBe(true);
  });

  it('returns false when no operation section is viewable', () => {
    expect(
      hasGroupOperationAccess({
        canViewDocuments: false,
        canViewLinks: false,
        canViewPayments: false,
        canViewTodos: false,
      })
    ).toBe(false);
  });
});
