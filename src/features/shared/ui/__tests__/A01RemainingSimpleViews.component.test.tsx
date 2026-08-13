/* @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import { forwardRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ hashtagInput: vi.fn() }));

vi.mock('@/features/shared/ui/hashtags/HashtagInput', () => ({
  HashtagInput: (props: any) => {
    mocks.hashtagInput(props);
    return <div data-testid="hashtag-input" />;
  },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));
vi.mock('@tanstack/react-router', () => ({
  Link: forwardRef<HTMLAnchorElement, any>(({ children, resetScroll, to, ...props }, ref) => (
    <a ref={ref} href={to} data-reset-scroll={String(resetScroll)} {...props}>
      {children}
    </a>
  )),
}));
vi.mock('@/features/navigation/UserMenu.tsx', () => ({
  UserMenu: ({ isMobile }: { isMobile: boolean }) => <div>menu:{String(isMobile)}</div>,
}));

import { NavUserAvatarView } from '@/features/navigation/nav-items/NavUserAvatarView';
import { HashtagEditor } from '@/features/shared/ui/hashtags/HashtagEditor';
import { SettingsPanel } from '@/features/shared/ui/form/SettingsPanel';
import { SmartLink, toRouterHref } from '@/features/shared/ui/navigation/SmartLink';
import { TypeaheadSelectedCard } from '@/features/shared/ui/typeahead/TypeaheadSelectedCard';

describe('A01 remaining simple views', () => {
  it('uses hashtag editor defaults and removes duplicate suggestions', () => {
    const { rerender } = render(<HashtagEditor onChange={vi.fn()} value={[]} />);
    expect(mocks.hashtagInput).toHaveBeenLastCalledWith(
      expect.objectContaining({ suggestions: [] })
    );
    rerender(
      <HashtagEditor
        onChange={vi.fn()}
        preferredSuggestions={['Civic', 'News']}
        suggestions={['civic', 'Local']}
        value={[]}
      />
    );
    expect(mocks.hashtagInput).toHaveBeenLastCalledWith(
      expect.objectContaining({ suggestions: ['Civic', 'News', 'Local'] })
    );
  });

  it('renders non-primary selected cards and handles enabled and disabled clicks', () => {
    const onClick = vi.fn();
    const item = { entityType: 'role', id: 'role-1', label: 'Role' } as any;
    const { rerender } = render(
      <TypeaheadSelectedCard item={item} onClick={onClick} onRemove={vi.fn()} variant="compact" />
    );
    fireEvent.click(screen.getByRole('button', { name: /^Role / }));
    expect(onClick).toHaveBeenCalled();
    onClick.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /^Role / }), { ctrlKey: true });
    expect(onClick).not.toHaveBeenCalled();

    onClick.mockClear();
    rerender(
      <TypeaheadSelectedCard
        disabled
        item={item}
        onClick={onClick}
        onRemove={vi.fn()}
        variant="compact"
      />
    );
    fireEvent.click(document.querySelector('[data-slot="typeahead-selected"]')!);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders danger settings with description and action', () => {
    render(
      <SettingsPanel
        action={<button>Action</button>}
        description="Description"
        title="Settings"
        variant="danger"
      >
        Body
      </SettingsPanel>
    );
    expect(screen.getByText('Description')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Action' })).toBeTruthy();
  });

  it('handles non-http, relative, and missing smart-link hrefs', () => {
    expect(toRouterHref('mailto:user@example.test')).toBeNull();
    expect(toRouterHref('/inside')).toBe('/inside');
    expect(toRouterHref('relative')).toBeNull();
    render(<SmartLink href={null as never}>Missing</SmartLink>);
    expect(screen.getByText('Missing').getAttribute('href')).toBe('');
  });

  it('rejects absolute HTTP links when no browser window exists', () => {
    const originalWindow = globalThis.window;
    vi.stubGlobal('window', undefined);
    expect(toRouterHref('https://example.test/path')).toBeNull();
    vi.stubGlobal('window', originalWindow);
  });

  it('renders both user-menu avatar branches', () => {
    const props = {
      displayName: 'Alice',
      isDropdownOpen: false,
      onAsButtonClick: vi.fn(),
      onDropdownOpenChange: vi.fn(),
      onNameClick: vi.fn(),
      user: {} as any,
      userInitials: 'AL',
    };
    const { rerender } = render(
      <NavUserAvatarView {...props} isMobile={false} navigationView="asButtonList" />
    );
    expect(screen.getByText('menu:false')).toBeTruthy();
    rerender(<NavUserAvatarView {...props} isMobile navigationView="asLabeledButtonList" />);
    expect(screen.getByText('menu:true')).toBeTruthy();
  });
});
