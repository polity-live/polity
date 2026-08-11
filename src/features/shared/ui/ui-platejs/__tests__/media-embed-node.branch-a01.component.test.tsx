/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  media: {} as Record<string, unknown>,
  width: 640 as number | string,
}));

vi.mock('react-lite-youtube-embed', () => ({
  default: ({ id, title, wrapperClass }: { id: string; title: string; wrapperClass: string }) => (
    <div data-testid="youtube" className={wrapperClass} title={title}>
      {id}
    </div>
  ),
}));

vi.mock('react-tweet', () => ({
  Tweet: ({ id }: { id: string }) => <div data-testid="tweet">{id}</div>,
}));

vi.mock('@platejs/media', () => ({
  parseTwitterUrl: vi.fn(),
  parseVideoUrl: vi.fn(),
}));

vi.mock('@platejs/media/react', () => ({
  MediaEmbedPlugin: { key: 'media-embed' },
  useMediaState: () => state.media,
}));

vi.mock('@platejs/resizable', () => ({
  ResizableProvider: ({ children }: { children: ReactNode }) => children,
  useResizableValue: () => state.width,
}));

vi.mock('platejs/react', () => ({
  PlateElement: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  withHOC: (_provider: unknown, Component: unknown) => Component,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

vi.mock('../caption', () => ({
  Caption: ({ children, align, style }: { children: ReactNode; align: string; style: object }) => (
    <div data-testid="caption" data-align={align} style={style}>
      {children}
    </div>
  ),
  CaptionTextarea: ({ placeholder }: { placeholder: string }) => (
    <textarea placeholder={placeholder} />
  ),
}));

vi.mock('../media-toolbar', () => ({
  MediaToolbar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/features/shared/ui/rich-text', () => ({
  mediaResizeHandleVariants: ({ direction }: { direction: string }) => `handle-${direction}`,
  Resizable: ({
    children,
    align,
    options,
  }: {
    children: ReactNode;
    align: string;
    options: object;
  }) => (
    <div data-testid="resizable" data-align={align} data-options={JSON.stringify(options)}>
      {children}
    </div>
  ),
  ResizeHandle: ({ options }: { options: { direction: string } }) => (
    <span data-testid={`handle-${options.direction}`} />
  ),
}));

import { MediaEmbedElement } from '../media-embed-node';

const elementProps = {
  element: { type: 'media_embed', url: 'https://example.test' },
  editor: {},
  attributes: {},
} as unknown as ComponentProps<typeof MediaEmbedElement>;

function renderElement() {
  return render(<MediaEmbedElement {...elementProps}>child</MediaEmbedElement>);
}

describe('MediaEmbedElement', () => {
  beforeEach(() => {
    state.width = 640;
    state.media = {
      align: undefined,
      embed: undefined,
      focused: false,
      isTweet: false,
      isVideo: false,
      isYoutube: false,
      readOnly: false,
      selected: false,
    };
  });

  afterEach(cleanup);

  it('renders a selected YouTube video with default alignment and caption width', () => {
    state.media = {
      ...state.media,
      embed: { id: 'youtube-id', provider: 'youtube' },
      focused: true,
      isVideo: true,
      isYoutube: true,
      selected: true,
    };

    renderElement();

    expect(screen.getByTestId('youtube').textContent).toContain('youtube-id');
    expect(screen.getByTestId('youtube').className).toContain('ring-2');
    expect(screen.getByTestId('resizable').getAttribute('data-align')).toBe('center');
    expect(screen.getByTestId('resizable').getAttribute('data-options')).toBe(
      JSON.stringify({ align: 'center', maxWidth: '100%', minWidth: 100 })
    );
    expect(screen.getByTestId('caption').style.width).toBe('640px');
  });

  it.each([
    ['vimeo', 'pb-[75%]'],
    ['youku', 'pb-[56.25%]'],
    ['dailymotion', 'pb-[56.0417%]'],
    ['coub', 'pb-[51.25%]'],
    ['other', ''],
  ])('renders a %s iframe provider', (provider, expectedClass) => {
    state.media = {
      ...state.media,
      align: 'left',
      embed: { provider, url: `https://${provider}.example/embed` },
      focused: true,
      isVideo: true,
      isYoutube: false,
      selected: true,
    };

    const { container } = renderElement();

    const iframe = screen.getByTitle('embed');
    expect(iframe.getAttribute('src')).toBe(`https://${provider}.example/embed`);
    expect(iframe.className).toContain('border-0');
    expect(iframe.className).toContain('ring-2');
    expect(iframe.parentElement?.className).toContain(expectedClass);
    expect(container.textContent).toContain('child');
  });

  it('omits missing video URLs and renders tweet states without a video', () => {
    state.media = {
      ...state.media,
      align: 'right',
      embed: { id: 'tweet-id', provider: 'twitter' },
      isTweet: true,
      isVideo: true,
      isYoutube: false,
      readOnly: false,
      selected: true,
    };
    const { rerender } = renderElement();

    expect(screen.queryByTitle('embed')).toBeNull();
    expect(screen.getByTestId('tweet').textContent).toContain('tweet-id');
    expect(screen.getByTestId('tweet').parentElement?.className).toContain('ring-2');
    expect(screen.getByTestId('resizable').getAttribute('data-options')).toContain('550');

    state.media = { ...state.media, isVideo: false, readOnly: true, selected: true };
    rerender(<MediaEmbedElement {...elementProps}>child</MediaEmbedElement>);
    expect(screen.getByTestId('tweet').parentElement?.className).not.toContain('ring-2');

    state.media = { ...state.media, embed: { provider: 'twitter' }, selected: false };
    rerender(<MediaEmbedElement {...elementProps}>child</MediaEmbedElement>);
    expect(screen.queryByTestId('tweet')).toBeNull();
  });
});
