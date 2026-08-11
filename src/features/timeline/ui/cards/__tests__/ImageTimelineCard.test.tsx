/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  baseProps: undefined as Record<string, any> | undefined,
  shareProps: undefined as Record<string, any> | undefined,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/theme', () => ({ featureThemeClassName: (name: string) => name }));
vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock('@/features/shared/ui/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  TooltipContent: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock('@/features/shared/ui/action-buttons/ShareButton.tsx', () => ({
  ShareButton: (props: Record<string, any>) => {
    mocks.shareProps = props;
    return <button type="button">Share</button>;
  },
}));
vi.mock('../TimelineCardBase', () => ({
  TimelineCardBase: (props: Record<string, any>) => {
    mocks.baseProps = props;
    return <article>{props.children}</article>;
  },
  TimelineCardContent: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  TimelineCardActions: ({ children }: { children: ReactNode }) => <footer>{children}</footer>,
}));

import { formatCount, ImageTimelineCard } from '../ImageTimelineCard';

beforeEach(() => {
  mocks.baseProps = undefined;
  mocks.shareProps = undefined;
});
afterEach(cleanup);

describe('ImageTimelineCard', () => {
  it('formats small and abbreviated counts', () => {
    expect(formatCount(12)).toBe('12');
    expect(formatCount(1500)).toBe('1.5K');
  });

  it('renders bare fallbacks and ignores unrelated keyboard keys', () => {
    const { container } = render(
      <ImageTimelineCard image={{ id: 'image-1', imageUrl: '/image.jpg' }} />
    );
    const media = container.querySelector('[data-timeline-card-media]')!;
    fireEvent.keyDown(media, { key: 'Escape' });
    fireEvent.keyDown(media, { key: 'Enter' });
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('common.entities.image');
    expect(mocks.baseProps?.href).toBeUndefined();
    expect(mocks.shareProps).toMatchObject({
      url: '/image/image-1',
      title: 'features.timeline.contentTypes.image',
      description: '',
    });
  });

  it('renders rich metadata and routes to the source', () => {
    const onImageClick = vi.fn();
    const image = {
      id: 'image-1',
      imageUrl: '/image.jpg',
      caption: 'Town hall',
      location: 'Berlin',
      likes: 1500,
      comments: 0,
      authorName: 'Ada',
      authorAvatar: '/ada.jpg',
      sourceType: 'event' as const,
      sourceId: 'event-1',
      sourceName: 'Assembly',
    };
    const { container } = render(<ImageTimelineCard image={image} onImageClick={onImageClick} />);
    const media = container.querySelector('[data-timeline-card-media]')!;
    fireEvent.click(media);
    fireEvent.keyDown(media, { key: 'Enter' });
    fireEvent.keyDown(media, { key: ' ' });
    expect(onImageClick).toHaveBeenCalledTimes(3);
    expect(mocks.baseProps?.href).toBe('/event/event-1');
    expect(container.textContent).toContain('Town hall');
    expect(container.textContent).toContain('Berlin');
    expect(container.textContent).toContain('1.5K');
    expect(mocks.shareProps).toMatchObject({
      url: '/event/event-1',
      title: 'Town hall',
      description: 'Berlin',
    });
  });

  it('prioritizes href and renders unknown source and source-only author fallbacks', () => {
    const { container } = render(
      <ImageTimelineCard
        href="/custom"
        image={{
          id: 'image-1',
          imageUrl: '/image.jpg',
          sourceType: 'external' as any,
          sourceName: 'Guest',
          likes: 0,
        }}
      />
    );
    expect(mocks.baseProps?.href).toBe('/custom');
    expect(container.textContent).toContain('external');
    expect(container.textContent).toContain('Guest');
  });
});
