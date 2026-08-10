/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loads: [] as (() => Promise<{ default: unknown }>)[],
  preview: vi.fn(),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({
    t: (key: string) => key,
    tArray: () => ['one', 'two', 'three', 'four'],
  }),
}));
vi.mock('@/features/shared/theme', () => ({ featureThemeClassName: (key: string) => key }));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/ui/card', () => ({
  Card: ({ children }: { children: ReactNode }) => <article>{children}</article>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  CardHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  CardTitle: ({ children }: { children: ReactNode }) => <h3>{children}</h3>,
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));
vi.mock('@/features/shared/ui/navigation/SmartLink', () => ({
  SmartLink: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));
vi.mock('@/features/shared/motion', () => ({
  MotionGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  MotionItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/PublicSiteFooter', () => ({ PublicSiteFooter: () => <footer /> }));
vi.mock('../ProductStoryPoint', () => ({
  ProductStoryPoint: ({ text }: { text: string }) => <div>{text}</div>,
}));
vi.mock('../LandingRevealSection', () => ({
  LandingRevealSection: ({ children }: { children: ReactNode }) => <section>{children}</section>,
}));
vi.mock('../DeferredLandingPreview', () => ({
  DeferredLandingPreview: ({ load }: { load: () => Promise<{ default: unknown }> }) => {
    mocks.loads.push(load);
    return <div />;
  },
}));

vi.mock('../LandingNetworkFlowPreview', () => ({ LandingNetworkFlowPreview: mocks.preview }));
vi.mock('../LandingAmendmentSectionContent', () => ({
  LandingAmendmentSectionContentContainer: mocks.preview,
}));
vi.mock('../LandingAgendaTimelinePreview', () => ({ LandingAgendaTimelinePreview: mocks.preview }));
vi.mock('../LandingVoteElectionPreview', () => ({ LandingVoteElectionPreview: mocks.preview }));
vi.mock('../LandingCityDesignPreview', () => ({ LandingCityDesignPreview: mocks.preview }));
vi.mock('../LandingSocialAiPreview', () => ({ LandingSocialAiPreview: mocks.preview }));
vi.mock('../LandingActivityStripPreview', () => ({ LandingActivityStripPreview: mocks.preview }));
vi.mock('../LandingSearchPreview', () => ({ LandingSearchPreview: mocks.preview }));
vi.mock('../LandingOfficialDataPreview', () => ({ LandingOfficialDataPreview: mocks.preview }));

import { PublicLandingPage } from '../PublicLandingPage';

beforeEach(() => {
  mocks.loads = [];
});
afterEach(cleanup);

it('resolves every deferred landing preview loader', async () => {
  render(<PublicLandingPage />);
  expect(mocks.loads).toHaveLength(9);
  const modules = await Promise.all(mocks.loads.map(load => load()));
  expect(modules.map(module => module.default)).toEqual(Array(9).fill(mocks.preview));
});
