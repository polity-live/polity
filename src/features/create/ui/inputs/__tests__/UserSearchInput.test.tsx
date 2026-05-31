// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
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
});
