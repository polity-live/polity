/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('@/features/shared/hooks/use-translation.ts', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { AccessDenied } from '../AccessDenied';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('AccessDenied actions', () => {
  it('routes history, home, email, and issue recovery through stable native actions', () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    const { container } = render(<AccessDenied />);
    const action = (id: string) =>
      container.querySelector<HTMLElement>(`[data-action-id="${id}"]`)!;

    const history = action('auth.access-denied.history.back');
    history.focus();
    expect(document.activeElement).toBe(history);
    fireEvent.click(history);
    expect(back).toHaveBeenCalledTimes(1);

    const home = action('auth.access-denied.home.open');
    expect(home.tagName).toBe('A');
    expect(home.getAttribute('href')).toBe('/');
    expect(home.querySelector('button')).toBeNull();
    expect(action('auth.access-denied.support-email.open').getAttribute('href')).toMatch(
      /^mailto:/
    );
    const issues = action('auth.access-denied.github-issues.open') as HTMLAnchorElement;
    expect(issues.href).toMatch(/^https:/);
    expect(issues.target).toBe('_blank');
    expect(issues.rel).toBe('noopener noreferrer');
  });
});
