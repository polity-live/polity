/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { POLITY_THEME } from '@/features/shared/appearance-theme';
import { AppearanceThemeSelector } from '../AppearanceThemeSelector';
import { BlogsCard } from '../BlogsCard';
import { CurrencyPreferenceControl } from '../CurrencyPreferenceControl';
import { SocialItem } from '../SocialItem';
import { UserInfoTabs } from '../UserInfoTabs';
import { UserWikiContentTabs } from '../UserWikiContentTabs';

const mocks = vi.hoisted(() => ({
  setCurrency: vi.fn(),
  updateCurrency: vi.fn(),
  setTheme: vi.fn(),
  updateTheme: vi.fn(),
}));

vi.mock('@/features/shared/ui/ui/tabs', () => ({
  Tabs: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children, ...props }: any) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));
vi.mock('@/features/shared/ui/navigation', () => ({
  ScrollableTabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/navigation/SmartLink.tsx', () => ({
  SmartLink: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('@/features/shared/ui/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/zero/appearance-themes/hooks', () => ({
  useAvailableAppearanceThemes: () => ({ themes: [POLITY_THEME], isLoading: false }),
}));
vi.mock('@/zero/preferences/usePreferenceState', () => ({
  usePreferenceState: () => ({
    appearanceThemeId: null,
    displayCurrency: 'EUR',
    isLoading: false,
  }),
}));
vi.mock('@/zero/preferences/usePreferenceActions', () => ({
  usePreferenceActions: () => ({
    updateAppearanceTheme: mocks.updateTheme,
    updateDisplayCurrency: mocks.updateCurrency,
  }),
}));
vi.mock('@/features/shared/global-state/theme.store', () => ({
  useThemeStore: (selector: any) => selector({ setAppearanceTheme: mocks.setTheme }),
}));
vi.mock('@/features/shared/global-state/currency.store', () => ({
  useDisplayCurrencyStore: (selector: any) => selector({ setDisplayCurrency: mocks.setCurrency }),
}));
vi.mock('@/features/shared/ui/form/CurrencySelect', () => ({
  CurrencySelect: ({ onChange, ...props }: any) => (
    <button type="button" onClick={() => onChange('USD')} {...props}>
      EUR
    </button>
  ),
}));
vi.mock('../UserAbout', () => ({ UserAbout: () => <div>About</div> }));
vi.mock('../UserContact', () => ({ UserContact: () => <div>Contact</div> }));
vi.mock('../BlogListTab', () => ({ BlogListTab: () => null }));
vi.mock('../GroupListTab', () => ({ GroupsListTab: () => null }));
vi.mock('../AmendmentListTab', () => ({ AmendmentListTab: () => null }));
vi.mock('../StatementListTab', () => ({ StatementListTab: () => null }));
vi.mock('@/features/statements/ui/StatementStoryCarousel', () => ({
  StatementStoryCarousel: () => null,
}));
vi.mock('@/features/shared/ui/typeahead', () => ({ EntitySearchBar: () => null }));
vi.mock('@/features/shared/virtualization', () => ({ PolityZeroGridView: () => null }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('user preference, link, and tab action contracts', () => {
  it('selects appearance and currency preferences through stable actions', () => {
    const { rerender } = render(<AppearanceThemeSelector />);
    fireEvent.click(document.querySelector('[data-action-id="users.appearance.theme.select"]')!);
    expect(mocks.setTheme).toHaveBeenCalledWith(POLITY_THEME);
    expect(mocks.updateTheme).toHaveBeenCalledWith(null);

    rerender(<CurrencyPreferenceControl />);
    fireEvent.click(
      document.querySelector('[data-action-id="users.preferences.currency.select"]')!
    );
    expect(mocks.setCurrency).toHaveBeenCalledWith('USD');
    expect(mocks.updateCurrency).toHaveBeenCalledWith('USD');
  });

  it('opens blog and social destinations through semantic links', () => {
    const { rerender } = render(
      <BlogsCard blog={{ id: 'blog-1', title: 'Blog', date: 'Today' }} href="/blog/blog-1" />
    );
    expect(document.querySelector('[data-action-id="users.blog-card.open"]')?.tagName).toBe('A');
    rerender(<SocialItem href="https://example.test" label="Website" icon={<span>W</span>} />);
    expect(document.querySelector('[data-action-id="users.social.external.open"]')?.tagName).toBe(
      'A'
    );
  });

  it('exposes every info and content tab as a stable focusable selection intent', () => {
    const { rerender } = render(
      <UserInfoTabs about={{}} contact={{ email: '', twitter: '', website: '' }} />
    );
    for (const id of ['about', 'contact']) {
      const tab = document.querySelector(`[data-action-id="users.info-tab.${id}"]`) as HTMLElement;
      tab.focus();
      expect(document.activeElement).toBe(tab);
    }

    rerender(
      <UserWikiContentTabs
        user={{ id: 'user-1' } as never}
        authorName="Ada"
        authorAvatar=""
        searchTerms={{ all: '', amendments: '', blogs: '', groups: '', statements: '' }}
        handleSearchChange={vi.fn()}
      />
    );
    for (const id of ['all', 'amendments', 'blogs', 'groups', 'statements']) {
      expect(document.querySelector(`[data-action-id="users.content-tab.${id}"]`)).toBeTruthy();
    }
  });
});
