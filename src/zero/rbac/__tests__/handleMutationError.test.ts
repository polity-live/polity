import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  GroupConflictError,
  type GroupConflictResponse,
} from '@/features/groups/logic/groupConflict';
import { PermissionError } from '../errors';
import { handleMutationError } from '../handleMutationError';

const mocks = vi.hoisted(() => ({ toastError: vi.fn() }));

vi.mock('sonner', () => ({ toast: { error: mocks.toastError } }));

beforeEach(() => {
  mocks.toastError.mockReset();
});

describe('handleMutationError', () => {
  it('renders structured group conflicts ahead of generic errors', () => {
    const response: GroupConflictResponse = {
      blocking: true,
      summary: 'Membership conflict',
      conflicts: [
        {
          kind: 'hierarchy_member_overlap',
          blocking: true,
          summary: 'Membership conflict',
          explanation: 'The user already belongs to a connected subgroup.',
          details: { users: [], groups: [], source_groups: [], paths: [] },
          resolutions: [],
        },
      ],
    };

    handleMutationError(new GroupConflictError(response), 'Could not save');

    expect(mocks.toastError).toHaveBeenCalledWith('Membership conflict', {
      description: 'The user already belongs to a connected subgroup.',
    });
  });

  it('falls back safely for an empty structured conflict response', () => {
    handleMutationError(
      new GroupConflictError({ blocking: true, summary: null, conflicts: [] }),
      'Could not save'
    );

    expect(mocks.toastError).toHaveBeenCalledWith('Could not save', {
      description: undefined,
    });
  });

  it('localizes permission errors when a translator is available', () => {
    const translate = vi.fn(() => 'No permission');
    const error = new PermissionError('manage', 'groups', 'group:one');

    handleMutationError(error, 'Could not save', translate);

    expect(translate).toHaveBeenCalledWith('errors.permissionDenied');
    expect(mocks.toastError).toHaveBeenCalledWith('No permission', {
      description: error.message,
    });
  });

  it('uses the stable default permission copy without a translator', () => {
    const error = new PermissionError('view', 'events');

    handleMutationError(error, 'Could not load');

    expect(mocks.toastError).toHaveBeenCalledWith('Permission denied', {
      description: error.message,
    });
  });

  it('uses the caller fallback for unknown failures', () => {
    handleMutationError({ reason: 'offline' }, 'Could not save');

    expect(mocks.toastError).toHaveBeenCalledWith('Could not save');
  });
});
