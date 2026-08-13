/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/theme', () => ({ featureThemeClassName: (key: string) => key }));
vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));
vi.mock('@/features/shared/ui/hashtags', () => ({
  HashtagDisplay: () => <span>Hashtags</span>,
}));
vi.mock('@/features/shared/ui/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('@/features/shared/ui/action-buttons/ShareButton.tsx', () => ({
  ShareButton: () => <button type="button">Share</button>,
}));
vi.mock('../../../constants/content-type-config', () => ({
  CONTENT_TYPE_CONFIG: {
    statement: { borderColor: 'statement-border', accentColor: 'statement-accent' },
  },
}));
vi.mock('../TimelineCardBase', () => ({
  TimelineCardBase: ({ children }: { children: ReactNode }) => <article>{children}</article>,
  TimelineCardHeader: ({ children, title }: { children: ReactNode; title: string }) => (
    <header>
      {title}
      {children}
    </header>
  ),
  TimelineCardContent: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  TimelineCardActions: ({ children }: { children: ReactNode }) => <footer>{children}</footer>,
  TimelineCardBadge: ({ label }: { label: string }) => <span>{label}</span>,
}));

import { StatementTimelineCard } from '../StatementTimelineCard';

afterEach(cleanup);

describe('statement timeline interaction branches A04', () => {
  it('prevents card navigation from hashtag and share interaction containers', () => {
    render(
      <StatementTimelineCard
        statement={{
          id: 'statement-1',
          authorName: 'Ada',
          content: 'Statement',
          hashtags: [{ id: 'hashtag-1', tag: 'polity' }],
        }}
      />
    );

    const hashtagEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
    screen.getByText('Hashtags').parentElement?.dispatchEvent(hashtagEvent);
    expect(hashtagEvent.defaultPrevented).toBe(true);

    const share = screen.getByRole('button', { name: 'Share' });
    fireEvent.click(share.parentElement!);
  });
});
