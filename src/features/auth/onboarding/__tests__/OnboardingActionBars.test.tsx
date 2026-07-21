/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/hooks/use-translation.ts', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));

import type { Group } from '../../hooks/useOnboarding';
import { MembershipConfirmStep } from '../MembershipConfirmStep';
import { NameStepView } from '../NameStepView';

afterEach(cleanup);

const group: Group = {
  id: 'group-1',
  name: 'Civic Group',
  member_count: 12,
  visibility: 'public',
};

describe('onboarding action bars', () => {
  it('submits the name form from the floating action bar', () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const { container } = render(
      <NameStepView
        firstName="Ada"
        lastName="Lovelace"
        firstNameRequirementText="Valid"
        firstNameShowError={false}
        firstNameShowSuccess
        isFormValid
        labels={{
          continue: 'Continue',
          description: 'Description',
          firstName: 'First name',
          firstNamePlaceholder: 'First name',
          lastName: 'Last name',
          lastNamePlaceholder: 'Last name',
          title: 'Name',
        }}
        lastNameRequirementText="Valid"
        lastNameShowError={false}
        lastNameShowSuccess
        onFirstNameBlur={() => undefined}
        onFirstNameInputChange={() => undefined}
        onLastNameBlur={() => undefined}
        onLastNameInputChange={() => undefined}
        onSubmit={onSubmit}
      />
    );

    const actionBar = container.querySelector('[data-slot="onboarding-action-bar"]');
    const continueButton = screen.getByRole('button', { name: 'Continue' });

    expect(actionBar?.contains(continueButton)).toBe(true);
    fireEvent.click(continueButton);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('keeps request, decline, and back callbacks in the confirmation action bar', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onDecline = vi.fn();
    const onBack = vi.fn();
    const { container } = render(
      <MembershipConfirmStep
        groups={[group]}
        requestedGroupIds={[]}
        onConfirm={onConfirm}
        onDecline={onDecline}
        onBack={onBack}
      />
    );

    const actionBar = container.querySelector('[data-slot="onboarding-action-bar"]');
    const confirmButton = screen.getByRole('button', { name: 'onboarding.confirmStep.yes' });
    const declineButton = screen.getByRole('button', { name: 'onboarding.confirmStep.no' });
    const backButton = screen.getByRole('button', { name: 'common.goBack' });

    expect(actionBar?.contains(confirmButton)).toBe(true);
    expect(actionBar?.contains(declineButton)).toBe(true);
    expect(actionBar?.contains(backButton)).toBe(true);

    fireEvent.click(confirmButton);
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    fireEvent.click(declineButton);
    fireEvent.click(backButton);
    expect(onDecline).toHaveBeenCalledTimes(1);
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
