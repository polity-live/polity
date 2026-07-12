/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const streetDesignPreviewMock = vi.hoisted(() =>
  vi.fn((props: unknown) => {
    void props;
    return <div data-testid="street-preview" />;
  })
);

vi.mock('@/features/change-requests/ui/CREditorPreview', () => ({
  CREditorPreview: () => <button type="button">Document Preview</button>,
}));

vi.mock('@/features/amendments/streetscape/ui/StreetDesignChangeRequestPreview', () => ({
  StreetDesignChangeRequestPreview: (props: unknown) => streetDesignPreviewMock(props),
}));

vi.mock('@/features/editor/ui/SuggestionViewToggle', () => ({
  SuggestionViewToggle: () => null,
}));

import { createEmptyStreetDesignState } from '@/features/amendments/streetscape/state/streetDesignReducer';
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

function renderList(streetDesigns: readonly Record<string, unknown>[]) {
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
      showStreetDesignPreviewAccordion
      streetDesigns={streetDesigns}
      t={(key: string, fallback?: string) =>
        key === 'features.agendas.crTimeline.streetDesignPreview'
          ? 'Street Design Preview'
          : (fallback ?? key)
      }
      userId="user-1"
    />
  );
}

afterEach(() => {
  cleanup();
  streetDesignPreviewMock.mockClear();
});

describe('ChangeRequestCardsListView street design preview', () => {
  it('shows the accordion below the document preview when a map selection exists', () => {
    const design = {
      ...createEmptyStreetDesignState(),
      mapSelection: {
        center: { lat: 52.52, lon: 13.405 },
        widthMeters: 120,
        heightMeters: 80,
        rotationDeg: 0,
      },
    };

    renderList([{ id: 'street-design-1', design_state: design }]);

    const [documentPreview] = screen.getAllByRole('button', { name: 'Document Preview' });
    const streetDesignTrigger = screen.getByTestId('street-design-preview-accordion-trigger');
    expect(
      documentPreview.compareDocumentPosition(streetDesignTrigger) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    fireEvent.click(streetDesignTrigger);

    expect(screen.getByTestId('street-preview')).toBeTruthy();
    expect(streetDesignPreviewMock).toHaveBeenCalledWith(
      expect.objectContaining({
        changeRequest: expect.objectContaining({
          source_type: 'street_design_scene',
          source_id: 'street-design-1',
        }),
        streetDesigns: [expect.objectContaining({ id: 'street-design-1' })],
      })
    );
  });

  it('hides the accordion when no map selection exists', () => {
    renderList([
      {
        id: 'street-design-1',
        design_state: createEmptyStreetDesignState(),
      },
    ]);

    expect(screen.queryByTestId('street-design-preview-accordion-trigger')).toBeNull();
    expect(streetDesignPreviewMock).not.toHaveBeenCalled();
  });
});
