/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const cityDesignPreviewMock = vi.hoisted(() =>
  vi.fn((props: unknown) => {
    void props;
    return <div data-testid="street-preview" />;
  })
);

vi.mock('@/features/change-requests/ui/CREditorPreview', () => ({
  CREditorPreview: () => <button type="button">Document Preview</button>,
}));

vi.mock('@/features/amendments/city-design/ui/CityDesignChangeRequestPreview', () => ({
  CityDesignChangeRequestPreview: (props: unknown) => cityDesignPreviewMock(props),
}));

vi.mock('@/features/editor/ui/SuggestionViewToggle', () => ({
  SuggestionViewToggle: () => null,
}));

import { createEmptyCityDesignState } from '@/features/amendments/city-design/state/cityDesignReducer';
import { ChangeRequestCardsListView } from '../ChangeRequestCardsListView';

const textChangeRequest = {
  id: 'timeline-1',
  change_request_id: 'cr-1',
  is_closing_vote: false,
  status: 'pending',
  change_request: {
    id: 'cr-1',
    title: 'Text change',
    source_type: 'document',
  },
};

function renderList(cityDesigns: readonly Record<string, unknown>[]) {
  return render(
    <ChangeRequestCardsListView
      activeTab="all"
      agendaItemId="agenda-1"
      allCRsProcessed={false}
      amendmentId="amendment-1"
      availablePreviewCrIds={['cr-1']}
      canManage={false}
      canVote={false}
      categorized={{ accepted: [], open: [textChangeRequest], rejected: [] }}
      closingVoteItem={null}
      completedCount={0}
      crIdToDiscussionId={new Map([['cr-1', 'suggestion-1']])}
      crItems={[textChangeRequest]}
      currentItemId={null}
      defaultPreviewCrId="cr-1"
      diffMap={{}}
      discussions={[]}
      documentContent={[{ type: 'p', children: [{ text: 'Document' }] }]}
      editingMode="event_final_closing_vote"
      effectivePreviewCrIds={new Set(['cr-1'])}
      filteredItems={[textChangeRequest]}
      getFilteredItems={() => [textChangeRequest]}
      getPreviewCrId={() => 'cr-1'}
      getUserSelectedChoiceIds={() => []}
      hasUserVoted={() => false}
      hideInlineVotingControls
      isTimelineComplete={false}
      isVotingActive
      items={[textChangeRequest]}
      normalizedPreviewCrIds={['cr-1']}
      onCastVote={undefined}
      onCloseVoting={undefined}
      onFinalizeInternalVote={undefined}
      onStartFinal={undefined}
      onStartIndicative={undefined}
      progress={0}
      progressPercent={0}
      previewSuggestionResolutions={new Map()}
      searchedItems={[textChangeRequest]}
      searchQuery=""
      selectedPreviewCrIds={['cr-1']}
      selectedPreviewSuggestionIds={new Set(['suggestion-1'])}
      setActiveTab={() => undefined}
      setSearchQuery={() => undefined}
      setSelectedPreviewCrIds={() => undefined}
      sharedPreviewEnabled
      showCityDesignPreviewAccordion
      cityDesigns={cityDesigns}
      t={(key: string, fallback?: string) =>
        key === 'features.agendas.crTimeline.cityDesignPreview'
          ? 'City Design Preview'
          : (fallback ?? key)
      }
      userId="user-1"
    />
  );
}

afterEach(() => {
  cleanup();
  cityDesignPreviewMock.mockClear();
});

describe('ChangeRequestCardsListView city design preview', () => {
  it('shows the accordion below the document preview when a map selection exists', () => {
    const design = {
      ...createEmptyCityDesignState(),
      mapSelection: {
        center: { lat: 52.52, lon: 13.405 },
        widthMeters: 120,
        heightMeters: 80,
        rotationDeg: 0,
      },
    };

    renderList([{ id: 'city-design-1', design_state: design }]);

    const [documentPreview] = screen.getAllByRole('button', { name: 'Document Preview' });
    const cityDesignTrigger = screen.getByTestId('city-design-preview-accordion-trigger');
    expect(cityDesignTrigger.getAttribute('data-action-id')).toBe(
      'agendas.change-request-list.city-preview.toggle'
    );
    expect(
      documentPreview.compareDocumentPosition(cityDesignTrigger) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    fireEvent.click(cityDesignTrigger);

    expect(screen.getByTestId('street-preview')).toBeTruthy();
    expect(cityDesignPreviewMock).toHaveBeenCalledWith(
      expect.objectContaining({
        changeRequest: expect.objectContaining({
          source_type: 'city_design_scene',
          source_id: 'city-design-1',
        }),
        cityDesigns: [expect.objectContaining({ id: 'city-design-1' })],
      })
    );
  });

  it('hides the accordion when no map selection exists', () => {
    renderList([
      {
        id: 'city-design-1',
        design_state: createEmptyCityDesignState(),
      },
    ]);

    expect(screen.queryByTestId('city-design-preview-accordion-trigger')).toBeNull();
    expect(cityDesignPreviewMock).not.toHaveBeenCalled();
  });
});
