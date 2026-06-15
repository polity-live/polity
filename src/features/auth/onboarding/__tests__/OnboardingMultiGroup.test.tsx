/* @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { useMemo, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Group } from '../../hooks/useOnboarding.ts';

const i18n = vi.hoisted(() => {
  const translations: Record<string, string> = {
    'common.goBack': 'Back',
    'onboarding.groupStep.title': 'Find your group',
    'onboarding.groupStep.description': 'Search for groups',
    'onboarding.groupStep.searchPlaceholder': 'Search groups or locations...',
    'onboarding.groupStep.selectionTitle': 'Selected groups',
    'onboarding.groupStep.selectedCount': '{{count}} selected',
    'onboarding.groupStep.clearSelection': 'Clear all',
    'onboarding.groupStep.emptySelectionDescription': 'No groups selected',
    'onboarding.groupStep.matchesTitle': 'Recommended matches',
    'onboarding.groupStep.matchesDescription': 'Select one or more groups',
    'onboarding.groupStep.noResults': 'No groups found',
    'onboarding.groupStep.noResultsHint': 'Try another search',
    'onboarding.groupStep.mapTitle': 'Group map',
    'onboarding.groupStep.mapDescription': 'Click a marker',
    'onboarding.groupStep.mappableCount': '{{count}} mapped',
    'onboarding.groupStep.unmappedCount': '{{count}} without location',
    'onboarding.groupStep.activeTitle': 'Focused group',
    'onboarding.groupStep.activeDescription': 'Select this group from the list',
    'onboarding.groupStep.activeSelectedDescription': 'Selected for requests',
    'onboarding.groupStep.emptyActiveDescription': 'Choose a group',
    'onboarding.groupStep.interestMatch': 'Matches your interests',
    'onboarding.groupStep.skip': 'Skip this step',
    'onboarding.groupStep.continue': 'Continue',
    'onboarding.groupStep.continueWithoutGroup': 'Continue without group',
    'onboarding.confirmStep.title': 'Join this group?',
    'onboarding.confirmStep.titleMultiple': 'Send group requests?',
    'onboarding.confirmStep.description': 'Send one request',
    'onboarding.confirmStep.descriptionMultiple': 'Send membership requests to {{count}} groups',
    'onboarding.confirmStep.nextTitle': 'What happens next',
    'onboarding.confirmStep.nextPrivacy': 'Privacy note',
    'onboarding.confirmStep.nextReview': 'Review note',
    'onboarding.confirmStep.yes': 'Yes, send request',
    'onboarding.confirmStep.yesMultiple': 'Send {{count}} requests',
    'onboarding.confirmStep.no': 'No, just continue',
    'onboarding.confirmStep.requestSending': 'Sending request...',
    'onboarding.confirmStep.requestSent': 'Request sent!',
    'onboarding.confirmStep.requestSentMultiple': '{{count}} requests sent',
    'onboarding.summaryStep.title': "You're all set!",
    'onboarding.summaryStep.description': "Here's what we've done",
    'onboarding.summaryStep.nameUpdated': 'Name set to',
    'onboarding.summaryStep.groupSelected': 'Group selected',
    'onboarding.summaryStep.groupsSelected': 'Groups selected',
    'onboarding.summaryStep.groupCountOne': '1 group selected',
    'onboarding.summaryStep.groupCount': '{{count}} groups selected',
    'onboarding.summaryStep.membershipRequested': 'Membership request sent to',
    'onboarding.summaryStep.membershipRequestsSent': 'Membership requests sent',
    'onboarding.summaryStep.requestCountOne': '1 request sent',
    'onboarding.summaryStep.requestCount': '{{count}} requests sent',
    'onboarding.summaryStep.noGroup': 'No group selected',
    'onboarding.summaryStep.interestsSelected': 'Interests selected',
    'onboarding.summaryStep.recommendationTitle': 'Recommended next step',
    'onboarding.summaryStep.recommendations.profile': 'Open profile',
    'onboarding.summaryStep.recommendations.group': 'Open group',
    'onboarding.summaryStep.recommendations.timeline': 'Open timeline',
    'onboarding.summaryStep.recommendations.assistant': 'Open assistant',
    'onboarding.summaryStep.nextStepLabel': 'Next step',
    'onboarding.summaryStep.goToProfile': 'Go to my profile',
    'onboarding.summaryStep.goToGroup': 'Go to group',
    'onboarding.summaryStep.goToTimeline': 'Open timeline',
    'onboarding.summaryStep.showAssistant': 'Open assistant',
    'features.auth.errors.fillBothFields': 'Fill both fields',
    'features.auth.errors.nameTooShort': 'Name too short',
    'features.auth.errors.membershipRequestFailed': 'Request failed',
    'features.auth.errors.membershipRequestsPartialFailed': 'Some requests failed',
    'features.auth.errors.interestsSaveFailed': 'Interests could not be saved',
    'features.auth.errors.profileUpdateFailed': 'Profile update failed',
    'features.auth.success.membershipRequestsSent': '{{count}} membership requests sent',
  };

  const t = (key: string, args?: Record<string, unknown>) => {
    let value = translations[key] ?? key;
    for (const [argKey, argValue] of Object.entries(args ?? {})) {
      value = value.replaceAll(`{{${argKey}}}`, String(argValue));
    }
    return value;
  };

  return { t };
});

const hookMocks = vi.hoisted(() => ({
  joinGroup: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  updateProfileConfirmed: vi.fn(),
  syncEntityHashtags: vi.fn(),
}));

vi.mock('@/features/shared/hooks/use-translation.ts', () => ({
  translate: i18n.t,
  useTranslation: () => ({ t: i18n.t }),
}));

vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: {
    error: hookMocks.toastError,
    success: hookMocks.toastSuccess,
  },
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('@/zero/groups/useGroupActions', () => ({
  useGroupActions: () => ({ joinGroup: hookMocks.joinGroup }),
}));

vi.mock('@/zero/users/useUserActions', () => ({
  useUserActions: () => ({ updateProfileConfirmed: hookMocks.updateProfileConfirmed }),
}));

vi.mock('@/zero/common', () => ({
  useCommonActions: () => ({ syncEntityHashtags: hookMocks.syncEntityHashtags }),
  useCommonState: () => ({
    allHashtags: [
      { id: 'tag-climate', tag: 'climate' },
      { id: 'tag-housing', tag: 'housing' },
    ],
    userHashtags: [],
  }),
}));

vi.mock('../OnboardingGroupMap.tsx', () => ({
  OnboardingGroupMap: ({
    activeGroupId,
    groups,
    onActiveGroupChange,
  }: {
    activeGroupId?: string | null;
    groups: Group[];
    onActiveGroupChange?: (groupId: string | null) => void;
  }) => (
    <div data-testid="onboarding-group-map">
      <span data-testid="active-map-id">{activeGroupId ?? 'none'}</span>
      {groups.map(group => (
        <button key={group.id} type="button" onClick={() => onActiveGroupChange?.(group.id)}>
          marker {group.name}
        </button>
      ))}
    </div>
  ),
}));

import { useOnboarding } from '../../hooks/useOnboarding.ts';
import { GroupSearchStepView } from '../GroupSearchStepView.tsx';
import { SummaryStep } from '../SummaryStep.tsx';

const groups: Group[] = [
  {
    id: 'group-alpha',
    name: 'Alpha Civic Group',
    description: 'Mapped group',
    member_count: 12,
    visibility: 'public',
    location: 'Berlin',
    latitude: 52.52,
    longitude: 13.405,
    hashtags: ['climate', 'mobility'],
    matchingInterestTags: ['climate'],
  },
  {
    id: 'group-beta',
    name: 'Beta Offline Group',
    description: 'No coordinates',
    member_count: 8,
    visibility: 'public',
    location: 'Hamburg',
    latitude: null,
    longitude: null,
    hashtags: ['housing'],
    matchingInterestTags: ['housing'],
  },
  {
    id: 'group-gamma',
    name: 'Gamma Mapped Group',
    description: 'Mapped group',
    member_count: 3,
    visibility: 'public',
    location: 'Munich',
    latitude: 48.137,
    longitude: 11.575,
    hashtags: ['health'],
  },
];

function isMappable(group: Group) {
  return typeof group.latitude === 'number' && typeof group.longitude === 'number';
}

function GroupSearchHarness() {
  const [selectedGroups, setSelectedGroups] = useState<Group[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const selectedGroupIds = useMemo(
    () => new Set(selectedGroups.map(group => group.id)),
    [selectedGroups]
  );
  const mappableGroups = useMemo(() => groups.filter(isMappable), []);
  const activeGroup = groups.find(group => group.id === activeGroupId) ?? selectedGroups[0] ?? null;

  const handleSelectGroup = (group: Group) => {
    setActiveGroupId(group.id);
    setSelectedGroups(current =>
      current.some(selectedGroup => selectedGroup.id === group.id)
        ? current.filter(selectedGroup => selectedGroup.id !== group.id)
        : [...current, group]
    );
  };

  return (
    <GroupSearchStepView
      selectedGroups={selectedGroups}
      selectedGroupIds={selectedGroupIds}
      activeGroupId={activeGroupId}
      activeGroup={activeGroup}
      hasSelectedGroups={selectedGroups.length > 0}
      mappableGroups={mappableGroups}
      unmappableGroupCount={groups.length - mappableGroups.length}
      onClearSelectedGroups={() => setSelectedGroups([])}
      onNext={() => undefined}
      onBack={() => undefined}
      t={i18n.t}
      searchTerm=""
      setSearchTerm={() => undefined}
      groupsLoading={false}
      filteredGroups={groups}
      handleSelectGroup={handleSelectGroup}
      handleActivateGroup={setActiveGroupId}
      handleSkip={() => undefined}
    />
  );
}

function getGroupCardButton(groupName: string) {
  const button = screen.getByText(groupName).closest('button');
  expect(button).not.toBeNull();
  return button as HTMLButtonElement;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  hookMocks.joinGroup.mockResolvedValue(undefined);
  hookMocks.syncEntityHashtags.mockResolvedValue(undefined);
});

describe('onboarding multi-group flow', () => {
  it('toggles multiple groups and keeps groups without coordinates selectable', () => {
    render(<GroupSearchHarness />);

    expect(screen.getByText('Beta Offline Group')).toBeTruthy();
    expect(screen.getAllByText('Matches your interests').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'marker Beta Offline Group' })).toBeNull();

    fireEvent.click(getGroupCardButton('Alpha Civic Group'));
    expect(screen.getByText('1 selected')).toBeTruthy();

    fireEvent.click(getGroupCardButton('Beta Offline Group'));
    expect(screen.getByText('2 selected')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Clear all Alpha Civic Group'));
    expect(screen.getByText('1 selected')).toBeTruthy();
  });

  it('activates a group from the map without selecting it from the list', () => {
    render(<GroupSearchHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'marker Gamma Mapped Group' }));

    expect(screen.getByTestId('active-map-id').textContent).toBe('group-gamma');
    expect(screen.getAllByText('Gamma Mapped Group').length).toBeGreaterThan(1);
    expect(screen.queryByText('1 selected')).toBeNull();
  });

  it('sends one membership request for each selected group', async () => {
    const { result } = renderHook(() => useOnboarding());

    act(() => {
      result.current.toggleSelectedGroup(groups[0]);
      result.current.toggleSelectedGroup(groups[1]);
    });

    await act(async () => {
      const success = await result.current.sendMembershipRequests();
      expect(success).toBe(true);
    });

    expect(hookMocks.joinGroup).toHaveBeenCalledTimes(2);
    expect(hookMocks.joinGroup).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        group_id: 'group-alpha',
        status: 'requested',
      })
    );
    expect(hookMocks.joinGroup).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        group_id: 'group-beta',
        status: 'requested',
      })
    );
    expect(result.current.data.membershipRequestSentGroupIds).toEqual([
      'group-alpha',
      'group-beta',
    ]);
  });

  it('stores selected interest tags as user hashtags', async () => {
    const { result } = renderHook(() => useOnboarding());

    act(() => {
      result.current.toggleInterestTag('climate');
      result.current.toggleInterestTag('#housing');
    });

    expect(result.current.data.selectedInterestTags).toEqual(['climate', 'housing']);

    await act(async () => {
      const success = await result.current.saveInterests();
      expect(success).toBe(true);
    });

    expect(hookMocks.syncEntityHashtags).toHaveBeenCalledWith(
      'user',
      'user-1',
      ['climate', 'housing'],
      [],
      expect.arrayContaining([
        expect.objectContaining({ tag: 'climate' }),
        expect.objectContaining({ tag: 'housing' }),
      ])
    );
  });

  it('shows selected and requested counts in the summary', () => {
    render(
      <SummaryStep
        firstName="Ada"
        lastName="Lovelace"
        selectedGroups={[groups[0], groups[1]]}
        selectedInterestTags={['climate', 'housing']}
        activeGroupId="group-beta"
        membershipRequestSentGroupIds={['group-alpha', 'group-beta']}
        onGoToProfile={() => undefined}
        onGoToGroup={() => undefined}
        onGoToTimeline={() => undefined}
        onGoToAssistant={() => undefined}
      />
    );

    expect(screen.getByText('Ada Lovelace')).toBeTruthy();
    expect(screen.getByText('2 groups selected')).toBeTruthy();
    expect(screen.getByText('2 requests sent')).toBeTruthy();
    expect(screen.getByText('Interests selected')).toBeTruthy();
    expect(screen.getByText('#climate')).toBeTruthy();
    expect(screen.getByText('Beta Offline Group')).toBeTruthy();
  });
});
