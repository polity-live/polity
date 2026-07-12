// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EntityWikiMedia } from '../EntityWikiMedia';

describe('EntityWikiMedia', () => {
  it('renders an image when an image URL is present', () => {
    render(<EntityWikiMedia imageUrl="https://example.test/cover.jpg" alt="Cover" />);

    expect(screen.getByRole('img', { name: 'Cover' }).getAttribute('src')).toBe(
      'https://example.test/cover.jpg'
    );
  });

  it('renders a controlled video player when a video URL is present', () => {
    render(<EntityWikiMedia videoUrl="https://example.test/cover.mp4" alt="Cover video" />);

    const video = screen.getByLabelText('Cover video');
    expect(video.tagName).toBe('VIDEO');
    expect(video.hasAttribute('controls')).toBe(true);
    expect(video.getAttribute('preload')).toBe('metadata');
    expect(video.hasAttribute('autoplay')).toBe(false);
    expect(video.className).toContain('bg-background');
    expect(video.className).not.toContain('bg-black');
  });

  it('renders no media without a URL', () => {
    const { container } = render(<EntityWikiMedia alt="Missing media" />);

    expect(container.innerHTML).toBe('');
  });
});
