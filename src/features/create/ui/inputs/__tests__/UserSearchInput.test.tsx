// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UserSearchInput } from '@/features/create/ui/inputs/UserSearchInput';

vi.mock('@/zero/users/useUserState', () => ({
  useUserState: () => ({
    allUsers: [
      {
        id: 'user-1',
        first_name: 'Alice',
        last_name: 'Example',
        handle: 'alice',
        email: 'alice@example.com',
        avatar: null,
      },
      {
        id: 'user-2',
        first_name: 'Bob',
        last_name: 'Example',
        handle: 'bob',
        email: 'bob@example.com',
        avatar: null,
      },
    ],
  }),
}));

afterEach(() => {
  cleanup();
});

describe('UserSearchInput', () => {
  it('uses the built-in multi-select flow and keeps selected cards below the field', () => {
    function Harness() {
      const [value, setValue] = useState<string[]>([]);
      return (
        <UserSearchInput
          value={value}
          onChange={setValue}
          label="People"
          placeholder="Search users"
        />
      );
    }

    render(<Harness />);

    const input = screen.getByPlaceholderText('Search users');
    fireEvent.focus(input);
    fireEvent.mouseDown(screen.getByText('Alice Example'));

    expect(screen.getByText('Alice Example')).toBeTruthy();
    expect(screen.getByText('@alice')).toBeTruthy();

    fireEvent.focus(input);
    fireEvent.mouseDown(screen.getByText('Bob Example'));

    expect(screen.getByText('Bob Example')).toBeTruthy();
    expect(screen.getByText('@bob')).toBeTruthy();
  });

  it('filters available users by allowedUserIds after existing excludes', () => {
    render(
      <UserSearchInput
        value={[]}
        onChange={() => undefined}
        label="People"
        placeholder="Search users"
        allowedUserIds={['user-1', 'user-2']}
        excludeUserIds={['user-1']}
      />
    );

    fireEvent.focus(screen.getByPlaceholderText('Search users'));

    expect(screen.queryByText('Alice Example')).toBeNull();
    expect(screen.getByText('Bob Example')).toBeTruthy();
  });

  it('disables the search box when assignment is not available yet', () => {
    render(
      <UserSearchInput
        value={[]}
        onChange={() => undefined}
        label="People"
        placeholder="Search users"
        disabled
      />
    );

    const input = screen.getByPlaceholderText('Search users');
    expect((input as HTMLInputElement).disabled).toBe(true);

    fireEvent.focus(input);
    expect(screen.queryByText('Alice Example')).toBeNull();
  });
});
