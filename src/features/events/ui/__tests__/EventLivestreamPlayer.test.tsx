/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { EventLivestreamPlayer } from '../EventLivestreamPlayer';

afterEach(cleanup);

describe('EventLivestreamPlayer', () => {
  it('renders an embedded player for supported providers', () => {
    render(<EventLivestreamPlayer streamUrl="https://twitch.tv/polity_live" title="Live" />);

    const iframe = screen.getByTitle('Live');
    expect(iframe.getAttribute('src')).toContain('player.twitch.tv');
    expect(iframe.getAttribute('src')).toContain('parent=localhost');
  });

  it('uses the translated iframe title and forwards container classes', () => {
    const { container } = render(
      <EventLivestreamPlayer
        streamUrl="https://youtube.com/watch?v=dQw4w9WgXcQ"
        containerClassName="custom-player"
      />
    );
    expect(container.querySelector('.custom-player')).toBeTruthy();
    expect(document.querySelector('iframe')?.getAttribute('title')).toBe('Event Live Stream');
  });

  it('renders a secure external link for unsupported providers', () => {
    render(<EventLivestreamPlayer streamUrl="https://video.example/live" />);

    const link = document.querySelector('a');
    expect(link?.getAttribute('href')).toBe('https://video.example/live');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link?.getAttribute('data-action-id')).toBe('events.livestream.open-external');
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('renders nothing without a valid stream URL', () => {
    const { container } = render(<EventLivestreamPlayer streamUrl="javascript:alert(1)" />);
    expect(container.childElementCount).toBe(0);
  });
});
