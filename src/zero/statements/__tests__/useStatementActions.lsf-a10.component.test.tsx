/* @vitest-environment jsdom */

import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const action = (name: string) => vi.fn((args: unknown) => ({ name, args }));
  return {
    mutate: vi.fn((descriptor: unknown) => ({ descriptor })),
    onServerError: vi.fn(),
    trackCreation: vi.fn(),
    toastError: vi.fn(),
    toastSuccess: vi.fn(),
    statements: {
      create: action('create'),
      createFull: action('createFull'),
      update: action('update'),
      delete: action('delete'),
      createSupportVote: action('createSupportVote'),
      updateSupportVote: action('updateSupportVote'),
      deleteSupportVote: action('deleteSupportVote'),
      createSurvey: action('createSurvey'),
      deleteSurvey: action('deleteSurvey'),
      createSurveyOption: action('createSurveyOption'),
      deleteSurveyOption: action('deleteSurveyOption'),
      createSurveyVote: action('createSurveyVote'),
      deleteSurveyVote: action('deleteSurveyVote'),
    },
  };
});

vi.mock('@rocicorp/zero/react', () => ({ useZero: () => ({ mutate: mocks.mutate }) }));
vi.mock('../../mutators', () => ({ mutators: { statements: mocks.statements } }));
vi.mock('../../mutate-with-server-check', () => ({
  onServerError: (result: unknown, callback: (message: string) => void) => {
    mocks.onServerError(result);
    callback('server error');
  },
}));
vi.mock('@/features/notifications/utils/mutation-finalization', () => ({
  trackCreationUnlessSilent: mocks.trackCreation,
}));
vi.mock('@/features/notifications/utils/gated-toast', () => ({
  gatedToast: { error: mocks.toastError, success: mocks.toastSuccess },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { useStatementActions } from '../useStatementActions';

describe('useStatementActions action facade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('invokes every exposed action and its error/success callback', () => {
    const { result } = renderHook(() => useStatementActions());
    const options = { notificationMode: 'silent' as const };

    result.current.createStatement({ id: 'statement' } as never, options);
    result.current.createFullStatement({ statement: { id: 'full' } } as never, options);
    result.current.updateStatement({ id: 'statement' } as never);
    result.current.deleteStatement('statement');
    result.current.createSupportVote({ id: 'support' } as never);
    result.current.updateSupportVote({ id: 'support' } as never);
    result.current.deleteSupportVote('support');
    result.current.createSurvey({ id: 'survey' } as never, options);
    result.current.deleteSurvey('survey');
    result.current.createSurveyOption({ id: 'option' } as never);
    result.current.deleteSurveyOption('option');
    result.current.createSurveyVote({ id: 'survey-vote' } as never);
    result.current.deleteSurveyVote('survey-vote');
    result.current.updateStatementSilent({ id: 'silent' } as never);

    expect(mocks.mutate).toHaveBeenCalledTimes(14);
    expect(mocks.trackCreation).toHaveBeenCalledWith(
      expect.anything(),
      'statement',
      options,
      'statement'
    );
    expect(mocks.trackCreation).toHaveBeenCalledWith(
      expect.anything(),
      'statement',
      options,
      'full'
    );
    expect(mocks.trackCreation).toHaveBeenCalledWith(
      expect.anything(),
      'survey',
      options,
      'survey'
    );
    expect(mocks.toastSuccess).toHaveBeenCalledTimes(3);
    expect(mocks.toastError).toHaveBeenCalledTimes(7);
    expect(console.error).toHaveBeenCalledTimes(4);
  });
});
