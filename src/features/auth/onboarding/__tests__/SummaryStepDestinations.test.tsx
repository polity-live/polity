/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/hooks/use-translation.ts', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { SummaryStep } from '../SummaryStep';

afterEach(cleanup);

describe('SummaryStep destinations', () => {
  it('offers exactly the three onboarding paths and marks the guided path recommended', () => {
    const onComplete = vi.fn();
    render(
      <SummaryStep
        firstName="Ada"
        lastName="Lovelace"
        selectedGroups={[]}
        selectedInterestTags={[]}
        activeGroupId={null}
        membershipRequestSentGroupIds={[]}
        userId="user-1"
        onComplete={onComplete}
      />
    );

    const guided = screen.getByRole('link', { name: /onboarding.summaryStep.explainApp/ });
    const assistant = screen.getByRole('link', {
      name: 'onboarding.summaryStep.exploreWithAssistant',
    });
    const search = screen.getByRole('link', {
      name: 'onboarding.summaryStep.exploreAlone',
    });

    expect(guided.getAttribute('href')).toBe('/onboarding');
    expect(guided.textContent).toContain('onboarding.summaryStep.recommended');
    expect(assistant.getAttribute('href')).toBe('/messages?openAriaKai=true');
    expect(search.getAttribute('href')).toBe('/search');
    expect(screen.getAllByRole('link')).toHaveLength(3);

    fireEvent.click(guided);
    expect(onComplete).toHaveBeenCalledOnce();
  });
});
