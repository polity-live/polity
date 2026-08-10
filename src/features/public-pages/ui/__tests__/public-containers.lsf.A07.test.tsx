/* @vitest-environment jsdom */

import { act, cleanup, render, screen } from '@testing-library/react';
import { Circle } from 'lucide-react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  homeState: { status: 'ready' },
  homeViewProps: undefined as Record<string, unknown> | undefined,
  mapProps: undefined as Record<string, any> | undefined,
  railProps: undefined as Record<string, any> | undefined,
  legalViews: [] as Record<string, any>[],
  supportView: undefined as Record<string, any> | undefined,
}));

vi.mock('@/features/public-landing/hooks/useHomePageController', () => ({
  useHomePageController: () => mocks.homeState,
}));
vi.mock('@/features/public-landing/ui/HomePageContainerView', () => ({
  HomePageContainerView: (props: Record<string, unknown>) => {
    mocks.homeViewProps = props;
    return <div>home-view</div>;
  },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({
    t: (key: string) => key,
    tArray: (key: string) => [`${key}:value`, null, 3],
  }),
}));
vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock('@/features/timeline/ui/CivicTimelineMap', () => ({
  CivicTimelineMap: (props: Record<string, any>) => {
    mocks.mapProps = props;
    return <div>timeline-map</div>;
  },
}));
vi.mock('@/features/timeline/ui/CivicTimelineRail', () => ({
  CivicTimelineRail: (props: Record<string, any>) => {
    mocks.railProps = props;
    return <div>timeline-rail</div>;
  },
}));
vi.mock('@/features/public-pages/ui/LegalInfoPageView', () => ({
  LegalInfoPageView: (props: Record<string, any>) => {
    mocks.legalViews.push(props);
    return <div>legal-view</div>;
  },
}));
vi.mock('@/features/public-pages/ui/SupportPageView', () => ({
  SupportPageView: (props: Record<string, any>) => {
    mocks.supportView = props;
    return <div>support-view</div>;
  },
}));

import AuthenticatedHomePageContainer from '@/features/public-landing/ui/AuthenticatedHomePageContainer';
import { LandingActivityStripPreview } from '@/features/public-landing/ui/LandingActivityStripPreview';
import { ProductStoryPoint } from '@/features/public-landing/ui/ProductStoryPoint';
import { PrivacyPolicyPageContainer } from '../PrivacyPolicyPageContainer';
import { SupportPageContainer } from '../SupportPageContainer';
import { TermsPageContainer } from '../TermsPageContainer';

beforeEach(() => {
  mocks.homeViewProps = undefined;
  mocks.mapProps = undefined;
  mocks.railProps = undefined;
  mocks.legalViews = [];
  mocks.supportView = undefined;
});

afterEach(cleanup);

describe('A07 public container execution contracts', () => {
  it('forwards the authenticated home controller state', () => {
    render(<AuthenticatedHomePageContainer />);
    expect(screen.getByText('home-view')).toBeTruthy();
    expect(mocks.homeViewProps).toEqual({ viewState: mocks.homeState });
  });

  it('renders the product point icon and copy', () => {
    const view = render(<ProductStoryPoint icon={Circle} text="A durable civic workflow" />);
    expect(view.container.querySelector('svg')?.getAttribute('class')).toContain('h-5');
    expect(screen.getByText('A durable civic workflow')).toBeTruthy();
  });

  it('updates the activity selection through both map and rail item callbacks', () => {
    render(<LandingActivityStripPreview />);
    expect(mocks.mapProps?.activeItemId).toBe('landing-activity-hearing');

    act(() => mocks.mapProps?.onItemSelect({ id: 'map-item' }));
    expect(mocks.mapProps?.activeItemId).toBe('map-item');
    expect(mocks.railProps?.activeItemId).toBe('map-item');

    act(() => mocks.railProps?.onItemSelect({ id: 'rail-item' }));
    expect(mocks.mapProps?.activeItemId).toBe('rail-item');
    expect(mocks.railProps?.activeItemId).toBe('rail-item');
  });

  it('builds privacy, terms, and support view models from translated arrays', () => {
    render(
      <>
        <PrivacyPolicyPageContainer />
        <TermsPageContainer />
        <SupportPageContainer />
      </>
    );

    expect(mocks.legalViews).toHaveLength(2);
    expect(mocks.legalViews[0].sections).toHaveLength(5);
    expect(mocks.legalViews[1].sections).toHaveLength(7);
    expect(mocks.legalViews[0].sections[0].paragraphs).toEqual([
      'pages.privacy.sections.overview.paragraphs:value',
    ]);
    expect(mocks.legalViews[1].relatedLinks).toHaveLength(3);
    expect(mocks.supportView?.areas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'financial', href: '/pricing' }),
        expect.objectContaining({ key: 'design', external: true }),
        expect.objectContaining({ key: 'development', external: true }),
      ])
    );
  });
});
