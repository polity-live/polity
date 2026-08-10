/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('../TimelineModeToggle', () => ({ TimelineModeToggle: () => <div>Mode toggle</div> }));
vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, ...props }: any) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));
vi.mock('@/features/shared/ui/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick, ...props }: any) => (
    <button type="button" onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

import { TimelineHeader } from '../TimelineHeader';

afterEach(cleanup);

describe('TimelineHeader', () => {
  it('renders all timeline controls and actions', () => {
    const onFilterClick = vi.fn();
    const onSettingsClick = vi.fn();
    const onSortChange = vi.fn();
    render(
      <TimelineHeader
        mode="timeline"
        onModeChange={vi.fn()}
        sortBy="recent"
        onSortChange={onSortChange}
        onFilterClick={onFilterClick}
        activeFilterCount={2}
        onSettingsClick={onSettingsClick}
        subtitle="Nearby activity"
        className="custom"
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /features.timeline.header.settings/ }));
    fireEvent.click(screen.getByRole('button', { name: /features.timeline.header.filter/ }));
    fireEvent.click(screen.getByRole('button', { name: 'features.timeline.sort.trending' }));
    fireEvent.click(screen.getByRole('button', { name: 'features.timeline.sort.engagement' }));
    expect(onSettingsClick).toHaveBeenCalledOnce();
    expect(onFilterClick).toHaveBeenCalledOnce();
    expect(onSortChange).toHaveBeenCalledWith('trending');
    expect(onSortChange).toHaveBeenCalledWith('engagement');
    expect(screen.getByText('Nearby activity')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('renders decisions without timeline-only controls', () => {
    const { container } = render(
      <TimelineHeader
        mode="decisions"
        onModeChange={vi.fn()}
        sortBy="recent"
        onSortChange={vi.fn()}
        onFilterClick={vi.fn()}
      />
    );
    expect(container.querySelector('[data-action-id="timeline.header.filters.open"]')).toBeNull();
    expect(container.querySelector('[data-action-id="timeline.header.sort.open"]')).toBeNull();
  });

  it('renders the screen-reader title and optional zero-count controls', () => {
    render(
      <TimelineHeader
        mode="timeline"
        onModeChange={vi.fn()}
        sortBy="recent"
        onSortChange={vi.fn()}
        onFilterClick={vi.fn()}
        activeFilterCount={0}
        showSort={false}
        showTitle={false}
      />
    );
    expect(screen.getByRole('heading').className).toContain('sr-only');
    expect(screen.queryByText('0')).toBeNull();
    expect(document.querySelector('[data-action-id="timeline.header.sort.open"]')).toBeNull();
  });
});
