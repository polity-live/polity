/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { SubscriptionStatusView } from '../SubscriptionStatusView';

afterEach(() => {
  cleanup();
});

describe('SubscriptionStatusView loading state', () => {
  it('renders a section skeleton without visible loading description text', () => {
    const { container } = render(<SubscriptionStatusView data={null} isLoading error={null} />);

    expect(container.querySelector('[data-slot="section-skeleton"]')).toBeTruthy();
    expect(screen.queryByText(/loading subscription information/i)).toBeNull();
  });
});
