/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Avatar, AvatarFallback } from '../avatar';

afterEach(cleanup);

describe('Avatar shape', () => {
  it('uses rounded corners for the avatar and its fallback', () => {
    render(
      <Avatar data-testid="avatar">
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>
    );

    const avatar = screen.getByTestId('avatar');
    const fallback = screen.getByText('AB');

    expect(avatar.className).toContain('rounded-md');
    expect(avatar.className).not.toContain('rounded-full');
    expect(fallback.className).toContain('rounded-md');
    expect(fallback.className).not.toContain('rounded-full');
  });
});
