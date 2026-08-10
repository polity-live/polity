/* @vitest-environment jsdom */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/hooks/use-translation.ts', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { useNameStepController } from '../useNameStepController';

afterEach(cleanup);

function renderController(firstName: string, lastName: string) {
  const callbacks = {
    onFirstNameChange: vi.fn(),
    onLastNameChange: vi.fn(),
    onNext: vi.fn(),
  };
  return {
    callbacks,
    hook: renderHook(() => useNameStepController({ firstName, lastName, ...callbacks })),
  };
}

describe('useNameStepController', () => {
  it('covers short, long, and valid boundaries with touch state', () => {
    const short = renderController(' A ', 'B');
    expect(short.hook.result.current).toMatchObject({
      isFormValid: false,
      firstNameShowError: false,
      firstNameShowSuccess: false,
      lastNameShowSuccess: false,
      firstNameRequirementText: 'onboarding.nameStep.validation.tooShort',
    });
    act(() => short.hook.result.current.onFirstNameBlur());
    expect(short.hook.result.current.firstNameShowError).toBe(true);
    act(() => short.hook.result.current.onLastNameInputChange('Bo'));
    expect(short.callbacks.onLastNameChange).toHaveBeenCalledWith('Bo');
    expect(short.hook.result.current.lastNameShowError).toBe(true);

    const long = renderController('x'.repeat(51), 'y'.repeat(51));
    expect(long.hook.result.current.firstNameRequirementText).toBe(
      'onboarding.nameStep.validation.tooLong'
    );
    expect(long.hook.result.current.lastNameRequirementText).toBe(
      'onboarding.nameStep.validation.tooLong'
    );
    act(() => long.hook.result.current.onLastNameBlur());
    expect(long.hook.result.current.lastNameShowError).toBe(true);

    const valid = renderController(' Ada ', ' Lovelace ');
    expect(valid.hook.result.current).toMatchObject({
      firstNameShowSuccess: true,
      lastNameShowSuccess: true,
      isFormValid: true,
    });
    act(() => valid.hook.result.current.onFirstNameInputChange('Grace'));
    expect(valid.callbacks.onFirstNameChange).toHaveBeenCalledWith('Grace');
  });

  it('prevents invalid submission and advances valid submission', () => {
    const invalid = renderController('A', 'B');
    const invalidEvent = { preventDefault: vi.fn() };
    act(() => invalid.hook.result.current.onSubmit(invalidEvent as never));
    expect(invalidEvent.preventDefault).toHaveBeenCalled();
    expect(invalid.hook.result.current.firstNameShowError).toBe(true);
    expect(invalid.hook.result.current.lastNameShowError).toBe(true);
    expect(invalid.callbacks.onNext).not.toHaveBeenCalled();

    const valid = renderController('Ada', 'Lovelace');
    const validEvent = { preventDefault: vi.fn() };
    act(() => valid.hook.result.current.onSubmit(validEvent as never));
    expect(valid.callbacks.onNext).toHaveBeenCalledTimes(1);
  });
});
