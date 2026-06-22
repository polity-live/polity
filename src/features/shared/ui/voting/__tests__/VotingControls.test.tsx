/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { VotingPhaseBadge } from '../VotingControls';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

afterEach(() => {
  cleanup();
});

describe('VotingPhaseBadge', () => {
  it('keeps the final vote pulse while using dark-mode-safe success tokens', () => {
    render(<VotingPhaseBadge phase="final" labels={{ final: 'Final Vote' }} />);

    const badge = screen.getByText('Final Vote');

    expect(badge.className).toContain('animate-pulse');
    expect(badge.className).toContain('border-[var(--badge-success-border)]');
    expect(badge.className).toContain('bg-[var(--badge-success-bg)]');
    expect(badge.className).toContain('text-[var(--badge-success-fg)]');
    expect(badge.className).not.toContain('text-white');
  });
});
