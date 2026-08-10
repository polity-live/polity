/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/pwa/ui', () => ({ PwaInstallPanel: () => <div>PWA</div> }));
vi.mock('@/features/shared/ui/hashtags', () => ({ HashtagEditor: () => <div>Editor</div> }));
vi.mock('@/features/shared/hooks/use-translation.ts', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({
    t: (key: string) => (key === 'onboarding.interestStep.suggestions' ? 'climate,mobility' : key),
  }),
}));
vi.mock('../OnboardingGroupMap.tsx', () => ({ OnboardingGroupMap: () => <div>Map</div> }));

import { AppInstallStep } from '../AppInstallStep';
import { GroupSearchStepView } from '../GroupSearchStepView';
import { InterestStep } from '../InterestStep';

afterEach(cleanup);

const action = (container: HTMLElement, id: string) => {
  const element = container.querySelector<HTMLElement>(`[data-action-id="${id}"]`);
  expect(element, id).not.toBeNull();
  return element!;
};

const group = {
  id: 'group-1',
  name: 'Civic Group',
  member_count: 12,
  visibility: 'public',
  latitude: 52.5,
  longitude: 13.4,
};

describe('onboarding intention actions', () => {
  it('dispatches app-install navigation through stable disabled-aware actions', () => {
    const onBack = vi.fn();
    const onNext = vi.fn();
    const { container } = render(
      <AppInstallStep onNext={onNext} onBack={onBack} isLoading={false} />
    );

    const back = action(container, 'auth.onboarding.app-install.back');
    back.focus();
    expect(document.activeElement).toBe(back);
    fireEvent.click(back);
    fireEvent.click(action(container, 'auth.onboarding.app-install.continue'));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('dispatches every group-search selection and navigation intention', () => {
    const handlers = {
      onClearSelectedGroups: vi.fn(),
      onNext: vi.fn(),
      onBack: vi.fn(),
      handleSelectGroup: vi.fn(),
      handleActivateGroup: vi.fn(),
      handleSkip: vi.fn(),
    };
    const base = {
      selectedGroups: [group],
      selectedGroupIds: new Set(['group-1']),
      activeGroupId: 'group-1',
      activeGroup: group,
      hasSelectedGroups: true,
      mappableGroups: [group],
      unmappableGroupCount: 0,
      isLoading: false,
      t: (key: string) => key,
      searchTerm: '',
      setSearchTerm: vi.fn(),
      groupsLoading: false,
      filteredGroups: [group],
      ...handlers,
    };
    const { container, rerender } = render(<GroupSearchStepView {...base} />);

    for (const id of [
      'auth.onboarding.group-search.back',
      'auth.onboarding.group-search.continue',
      'auth.onboarding.group-search.selection.clear',
      'auth.onboarding.group-search.map.activate',
      'auth.onboarding.group-search.card.toggle',
      'auth.onboarding.group-search.map-card.toggle',
    ]) {
      fireEvent.click(action(container, id));
    }
    expect(handlers.onBack).toHaveBeenCalledTimes(1);
    expect(handlers.onNext).toHaveBeenCalledTimes(1);
    expect(handlers.onClearSelectedGroups).toHaveBeenCalledTimes(1);
    expect(handlers.handleActivateGroup).toHaveBeenCalledWith('group-1');
    expect(handlers.handleSelectGroup).toHaveBeenCalledTimes(2);

    rerender(
      <GroupSearchStepView
        {...base}
        selectedGroups={[]}
        selectedGroupIds={new Set()}
        activeGroupId={null}
        activeGroup={null}
        hasSelectedGroups={false}
      />
    );
    fireEvent.click(action(container, 'auth.onboarding.group-search.skip'));
    fireEvent.click(action(container, 'auth.onboarding.group-search.continue'));
    expect(handlers.handleSkip).toHaveBeenCalledTimes(2);
  });

  it('dispatches interest navigation, clearing, and tag toggling through stable actions', () => {
    const onBack = vi.fn();
    const onNext = vi.fn();
    const onClearInterestTags = vi.fn();
    const onToggleInterestTag = vi.fn();
    const { container } = render(
      <InterestStep
        selectedInterestTags={['climate']}
        suggestions={['climate']}
        onSelectedInterestTagsChange={vi.fn()}
        onToggleInterestTag={onToggleInterestTag}
        onClearInterestTags={onClearInterestTags}
        onNext={onNext}
        onBack={onBack}
      />
    );

    fireEvent.click(action(container, 'auth.onboarding.interests.back'));
    fireEvent.click(action(container, 'auth.onboarding.interests.continue'));
    fireEvent.click(action(container, 'auth.onboarding.interests.clear'));
    fireEvent.click(action(container, 'auth.onboarding.interests.tag.toggle'));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onClearInterestTags).toHaveBeenCalledTimes(1);
    expect(onToggleInterestTag).toHaveBeenCalledWith('climate');
  });
});
