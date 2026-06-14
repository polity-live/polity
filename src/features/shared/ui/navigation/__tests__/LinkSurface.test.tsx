/* @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

import { LinkSurface } from '../LinkSurface';

describe('LinkSurface', () => {
  it('renders a real anchor in simple mode', () => {
    render(
      <LinkSurface href="/docs" mode="simple">
        <span>Docs</span>
      </LinkSurface>
    );

    expect(screen.getByRole('link', { name: 'Docs' }).getAttribute('href')).toBe('/docs');
  });

  it('keeps interactive children clickable in overlay mode', () => {
    const anchorClick = vi.fn();
    const buttonClick = vi.fn();

    render(
      <LinkSurface href="/event/1" mode="overlay" label="Open event" onClick={anchorClick}>
        <div>
          <button type="button" onClick={buttonClick}>
            Action
          </button>
        </div>
      </LinkSurface>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Action' }));

    expect(buttonClick).toHaveBeenCalledTimes(1);
    expect(anchorClick).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Open event' }).getAttribute('href')).toBe('/event/1');
  });
});
