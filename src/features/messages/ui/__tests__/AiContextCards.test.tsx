/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiContextCards } from '../AiContextCards';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

afterEach(cleanup);

describe('AiContextCards', () => {
  it('renders mixed entity results compactly and expands after four cards', () => {
    const attachments = [
      { entityType: 'group' as const, entityId: '1', title: 'Group result', href: '/group/1' },
      { entityType: 'event' as const, entityId: '2', title: 'Event result' },
      { entityType: 'user' as const, entityId: '3', title: 'User result' },
      { entityType: 'amendment' as const, entityId: '4', title: 'Amendment result' },
      { entityType: 'blog' as const, entityId: '5', title: 'Blog result' },
    ];

    render(<AiContextCards attachments={attachments} contextLabel="output" />);

    expect(screen.getByText('Amendment result')).toBeTruthy();
    expect(screen.queryByText('Blog result')).toBeNull();
    expect(screen.getByRole('link', { name: /Group result/ }).getAttribute('href')).toBe(
      '/group/1'
    );
    expect(screen.queryByRole('link', { name: /Event result/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /1|more|weitere/i }));
    expect(screen.getByText('Blog result')).toBeTruthy();
  });
});
