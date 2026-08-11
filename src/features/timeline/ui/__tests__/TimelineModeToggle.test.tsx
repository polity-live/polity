/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

  it('does not reference nonexistent tab panels through aria-controls', () => {
    render(<TimelineModeToggle mode="timeline" onModeChange={vi.fn()} />);

    expect(
      screen
        .getByRole('radio', { name: 'features.timeline.modes.timeline' })
        .hasAttribute('aria-controls')
    ).toBe(false);
    expect(
      screen
        .getByRole('radio', { name: 'features.timeline.modes.decisions' })
        .hasAttribute('aria-controls')
    ).toBe(false);
  });

  it('changes to either mode and ignores an empty deselection', () => {
    const onModeChange = vi.fn();
    const { rerender } = render(<TimelineModeToggle mode="timeline" onModeChange={onModeChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'features.timeline.modes.decisions' }));
    expect(onModeChange).toHaveBeenCalledWith('decisions');

    rerender(<TimelineModeToggle mode="decisions" onModeChange={onModeChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'features.timeline.modes.timeline' }));
    expect(onModeChange).toHaveBeenCalledWith('timeline');
    fireEvent.click(screen.getByRole('radio', { name: 'features.timeline.modes.decisions' }));
    expect(onModeChange).toHaveBeenCalledTimes(2);
  });

  it('renders active following badges, caps them, and omits zero counts', () => {
    const { rerender } = render(
      <TimelineModeToggle
        mode="timeline"
        onModeChange={vi.fn()}
        followingBadge={3}
        decisionsBadge={0}
      />
    );
    const badge = screen.getByText('3').closest('[data-slot="badge-control"]') as HTMLElement;
    expect(badge.className).toContain('bg-primary-foreground/20');
    expect(screen.queryByText('0')).toBeNull();

    rerender(<TimelineModeToggle mode="timeline" onModeChange={vi.fn()} followingBadge={100} />);
    expect(screen.getByText('99+')).toBeTruthy();
  });

  it('shows the urgent indicator only for inactive decisions with a positive count', () => {
    const { container, rerender } = render(
      <TimelineModeToggle
        mode="timeline"
        onModeChange={vi.fn()}
        decisionsBadge={2}
        className="custom"
      />
    );
    expect(container.querySelector('.custom')).toBeTruthy();
    expect(container.querySelector('.absolute')).toBeTruthy();

    rerender(<TimelineModeToggle mode="decisions" onModeChange={vi.fn()} decisionsBadge={2} />);
    expect(container.querySelector('.absolute')).toBeNull();
  });
});
