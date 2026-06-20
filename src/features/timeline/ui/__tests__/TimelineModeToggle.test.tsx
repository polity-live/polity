/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TimelineModeToggle } from '../TimelineModeToggle';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) => fallback ?? key,
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

afterEach(() => {
  cleanup();
});

describe('TimelineModeToggle', () => {
  it('keeps the decisions count readable on the light active tab in dark mode', () => {
    render(<TimelineModeToggle mode="decisions" onModeChange={vi.fn()} decisionsBadge={1} />);

    const badge = screen.getByText('1').closest('[data-slot="badge-control"]') as HTMLElement;

    expect(badge).toBeTruthy();
    expect(badge.className).toContain('dark:border-transparent');
    expect(badge.className).toContain('dark:bg-[#8a332b]');
    expect(badge.className).toContain('dark:text-slate-50');
    expect(badge.className).toContain('dark:hover:bg-[#8a332b]');
    expect(badge.className).toContain('dark:hover:text-slate-50');
  });

  it('caps large decisions counts at 99+', () => {
    render(<TimelineModeToggle mode="decisions" onModeChange={vi.fn()} decisionsBadge={100} />);

    expect(screen.getByText('99+')).toBeTruthy();
  });
});
