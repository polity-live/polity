/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

import { HashtagDisplay } from '../hashtag-display';

describe('HashtagDisplay', () => {
  it('renders hashtags as anchors to search routes when clickable', () => {
    render(<HashtagDisplay hashtags={[{ id: 'tag-1', tag: 'democracy' }]} />);

    expect(screen.getByRole('link', { name: /democracy/i }).getAttribute('href')).toBe(
      '/search?hashtag=democracy'
    );
  });

  it('renders nothing without hashtags', () => {
    expect(render(<HashtagDisplay hashtags={[]} />).container.firstChild).toBeNull();
  });

  it('renders centered, titled, non-clickable badges with custom classes', () => {
    cleanup();
    const { container } = render(
      <HashtagDisplay
        hashtags={[{ id: 'tag-1', tag: 'civic design' }]}
        title="Topics"
        clickable={false}
        centered
        className="custom"
        badgeClassName="badge-custom"
      />
    );
    expect(screen.getByText('Topics')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
    expect(container.firstElementChild?.className).toContain('items-center');
    expect(container.querySelector('.badge-custom')).toBeTruthy();
  });
});
