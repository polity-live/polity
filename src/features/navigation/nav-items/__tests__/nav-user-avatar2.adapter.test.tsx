/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NavUserAvatar } from '../nav-user-avatar2';

const mocks = vi.hoisted(() => ({ controller: null as Record<string, unknown> | null }));
vi.mock('../../hooks/useNavUserAvatar2Controller', () => ({
  useNavUserAvatar2Controller: () => mocks.controller,
}));
vi.mock('../NavUserAvatar2View', () => ({
  NavUserAvatar2View: (props: { isMobile: boolean }) => <div>avatar:{String(props.isMobile)}</div>,
}));

afterEach(cleanup);

describe('NavUserAvatar adapter', () => {
  it('renders nothing without a controller model', () => {
    const { container } = render(
      <NavUserAvatar navigationView={'full' as never} isMobile={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('forwards a controller model to the view', () => {
    mocks.controller = { user: { id: 'user-1' } };
    render(<NavUserAvatar navigationView={'full' as never} isMobile />);
    expect(screen.getByText('avatar:true')).toBeTruthy();
  });
});
