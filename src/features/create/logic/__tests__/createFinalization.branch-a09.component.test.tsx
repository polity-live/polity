/* @vitest-environment jsdom */

import { renderToString } from 'react-dom/server';
import { expect, it, vi } from 'vitest';

import {
  openCreateRecoveryTarget,
  pruneExpiredCreateRecoveryDrafts,
  subscribeCreateRecoveryDrafts,
  useCreateRecoveryDraft,
  type CreateRecoveryDraft,
} from '../createFinalization';

function draft(): CreateRecoveryDraft {
  return {
    id: 'group:coverage',
    entityType: 'group',
    entityId: 'coverage',
    createPath: '/create/group',
    formState: {},
    mutationPayload: {},
    target: {
      kind: 'route',
      entityType: 'group',
      to: '/group/$id',
      params: { id: 'coverage' },
    },
    submittedAt: 1,
    status: 'pending',
  };
}

function RecoveryProbe() {
  useCreateRecoveryDraft('group', 'coverage');
  return null;
}

it('executes server and browser subscription cleanup paths', () => {
  const browserWindow = window;
  vi.stubGlobal('window', undefined);
  try {
    const unsubscribe = subscribeCreateRecoveryDrafts(vi.fn());
    unsubscribe();
    renderToString(<RecoveryProbe />);
  } finally {
    vi.stubGlobal('window', browserWindow);
  }

  const unsubscribe = subscribeCreateRecoveryDrafts(vi.fn());
  unsubscribe();
});

it('prunes a recovery key removed between enumeration and lookup', () => {
  const key = 'polity:create:recovery:race';
  window.sessionStorage.setItem(key, JSON.stringify(draft()));
  const getItem = vi.spyOn(Storage.prototype, 'getItem').mockReturnValueOnce(null);
  try {
    pruneExpiredCreateRecoveryDrafts();
  } finally {
    getItem.mockRestore();
  }
  expect(window.sessionStorage.getItem(key)).toBeNull();
});

it('opens the computed recovery target', () => {
  openCreateRecoveryTarget(draft());
});
