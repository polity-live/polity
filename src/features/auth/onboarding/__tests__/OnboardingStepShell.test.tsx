/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { OnboardingStepShell } from '../OnboardingStepShell';

afterEach(cleanup);

describe('OnboardingStepShell', () => {
  it('keeps content scrollable while the floating actions remain outside the scroll region', () => {
    const { container } = render(
      <OnboardingStepShell actions={<button type="button">Continue</button>}>
        <div>Long step content</div>
      </OnboardingStepShell>
    );

    const shell = container.querySelector('[data-slot="onboarding-step-shell"]');
    const content = container.querySelector('[data-slot="onboarding-step-content"]');
    const actionBar = container.querySelector('[data-slot="onboarding-action-bar"]');
    const continueButton = screen.getByRole('button', { name: 'Continue' });

    expect(shell?.className).toContain('h-full');
    expect(shell?.className).toContain('min-h-0');
    expect(content?.className).toContain('overflow-y-auto');
    expect(content?.contains(continueButton)).toBe(false);
    expect(actionBar?.contains(continueButton)).toBe(true);
    expect(actionBar?.className).toContain('static');
    expect(actionBar?.className).toContain('safe-area-inset-bottom');
  });
});
