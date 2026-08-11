/* @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  arrays: {} as Record<string, string[]>,
  observerCallback: undefined as IntersectionObserverCallback | undefined,
  disconnect: vi.fn(),
  navigate: vi.fn(),
  currentNavigate: vi.fn(),
  agendaItems: [] as Record<string, any>[],
  searchDocuments: [] as Record<string, any>[],
  searchProps: undefined as Record<string, any> | undefined,
  messages: [] as Record<string, any>[],
  assistantChat: undefined as Record<string, any> | undefined,
  deferredLoads: [] as (() => Promise<unknown>)[],
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
    tArray: (key: string) => mocks.arrays[key] ?? ['one', 'two', 'three', 'four'],
  }),
}));
vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock('@/features/timeline/ui/cards/AgendaItemTimelineCard', () => ({
  AgendaItemTimelineCard: ({ agendaItem, className }: any) => {
    mocks.agendaItems.push({ agendaItem, className });
    return <div>{agendaItem.id}</div>;
  },
}));
vi.mock('@/features/shared/ui/typeahead', () => ({
  EntitySearchBar: (props: Record<string, any>) => {
    mocks.searchProps = props;
    return (
      <div>
        <input
          aria-label="search"
          value={props.searchQuery}
          onChange={e => props.onSearchQueryChange(e.target.value)}
        />
        <button onClick={() => props.onFilterToggle()}>filter</button>
      </div>
    );
  },
}));
vi.mock('@/features/search/ui/SearchResultCard', () => ({
  SearchResultCard: ({ document }: any) => {
    mocks.searchDocuments.push(document);
    return <div>{document.title}</div>;
  },
}));
vi.mock('@/features/messages/ui/MessageBubble', () => ({
  MessageBubble: (props: Record<string, any>) => {
    mocks.messages.push(props);
    return <div>{props.message.id}</div>;
  },
}));
vi.mock('@/features/messages/ui/ConversationHeader', () => ({
  ConversationHeader: (props: Record<string, any>) => (
    <div>
      <button onClick={props.onBack}>back</button>
      <button onClick={props.onTogglePin}>pin</button>
      <button onClick={props.onDeleteClick}>delete</button>
      <button onClick={props.onMembersClick}>members</button>
      <button onClick={() => props.onRenameConversation('name')}>rename</button>
    </div>
  ),
}));
vi.mock('@/features/messages/ui/AssistantMessageInput', () => ({
  AssistantMessageInput: ({ assistantChat }: any) => {
    mocks.assistantChat = assistantChat;
    return <div>assistant-input</div>;
  },
}));
vi.mock('@/features/shared/ui/ui/card', () => ({
  Card: ({ children }: { children: ReactNode }) => <article>{children}</article>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  CardHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  CardTitle: ({ children }: { children: ReactNode }) => <h3>{children}</h3>,
}));
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.currentNavigate,
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));
vi.mock('@/features/auth/onboarding/OnboardingWizard', () => ({
  OnboardingWizard: () => <div>onboarding</div>,
}));
vi.mock('@/features/shared/ui/feedback', () => ({
  AppBootLoadingState: () => <div>boot-loading</div>,
}));
vi.mock('../PublicLandingPage', async importOriginal => {
  const actual = await importOriginal<typeof import('../PublicLandingPage')>();
  return actual;
});
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/navigation/SmartLink', () => ({
  SmartLink: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));
vi.mock('@/features/shared/ui/navigation/SmartLink.tsx', () => ({
  SmartLink: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));
vi.mock('../ProductStoryPoint', () => ({
  ProductStoryPoint: ({ text, icon: Icon }: any) => (
    <div>
      {text}
      <Icon />
    </div>
  ),
}));
vi.mock('../DeferredLandingPreview', () => ({
  DeferredLandingPreview: ({ load, label }: any) => {
    mocks.deferredLoads.push(load);
    return <div>{label}</div>;
  },
}));
vi.mock('../LandingRevealSection', () => ({
  LandingRevealSection: ({ children }: { children: ReactNode }) => <section>{children}</section>,
}));
vi.mock('../MotionPrimitives', () => ({
  MotionGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  MotionItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/PublicSiteFooter', () => ({
  PublicSiteFooter: () => <footer>footer</footer>,
}));
vi.mock('@/features/shared/theme', () => ({ featureThemeClassName: (key: string) => key }));

import { HomePageContainerView } from '../HomePageContainerView';
import { LandingAgendaTimelinePreview } from '../LandingAgendaTimelinePreview';
import { LandingSearchPreview } from '../LandingSearchPreview';
import { LandingSocialAiPreview } from '../LandingSocialAiPreview';
import { LandingVoteElectionPreview } from '../LandingVoteElectionPreview';
import { ContactLink, PublicLandingPage, SectionHeading } from '../PublicLandingPage';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.arrays = {};
  mocks.agendaItems = [];
  mocks.searchDocuments = [];
  mocks.messages = [];
  mocks.deferredLoads = [];
  mocks.currentNavigate = mocks.navigate;
  delete (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('remaining landing previews A07', () => {
  it('covers loading/public/onboarding/redirect home states and redirect deduplication', () => {
    const retry = vi.fn();
    const signOut = vi.fn();
    const view = render(
      <HomePageContainerView viewState={{ kind: 'loading', onRetry: retry, onSignOut: signOut }} />
    );
    expect(screen.getByText('boot-loading')).toBeTruthy();
    view.rerender(<HomePageContainerView viewState={{ kind: 'public' }} />);
    expect(view.container.querySelector('.public-landing-page')).toBeTruthy();
    view.rerender(
      <HomePageContainerView
        viewState={{ kind: 'onboarding', userId: 'u', userEmail: 'e', onComplete: vi.fn() }}
      />
    );
    expect(screen.getByText('onboarding')).toBeTruthy();
    view.rerender(<HomePageContainerView viewState={{ kind: 'redirect' }} />);
    mocks.currentNavigate = vi.fn();
    view.rerender(<HomePageContainerView viewState={{ kind: 'redirect' }} />);
    expect(mocks.navigate).toHaveBeenCalledOnce();
  });

  it('renders all agenda rows and highlights only the first', () => {
    render(<LandingAgendaTimelinePreview />);
    expect(mocks.agendaItems).toHaveLength(3);
    expect(mocks.agendaItems[0].className).toContain('ring-2');
    expect(mocks.agendaItems[1].className).not.toContain('ring-2');
  });

  it('types/reset search, builds active/inactive filters and both document alternatives', () => {
    vi.useFakeTimers();
    mocks.arrays['pages.home.publicLanding.searchPreview.filters'] = [
      'One',
      'Two',
      'Three',
      'Four',
    ];
    mocks.arrays['pages.home.publicLanding.searchPreview.results'] = ['First', 'Second'];
    const view = render(<LandingSearchPreview />);
    expect(mocks.searchProps?.filterOptions.map((item: any) => item.active)).toEqual([
      true,
      true,
      true,
      false,
    ]);
    expect(mocks.searchDocuments.map(document => document.subtitle)).toEqual([
      'pages.home.publicLanding.searchPreview.parliamentaryGroup',
      'pages.home.publicLanding.searchPreview.budgetCommittee',
    ]);
    fireEvent.change(screen.getByLabelText('search'), { target: { value: 'x'.repeat(35) } });
    expect(
      (view.container.querySelector('.landing-search-typing-caret') as HTMLElement).style.transform
    ).toContain('28ch');
    fireEvent.click(screen.getByText('filter'));
    act(() => vi.advanceTimersByTime(10_000));
    expect(mocks.searchProps?.searchQuery).toBe('');
  });

  it('builds social messages and executes every preview assistant callback', async () => {
    render(<LandingSocialAiPreview />);
    expect(mocks.messages.map(item => item.isOwnMessage)).toContain(true);
    expect(mocks.messages.map(item => item.isOwnMessage)).toContain(false);
    for (const label of ['back', 'pin', 'delete', 'members', 'rename'])
      fireEvent.click(screen.getByText(label));
    const chat = mocks.assistantChat!;
    chat.setSelectedModelKey();
    chat.setReasoningEffort();
    chat.setToolSelection();
    chat.setToolGroupSelection();
    chat.toggleSelectedToolName();
    chat.setSkillSelection();
    chat.toggleSelectedSkillSlug();
    chat.addAttachment();
    chat.removeAttachment();
    chat.clearAttachments();
    expect(await chat.refreshCatalog()).toBeUndefined();
    expect(await chat.resolveAttachmentCardData()).toBeNull();
    expect(await chat.addUploadedFiles()).toBeUndefined();
    expect(chat.createSkill({ slug: 'slug', name: 'Name' })).toBe('slug');
    expect(chat.createSkill({ name: 'Name' })).toBe('Name');
    expect(await chat.sendAssistantMessage()).toBe(true);
  });

  it('parses winning/losing/invalid and fallback vote/election data', () => {
    mocks.arrays['pages.home.publicLanding.voteElectionPreview.voteChoices'] = [
      'Low|1|10',
      'Winner|2|40',
      'Bad||NaN',
    ];
    mocks.arrays['pages.home.publicLanding.voteElectionPreview.electionCandidates'] = [
      'Ada|Chair|3|60',
      'Bob|Member|1|20',
      'Bad|||NaN',
    ];
    mocks.arrays['pages.home.publicLanding.voteElectionPreview.metrics'] = ['metric'];
    mocks.arrays['pages.home.publicLanding.voteElectionPreview.checklist'] = ['check'];
    const view = render(<LandingVoteElectionPreview />);
    expect(view.container.querySelectorAll('[data-winner="true"]')).toHaveLength(2);
    mocks.arrays['pages.home.publicLanding.voteElectionPreview.voteChoices'] = ['', 'Missing'];
    mocks.arrays['pages.home.publicLanding.voteElectionPreview.electionCandidates'] = [
      '',
      'Missing',
    ];
    view.rerender(<LandingVoteElectionPreview />);
    expect(view.container.querySelector('[data-winner="true"]')).toBeNull();
  });

  it('renders public landing fallback/custom flows, story icon fallback and external/internal contacts', () => {
    mocks.arrays = {};
    const view = render(<PublicLandingPage />);
    expect(view.container.querySelector('.public-landing-page')).toBeTruthy();
    expect(mocks.deferredLoads).toHaveLength(9);
    view.unmount();
    mocks.arrays['pages.home.publicLanding.hero.decisionFlow'] = ['Only'];
    render(<PublicLandingPage />);
    render(<SectionHeading eyebrow="Eye" title="Title" description="Description" />);
    const contacts = render(
      <ContactLink data-action-id="a" href="/internal" title="Internal" value="v" description="d" />
    );
    expect(screen.getByText('Internal').closest('a')?.getAttribute('target')).toBeNull();
    contacts.rerender(
      <ContactLink
        data-action-id="a"
        href="https://x"
        title="External"
        value="v"
        description="d"
        external
      />
    );
    expect(screen.getByText('External').closest('a')?.getAttribute('target')).toBe('_blank');
  });
});
