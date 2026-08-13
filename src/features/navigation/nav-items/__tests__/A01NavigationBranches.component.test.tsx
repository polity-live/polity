/* @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import { forwardRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: forwardRef<HTMLAnchorElement, any>(({ children, params, to, ...props }, ref) => (
    <a ref={ref} href={to.replace('$id', params?.id ?? '')} {...props}>
      {children}
    </a>
  )),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => `fallback:${key}`,
}));

import { NavUserAvatar2View } from '../NavUserAvatar2View';
import {
  createLandingSecondaryNavItems,
  createNavItemsUnauthenticated,
} from '../nav-items-unauthenticated';
import { UserIdentityLink } from '@/features/shared/ui/UserIdentityLink';

const avatarProps = {
  avatarUrl: '',
  hoveredItem: null,
  onClick: vi.fn(),
  onHoverEnd: vi.fn(),
  onHoverStart: vi.fn(),
  popoverId: 'profile',
  userName: 'Alice',
};

describe('A01 navigation branches', () => {
  it('renders the mobile avatar-list presentation and unsupported fallback', () => {
    const { container, rerender } = render(
      <NavUserAvatar2View {...avatarProps} isMobile navigationView="asButtonList" />
    );
    expect(screen.getByRole('button').className).toContain('h-12 w-12');

    rerender(
      <NavUserAvatar2View {...avatarProps} isMobile={false} navigationView={'full' as never} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('uses custom and fallback translators for public navigation factories', () => {
    const navigate = vi.fn();
    const custom = (key: string) => `custom:${key}`;
    expect(createNavItemsUnauthenticated(navigate, custom)[0].label).toContain('custom:');
    expect(createNavItemsUnauthenticated(navigate)[0].label).toContain('fallback:');
    expect(createLandingSecondaryNavItems(navigate, custom)[0].label).toContain('custom:');
    expect(createLandingSecondaryNavItems(navigate)[0].label).toContain('fallback:');
  });

  it('renders anonymous and linked identities with avatar and handle fallbacks', () => {
    const { container, rerender } = render(<UserIdentityLink name="Anonymous" />);
    expect(container.querySelector('a')).toBeNull();
    expect(container.querySelector('svg')).toBeTruthy();

    rerender(
      <UserIdentityLink
        avatarUrl="/alice.png"
        fallbackLabel="Alice Example"
        handle="alice"
        name="Alice"
        showHandle
        userId="user-1"
      />
    );
    expect(screen.getByText('@alice')).toBeTruthy();
    expect(container.querySelector('a')).toBeTruthy();
  });
});
