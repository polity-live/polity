/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/features/shared/ui/action-buttons/ShareButton.tsx', () => ({
  ShareButton: () => <button type="button">Share</button>,
}));

import { VideoTimelineCardView } from '../VideoTimelineCardView';

afterEach(cleanup);

describe('VideoTimelineCardView', () => {
  it('renders the video title as a native link when a target href exists', () => {
    render(
      <VideoTimelineCardView
        video={{ id: 'video-1', title: 'Public hearing clip' }}
        onPlay={vi.fn()}
        className=""
        t={(key: string) => key}
        playerOpen={false}
        setPlayerOpen={vi.fn()}
        sourceHref={undefined}
        amendmentHref={undefined}
        targetHref="/statement/statement-1"
      />
    );

    expect(screen.getByRole('link', { name: 'Public hearing clip' }).getAttribute('href')).toBe(
      '/statement/statement-1'
    );
  });
});
