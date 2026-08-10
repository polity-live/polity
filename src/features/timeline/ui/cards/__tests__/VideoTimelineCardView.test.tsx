/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  baseProps: undefined as Record<string, any> | undefined,
  shareProps: undefined as Record<string, any> | undefined,
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/features/shared/ui/action-buttons/ShareButton.tsx', () => ({
  ShareButton: (props: Record<string, any>) => {
    mocks.shareProps = props;
    return <button type="button">Share</button>;
  },
}));
vi.mock('@/features/shared/theme', () => ({
  featureThemeClassName: (name: string) => name,
}));
vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock('@/features/shared/ui/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  TooltipContent: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock('@/features/shared/ui/ui/dialog', () => ({
  Dialog: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  DialogHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));
vi.mock('@/features/shared/ui/dialog', () => ({
  ScrollableDialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('../TimelineCardBase', () => ({
  TimelineCardBase: (props: Record<string, any>) => {
    mocks.baseProps = props;
    return <article>{props.children}</article>;
  },
  TimelineCardContent: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  TimelineCardActions: ({ children }: { children: ReactNode }) => <footer>{children}</footer>,
  TimelineCardActionButton: ({ label, onClick, ...props }: any) => (
    <button type="button" onClick={onClick} {...props}>
      {label}
    </button>
  ),
}));

import { formatDuration, formatViews, VideoTimelineCardView } from '../VideoTimelineCardView';

function props(overrides: Record<string, any> = {}) {
  return {
    video: { id: 'video-1', title: 'Public hearing clip' },
    onPlay: undefined,
    className: undefined,
    t: (key: string) => key,
    playerOpen: false,
    setPlayerOpen: vi.fn(),
    sourceHref: undefined,
    amendmentHref: undefined,
    targetHref: undefined,
    ...overrides,
  };
}

beforeEach(() => {
  mocks.baseProps = undefined;
  mocks.shareProps = undefined;
});
afterEach(cleanup);

describe('VideoTimelineCardView', () => {
  it('formats short and long durations and all view-count scales', () => {
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(3661)).toBe('1:01:01');
    expect(formatViews(12)).toBe('12');
    expect(formatViews(1500)).toBe('1.5K');
    expect(formatViews(2_000_000)).toBe('2.0M');
  });

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

  it('renders rich metadata and opens the player by pointer and keyboard', () => {
    const onPlay = vi.fn();
    const viewProps = props({
      video: {
        id: 'video-1',
        title: 'Public hearing clip',
        thumbnailUrl: '/thumb.jpg',
        duration: 65,
        views: 1500,
        authorName: 'Ada',
        authorAvatar: '/ada.jpg',
        sourceType: 'event',
        sourceName: 'Assembly',
        videoUrl: '/clip.mp4',
      },
      onPlay,
      targetHref: '/event/event-1',
    });
    const { container } = render(<VideoTimelineCardView {...(viewProps as any)} />);
    const playSurface = container.querySelector('[data-timeline-card-media]')!;

    fireEvent.click(playSurface);
    fireEvent.keyDown(playSurface, { key: 'Enter' });
    fireEvent.keyDown(playSurface, { key: ' ' });
    fireEvent.keyDown(playSurface, { key: 'Escape' });
    fireEvent.click(container.querySelector('[data-action-id="timeline.video.play"]')!);

    expect(viewProps.setPlayerOpen).toHaveBeenCalledTimes(4);
    expect(onPlay).toHaveBeenCalledTimes(4);
    expect(screen.getByRole('img', { name: 'Public hearing clip' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Ada' })).toBeTruthy();
    expect(container.textContent).toContain('1:05');
    expect(container.textContent).toContain('Event Recording');
    expect(container.textContent).toContain('1.5K');
    expect(container.querySelector('video')?.getAttribute('src')).toBe('/clip.mp4');
    expect(mocks.baseProps?.href).toBe('/event/event-1');
    expect(mocks.shareProps).toMatchObject({
      url: '/event/event-1',
      title: 'Public hearing clip',
      description: 'Assembly',
    });
  });

  it('renders all fallbacks and tolerates absent play callbacks', () => {
    const viewProps = props();
    const { container } = render(<VideoTimelineCardView {...(viewProps as any)} />);
    fireEvent.click(container.querySelector('[data-timeline-card-media]')!);
    fireEvent.click(container.querySelector('[data-action-id="timeline.video.play"]')!);

    expect(viewProps.setPlayerOpen).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('features.timeline.cards.videoUnavailable');
    expect(mocks.shareProps).toMatchObject({
      url: '/video/video-1',
      description: '',
    });
    expect(screen.queryByRole('link', { name: 'Public hearing clip' })).toBeNull();
  });

  it('renders source-only author metadata, zero views, and unknown source labels', () => {
    const viewProps = props({
      video: {
        id: 'video-1',
        title: 'Guest clip',
        views: 0,
        sourceType: 'external',
        sourceName: 'Guest source',
      },
    });
    const { container } = render(<VideoTimelineCardView {...(viewProps as any)} />);
    expect(container.textContent).toContain('external');
    expect(container.textContent).toContain('Guest source');
    expect(container.textContent).toContain('0');
    expect(mocks.shareProps?.description).toBe('Guest source');
  });
});
