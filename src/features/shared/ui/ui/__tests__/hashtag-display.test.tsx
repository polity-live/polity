/* @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
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
});
