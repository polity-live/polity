/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { UserTableCell } from '../UserTableCell';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, params, ...props }: any) => (
    <a href={`/user/${params.id}`} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/features/shared/ui/ui/avatar', () => ({
  Avatar: ({ children }: any) => <span data-testid="avatar">{children}</span>,
  AvatarImage: ({ src, alt }: any) => <span data-testid="image" data-src={src} data-alt={alt} />,
  AvatarFallback: ({ children }: any) => <span data-testid="initials">{children}</span>,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => `translated:${key}` }),
}));

afterEach(() => cleanup());

describe('UserTableCell', () => {
  it('prefers a trimmed display name and links identified users', () => {
    render(
      <UserTableCell
        displayName="  Ada  "
        user={{ id: 'user-1', handle: 'ada', avatar: '/ada.png' } as any}
      />
    );
    expect(screen.getByRole('link').getAttribute('href')).toBe('/user/user-1');
    expect(screen.getByText('Ada')).toBeTruthy();
    expect(screen.getByText('@ada')).toBeTruthy();
    expect(screen.getByTestId('initials').textContent).toBe('A');
    expect(screen.getByTestId('image').getAttribute('data-src')).toBe('/ada.png');
  });

  it('builds a full name while filtering missing name parts', () => {
    render(
      <UserTableCell
        displayName="  "
        user={{ id: 'user-2', first_name: 'Grace', last_name: null, email: 'ignored@test' } as any}
      />
    );
    expect(screen.getByText('Grace')).toBeTruthy();
    expect(screen.queryByText(/@/)).toBeNull();
    expect(screen.getByTestId('image').getAttribute('data-src')).toBeNull();
  });

  it('falls back through handle and email for unlinked users', () => {
    const handle = render(
      <UserTableCell user={{ handle: 'anonymous', avatar: '/anon.png' } as any} />
    );
    expect(screen.getByText('anonymous')).toBeTruthy();
    expect(screen.getByText('@anonymous')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
    handle.unmount();

    render(<UserTableCell user={{ email: 'person@example.test' } as any} />);
    expect(screen.getByText('person@example.test')).toBeTruthy();
    expect(screen.queryByText(/@person/)).toBeNull();
  });

  it('uses caller and translated fallbacks, including safe generic initials', () => {
    const explicit = render(<UserTableCell fallbackLabel="   " />);
    expect(screen.getByTestId('initials').textContent).toBe('U');
    explicit.unmount();

    render(<UserTableCell />);
    expect(screen.getByText('translated:common.unknownUser')).toBeTruthy();
    expect(screen.getByTestId('initials').textContent).toBe('T');
  });
});
