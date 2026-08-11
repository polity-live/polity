/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const facade = vi.hoisted(() => vi.fn());

vi.mock('@/zero/groups/useGroupState', () => ({
  useGroupDocuments: (groupId: string) => facade(groupId),
}));

import { hasDocumentAccess, isDocumentOwner, useGroupDocuments } from '../useGroupDocuments';

describe('useGroupDocuments branch contracts', () => {
  beforeEach(() => {
    facade.mockReset();
    facade.mockReturnValue({ documents: [{ id: 'document-1' }], isLoading: false });
  });

  it('forwards the group document facade result', () => {
    const { result } = renderHook(() => useGroupDocuments('group-1'));

    expect(facade).toHaveBeenCalledWith('group-1');
    expect(result.current).toEqual({
      documents: [{ id: 'document-1' }],
      error: undefined,
      isLoading: false,
    });
  });

  it('checks missing document and user inputs independently', () => {
    const document = { id: 'document-1' } as never;

    expect(isDocumentOwner(undefined, undefined)).toBe(false);
    expect(isDocumentOwner(document, undefined)).toBe(false);
    expect(isDocumentOwner(document, 'user-1')).toBe(false);
    expect(hasDocumentAccess(undefined, undefined)).toBe(false);
    expect(hasDocumentAccess(document, undefined)).toBe(false);
    expect(hasDocumentAccess(document, 'user-1')).toBe(true);
  });
});
