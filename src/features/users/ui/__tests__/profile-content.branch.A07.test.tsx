/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ captured: {} as Record<string, any> }));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
  }),
}));
vi.mock('@/features/shared/ui/ui/tabs', () => ({
  Tabs: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock('@/features/shared/ui/navigation', () => ({
  ScrollableTabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/typeahead', () => ({
  EntitySearchBar: (props: any) => {
    mocks.captured.search = props;
    return (
      <input
        aria-label="all-search"
        value={props.searchQuery}
        onChange={e => props.onSearchQueryChange(e.target.value)}
      />
    );
  },
}));
vi.mock('@/features/shared/ui/form', () => ({
  SettingsPage: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SettingsTabs: ({ children, value, onValueChange }: any) => (
    <div data-tab={value}>
      <button onClick={() => onValueChange?.('ai')}>change-tab</button>
      {children}
    </div>
  ),
  SettingsPanel: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  SettingsActionBar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  FormActions: (props: any) => {
    mocks.captured.actions = props;
    return (
      <div>
        {props.submitLabel}
        <button onClick={props.onCancel}>form-actions</button>
      </div>
    );
  },
}));

function capture(name: string, label: string) {
  return (props: any) => {
    mocks.captured[name] = props;
    return <button onClick={() => props.onSearchChange?.('new')}>{label}</button>;
  };
}

vi.mock('@/features/file-upload/ui/MediaUpload', () => ({
  MediaUpload: capture('media', 'media'),
}));
vi.mock('../BasicInformationSection', () => ({
  BasicInformationSection: capture('basic', 'basic'),
}));
vi.mock('../AboutSection', () => ({ AboutSection: capture('about', 'about') }));
vi.mock('../ContactInformationSection', () => ({
  ContactInformationSection: capture('contact', 'contact'),
}));
vi.mock('../LocationInformationSection', () => ({
  LocationInformationSection: capture('location', 'location'),
}));
vi.mock('../HashtagsSection', () => ({ HashtagsSection: capture('hashtags', 'hashtags') }));
vi.mock('@/features/create/ui/inputs/VisibilityInput', () => ({
  VisibilityInput: capture('visibility', 'visibility'),
}));
vi.mock('@/features/payments/ui/SubscriptionPlansGrid', () => ({
  SubscriptionPlansGrid: capture('plans', 'plans'),
}));
vi.mock('@/features/payments/ui/SubscriptionStatus', () => ({
  SubscriptionStatus: () => <div>subscription-status</div>,
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock('@/features/shared/logic/geoLocationShape', () => ({
  geoLocationShapeFromFields: () => ({ kind: 'point' }),
  geoLocationFieldsFromShape: (shape: unknown) =>
    shape
      ? {
          location_kind: 'area',
          location_place_id: 'p',
          location_boundary_source: 'osm',
          location_geometry: {},
          location_bounds: {},
        }
      : {
          location_kind: null,
          location_place_id: null,
          location_boundary_source: null,
          location_geometry: null,
          location_bounds: null,
        },
}));
vi.mock('@/features/create/ui/FormStyleSelector', () => ({
  FormStyleSelector: () => <div>FormStyleSelector</div>,
}));
vi.mock('@/features/navigation/toggles/theme-toggle', () => ({
  ThemeToggle: () => <div>ThemeToggle</div>,
}));
vi.mock('@/features/navigation/toggles/language-toggle', () => ({
  LanguageToggle: () => <div>LanguageToggle</div>,
}));
vi.mock('../CurrencyPreferenceControl', () => ({
  CurrencyPreferenceControl: () => <div>CurrencyPreferenceControl</div>,
}));
vi.mock('../AppearanceThemeSelector', () => ({
  AppearanceThemeSelector: () => <div>AppearanceThemeSelector</div>,
}));
vi.mock('@/features/navigation/toggles/NavigationViewStateToggle', () => ({
  NavigationViewStateToggle: () => <div>NavigationViewStateToggle</div>,
}));
vi.mock('@/features/pwa/ui', () => ({ PwaInstallPanel: () => <div>PwaInstallPanel</div> }));
vi.mock('../VotingPasswordTab', () => ({ VotingPasswordTab: () => <div>VotingPasswordTab</div> }));
vi.mock('../AccountPasswordSection', () => ({
  AccountPasswordSection: () => <div>AccountPasswordSection</div>,
}));
vi.mock('../AccountEmailSection', () => ({
  AccountEmailSection: () => <div>AccountEmailSection</div>,
}));
vi.mock('@/features/notifications/ui/NotificationSettingsContent', () => ({
  NotificationSettingsContent: () => <div>NotificationSettingsContent</div>,
}));
vi.mock('../AiSettingsTab', () => ({ AiSettingsTab: () => <div>AiSettingsTab</div> }));
vi.mock('@/features/app-tutorial/AppTutorialSettingsPanel', () => ({
  AppTutorialSettingsPanel: () => <div>AppTutorialSettingsPanel</div>,
}));
vi.mock('../AmendmentListTab', () => ({
  AmendmentListTab: capture('amendments', 'amendments-tab'),
}));
vi.mock('../BlogListTab', () => ({ BlogListTab: capture('blogs', 'blogs-tab') }));
vi.mock('../GroupListTab', () => ({ GroupsListTab: capture('groups', 'groups-tab') }));
vi.mock('../StatementListTab', () => ({
  StatementListTab: capture('statements', 'statements-tab'),
}));
vi.mock('@/features/statements/ui/StatementStoryCarousel', () => ({
  StatementStoryCarousel: () => <div>stories</div>,
}));
vi.mock('@/features/search/ui/SearchResultCard', () => ({
  SearchResultCard: ({ document }: any) => <div>{document.id}</div>,
}));
vi.mock('@/features/shared/ui/ui/skeleton', () => ({ Skeleton: () => <div>skeleton</div> }));
vi.mock('@/zero/queries', () => ({
  queries: {
    search: {
      searchDocumentPage: (args: unknown) => ({ kind: 'page', args }),
      searchDocumentById: (args: unknown) => ({ kind: 'one', args }),
    },
  },
}));
vi.mock('@/features/shared/virtualization', () => ({
  PolityZeroGridView: (props: Record<string, any>) => {
    mocks.captured.grid = {
      pageSettled: props.getPageQuery({ limit: 10, start: null, dir: 'forward', settled: true }),
      pageLive: props.getPageQuery({ limit: 10, start: null, dir: 'forward', settled: false }),
      oneSettled: props.getSingleQuery({ id: 'd1', settled: true }),
      oneLive: props.getSingleQuery({ id: 'd1', settled: false }),
      lanes: [props.getLanes(500), props.getLanes(800), props.getLanes(1300)],
      key: props.getRowKey({ id: 'd1', created_at: 1 }),
      start: props.toStartRow({ id: 'd1', created_at: 1 }),
    };
    return (
      <div>
        {props.renderRow({ id: 'd1', created_at: 1 }, 2)}
        {props.renderRow({ id: 'd2', created_at: 2 }, 20)}
        {props.renderSkeleton()}
        {props.renderEmpty()}
      </div>
    );
  },
}));

import { UserProfileEditForm } from '../UserProfileEditForm';
import { UserWikiContentTabs } from '../UserWikiContentTabs';

const formData = {
  avatar: '',
  videoURL: '',
  firstName: 'A',
  lastName: 'B',
  gender: '',
  subtitle: '',
  visibility: 'public',
  aboutContent: [],
  email: '',
  website: '',
  youtube: '',
  linkedin: '',
  whatsapp: '',
  instagram: '',
  twitter: '',
  facebook: '',
  snapchat: '',
  tiktok: '',
  country: '',
  region: '',
  post_code: '',
  city: '',
  street: '',
  house_number: '',
  latitude: null,
  longitude: null,
  location_kind: null,
  location_place_id: null,
  location_boundary_source: null,
  location_geometry: null,
  location_bounds: null,
  hashtags: [],
} as any;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.captured = {};
});
afterEach(cleanup);

describe('profile and content branches A07', () => {
  function profile(overrides: Record<string, unknown> = {}) {
    const props = {
      formData,
      isSubmitting: false,
      userId: 'u1',
      activeSubscriptionAmount: 0,
      pendingChange: null,
      hasStripeCustomer: false,
      subscriptionRefreshKey: 1,
      isCheckoutLoading: false,
      isPlanActive: vi.fn(),
      hasCustomPlan: false,
      onSubmit: vi.fn(e => e.preventDefault()),
      onCancel: vi.fn(),
      onAvatarUpload: vi.fn(),
      onAboutContentChange: vi.fn(),
      onFieldChange: vi.fn(),
      onSubscribe: vi.fn(),
      onCustomAmount: vi.fn(),
      onCancelSubscription: vi.fn(),
      onManageBilling: vi.fn(),
      ...overrides,
    } as any;
    return { props, view: render(<UserProfileEditForm {...props} />) };
  }

  it('resolves profile tabs and forwards all basic/location/media callbacks', () => {
    const { props, view } = profile({ activeTab: 'missing' });
    expect(document.querySelector('[data-tab]')?.getAttribute('data-tab')).toBe('basic-info');
    fireEvent.click(screen.getByText('change-tab'));
    mocks.captured.media.onImageChange('image');
    mocks.captured.media.onVideoChange('video');
    mocks.captured.basic.onFirstNameChange('Ada');
    mocks.captured.basic.onLastNameChange('Lovelace');
    mocks.captured.basic.onGenderChange('female');
    mocks.captured.basic.onSubtitleChange('Countess');
    mocks.captured.visibility.onChange('private');
    for (const [handler, value] of [
      ['onEmailChange', 'a@b'],
      ['onWebsiteChange', 'web'],
      ['onYoutubeChange', 'yt'],
      ['onLinkedinChange', 'li'],
      ['onWhatsappChange', 'wa'],
      ['onInstagramChange', 'ig'],
      ['onTwitterChange', 'tw'],
      ['onFacebookChange', 'fb'],
      ['onSnapchatChange', 'sc'],
      ['onTiktokChange', 'tt'],
    ])
      mocks.captured.contact[handler](value);
    for (const [handler, value] of [
      ['onCountryChange', 'DE'],
      ['onRegionChange', 'BE'],
      ['onPostCodeChange', '1'],
      ['onCityChange', 'Berlin'],
      ['onStreetChange', 'Main'],
      ['onHouseNumberChange', '2'],
    ])
      mocks.captured.location[handler](value);
    mocks.captured.hashtags.onHashtagsChange(['x']);
    mocks.captured.location.onCoordinatesChange({ latitude: 1, longitude: 2 });
    mocks.captured.location.onCoordinatesChange(null);
    mocks.captured.location.onShapeChange({ kind: 'area' });
    mocks.captured.location.onShapeChange(null);
    expect(props.onFieldChange).toHaveBeenCalledWith('latitude', 1);
    expect(props.onFieldChange).toHaveBeenCalledWith('latitude', null);
    expect(props.onFieldChange).toHaveBeenCalledWith('location_kind', 'area');

    view.rerender(<UserProfileEditForm {...props} activeTab="preferences" />);
    expect(document.querySelector('[data-tab]')?.getAttribute('data-tab')).toBe('preferences');
    view.rerender(<UserProfileEditForm {...props} activeTab={undefined} />);
    expect(document.querySelector('[data-tab]')?.getAttribute('data-tab')).toBe('basic-info');
  });

  it('covers submitting and billing customer/loading alternatives', () => {
    const { props, view } = profile({
      isSubmitting: true,
      hasStripeCustomer: true,
      isCheckoutLoading: true,
    });
    expect(document.body.textContent).toContain('saving');
    expect(screen.getByText('features.payments.billing.manage')).toBeTruthy();
    fireEvent.click(screen.getByText('features.payments.billing.manage'));
    view.rerender(
      <UserProfileEditForm {...props} isSubmitting={false} isCheckoutLoading={false} />
    );
    expect(document.body.textContent).toContain('saveProfile');
    fireEvent.click(screen.getByText('features.payments.billing.manage'));
    expect(props.onManageBilling).toHaveBeenCalled();
    view.rerender(<UserProfileEditForm {...props} hasStripeCustomer={false} />);
    expect(screen.queryByText('features.payments.billing.manage')).toBeNull();
  });

  it('builds all wiki tab queries, grid alternatives and search callbacks', () => {
    const handleSearchChange = vi.fn();
    const user = { id: 'u1', bio: null } as any;
    const searchTerms = { all: '', amendments: '', blogs: '', groups: '', statements: '' };
    const view = render(
      <UserWikiContentTabs
        user={user}
        authorName=""
        authorAvatar=""
        searchTerms={searchTerms}
        handleSearchChange={handleSearchChange}
      />
    );
    expect(mocks.captured.statements.authorName).toBe('common.labels.unspecifiedUser');
    expect(mocks.captured.statements.authorTitle).toBeUndefined();
    expect(mocks.captured.statements.authorAvatar).toBeUndefined();
    expect(mocks.captured.grid.lanes).toEqual([1, 2, 3]);
    expect(mocks.captured.grid.pageSettled.options.ttl).toBe('5m');
    expect(mocks.captured.grid.pageLive.options.ttl).toBe('none');
    expect(mocks.captured.grid.oneSettled.options.ttl).toBe('5m');
    fireEvent.change(screen.getByLabelText('all-search'), { target: { value: 'query' } });
    for (const label of ['amendments-tab', 'blogs-tab', 'groups-tab', 'statements-tab'])
      fireEvent.click(screen.getByText(label));
    expect(handleSearchChange).toHaveBeenCalledWith('all', 'query');

    view.rerender(
      <UserWikiContentTabs
        user={{ ...user, bio: 'Bio' }}
        authorName="Ada"
        authorAvatar="avatar"
        searchTerms={searchTerms}
        handleSearchChange={handleSearchChange}
      />
    );
    expect(mocks.captured.statements.authorName).toBe('Ada');
    expect(mocks.captured.statements.authorTitle).toBe('Bio');
    expect(mocks.captured.statements.authorAvatar).toBe('avatar');
  });
});
