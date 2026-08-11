/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { UserSelectCard } from '../UserSelectCard';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => `translated:${key}`,
}));

vi.mock('@/features/shared/ui/ui/avatar.tsx', () => ({
  Avatar: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  AvatarImage: (props: any) => <img {...props} />,
  AvatarFallback: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}));

afterEach(() => cleanup());

describe('UserSelectCard', () => {
  it('renders all optional profile details', () => {
    const { container } = render(
      <UserSelectCard
        user={{
          id: 'user-1',
          name: 'Ada',
          avatar: '/ada.png',
          handle: 'ada',
          bio: 'Builds democratic systems.',
          contactEmail: 'ignored@example.com',
        }}
      />
    );

    expect(screen.getByText('Ada')).toBeTruthy();
    expect(screen.getByText('@ada')).toBeTruthy();
    expect(screen.getByText('Builds democratic systems.')).toBeTruthy();
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('Ada');
    expect(screen.getByText('A')).toBeTruthy();
  });

  it('falls back to email, translated name, and a question-mark avatar', () => {
    render(<UserSelectCard user={{ id: 'user-2', contactEmail: 'anon@example.com' }} />);

    expect(screen.getByText('translated:generated.inline.0140_unnamed_user_7e1c1a5e')).toBeTruthy();
    expect(screen.getByText('anon@example.com')).toBeTruthy();
    expect(screen.getByText('?')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('uses empty image alt text and fallback when a named avatar is absent', () => {
    const { container } = render(
      <UserSelectCard user={{ id: 'user-3', name: '', avatar: '/anonymous.png' }} />
    );

    expect(container.querySelector('img')?.getAttribute('alt')).toBe('');
    expect(screen.getByText('?')).toBeTruthy();
  });
});
