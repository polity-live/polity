/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCorridorCityDesignObject } from '../../logic/cityDesignPlacement';
import type { CityDesignChangeRequest } from '../../logic/cityDesignChangeRequests';
import {
  CityDesignChangeRequestCanvasList,
  CityDesignChangeRequestPanel,
} from '../CityDesignChangeRequestPanel';
import { CityDesignChangeRequestDetailsView } from '../CityDesignChangeRequestDetailsView';

afterEach(() => {
  cleanup();
});

function changeRequest(overrides: Partial<CityDesignChangeRequest> = {}): CityDesignChangeRequest {
  return {
    id: 'cr-panel-1',
    source_type: 'city_design_object',
    title: 'Add retail building',
    change_type: 'insert',
    status: 'open',
    voting_status: 'open',
    votes_for: 1,
    votes_against: 0,
    votes_abstain: 0,
    ...overrides,
  };
}

describe('CityDesignChangeRequestPanel', () => {
  it('selects change requests from the canvas list', () => {
    const onChangeRequestSelect = vi.fn();
    render(
      <CityDesignChangeRequestCanvasList
        changeRequests={[changeRequest()]}
        selectedChangeRequestId={null}
        onChangeRequestSelect={onChangeRequestSelect}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /add retail building/i }));

    expect(onChangeRequestSelect).toHaveBeenCalledWith('cr-panel-1');
  });

  it('uses full-text-like vote actions', () => {
    const onVote = vi.fn();
    render(
      <CityDesignChangeRequestPanel
        changeRequest={changeRequest()}
        currentUserId="user-1"
        canVote
        onVote={onVote}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /accept/i }));
    fireEvent.click(screen.getByRole('button', { name: /reject/i }));
    fireEvent.click(screen.getByRole('button', { name: /abstain/i }));

    expect(onVote).toHaveBeenCalledWith('cr-panel-1', 'accept');
    expect(onVote).toHaveBeenCalledWith('cr-panel-1', 'reject');
    expect(onVote).toHaveBeenCalledWith('cr-panel-1', 'abstain');
  });

  it('submits comments for the selected change request', () => {
    const onCommentSubmit = vi.fn();
    render(
      <CityDesignChangeRequestPanel
        changeRequest={changeRequest()}
        currentUserId="user-1"
        currentUserDisplayName="Tobias"
        onCommentSubmit={onCommentSubmit}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /reply/i }));
    const list = document.querySelector('[data-slot="discussion-comment-list"]');
    const composer = screen.getByPlaceholderText(/reply/i);

    expect(
      composer.compareDocumentPosition(list as Node) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    fireEvent.change(composer, {
      target: { value: 'Looks good to me' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    expect(onCommentSubmit).toHaveBeenCalledWith('cr-panel-1', 'Looks good to me');
  });

  it('collapses a cityDesign comment to its author and time summary', () => {
    render(
      <CityDesignChangeRequestPanel
        changeRequest={changeRequest()}
        discussions={[
          {
            id: 'discussion-1',
            changeRequestEntityId: 'cr-panel-1',
            comments: [
              {
                id: 'comment-1',
                userId: 'user-1',
                createdAt: Date.now(),
                contentRich: 'A visible cityDesign comment',
              },
            ],
          },
        ]}
        currentUserId="user-1"
        currentUserDisplayName="Tobias"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Collapse' }));

    expect(screen.queryByText('A visible cityDesign comment')).toBeNull();
    expect(screen.getByText('Tobias')).toBeTruthy();
    expect(document.querySelectorAll('time').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Expand' })).toBeTruthy();
  });

  it('shows before and after changed properties in an accordion', () => {
    const before = createCorridorCityDesignObject({
      id: 'building-1',
      type: 'building',
      start: { x: 0, z: 0 },
      end: { x: 18, z: 0 },
      width: 10,
      overrides: {
        properties: { height: 9, floors: 3, use: 'Retail' },
      },
    });
    const after = {
      ...before,
      properties: { ...before.properties, height: 12 },
    };

    render(
      <CityDesignChangeRequestPanel
        changeRequest={changeRequest({
          change_type: 'update',
          original_properties: { object: before },
          new_properties: { object: after },
        })}
      />
    );

    expect(screen.getByText(/changed properties/i)).toBeTruthy();
    expect(screen.getAllByText(/height/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Before').length).toBeGreaterThan(0);
    expect(screen.getAllByText('After').length).toBeGreaterThan(0);
    expect(screen.getAllByText('9').length).toBeGreaterThan(0);
    expect(screen.getAllByText('12').length).toBeGreaterThan(0);
  });

  it('dispatches panel management actions through stable intents', () => {
    const onClose = vi.fn();
    const onFinalize = vi.fn();
    const onTitleChange = vi.fn();
    render(
      <CityDesignChangeRequestPanel
        changeRequest={changeRequest()}
        currentUserId="user-1"
        canFinalize
        onClose={onClose}
        onFinalize={onFinalize}
        onTitleChange={onTitleChange}
      />
    );

    const editTitle = document.querySelector<HTMLElement>(
      '[data-action-id="amendments.city-cr.edit.title"]'
    );
    const closeDetails = document.querySelector<HTMLElement>(
      '[data-action-id="amendments.city-cr.close.details"]'
    );
    const toggleDiff = document.querySelector<HTMLElement>(
      '[data-action-id="amendments.city-cr.toggle.diff"]'
    );
    expect(editTitle).toBeTruthy();
    expect(closeDetails).toBeTruthy();
    expect(toggleDiff).toBeTruthy();

    fireEvent.click(editTitle as HTMLElement);
    const titleInput = screen.getByDisplayValue('Add retail building');
    fireEvent.change(titleInput, { target: { value: 'Safer retail building' } });
    fireEvent.blur(titleInput);
    fireEvent.click(toggleDiff as HTMLElement);
    fireEvent.click(closeDetails as HTMLElement);
    fireEvent.click(
      document.querySelector<HTMLElement>(
        '[data-action-id="amendments.city-cr.open.finalize-dialog"]'
      ) as HTMLElement
    );
    fireEvent.click(
      document.querySelector<HTMLElement>(
        '[data-action-id="amendments.city-cr.confirm.finalize"]'
      ) as HTMLElement
    );

    expect(onTitleChange).toHaveBeenCalledWith('cr-panel-1', 'Safer retail building');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onFinalize).toHaveBeenCalledWith('cr-panel-1');
  });

  it('closes canvas-list and details selections through stable actions', () => {
    const onChangeRequestSelect = vi.fn();
    const onClearSelection = vi.fn();
    const { rerender } = render(
      <CityDesignChangeRequestCanvasList
        changeRequests={[changeRequest()]}
        selectedChangeRequestId="cr-panel-1"
        onChangeRequestSelect={onChangeRequestSelect}
      />
    );

    fireEvent.click(
      document.querySelector<HTMLElement>(
        '[data-action-id="amendments.city-cr.close.selection"]'
      ) as HTMLElement
    );
    expect(onChangeRequestSelect).toHaveBeenCalledWith(null);

    rerender(
      <CityDesignChangeRequestDetailsView
        changeRequest={changeRequest()}
        onClearSelection={onClearSelection}
      />
    );
    const disabledEdit = document.querySelector<HTMLButtonElement>(
      '[data-action-id="amendments.city-cr-details.edit.disabled"]'
    );
    expect(disabledEdit?.disabled).toBe(true);
    fireEvent.click(
      document.querySelector<HTMLElement>(
        '[data-action-id="amendments.city-cr-details.close.selection"]'
      ) as HTMLElement
    );
    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });
});
