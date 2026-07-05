/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCorridorStreetDesignObject } from '../../logic/streetDesignPlacement';
import type { StreetDesignChangeRequest } from '../../logic/streetDesignChangeRequests';
import {
  StreetDesignChangeRequestCanvasList,
  StreetDesignChangeRequestPanel,
} from '../StreetDesignChangeRequestPanel';

afterEach(() => {
  cleanup();
});

function changeRequest(
  overrides: Partial<StreetDesignChangeRequest> = {}
): StreetDesignChangeRequest {
  return {
    id: 'cr-panel-1',
    source_type: 'street_design_object',
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

describe('StreetDesignChangeRequestPanel', () => {
  it('selects change requests from the canvas list', () => {
    const onChangeRequestSelect = vi.fn();
    render(
      <StreetDesignChangeRequestCanvasList
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
      <StreetDesignChangeRequestPanel
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
      <StreetDesignChangeRequestPanel
        changeRequest={changeRequest()}
        currentUserId="user-1"
        currentUserDisplayName="Tobias"
        onCommentSubmit={onCommentSubmit}
      />
    );

    fireEvent.change(screen.getByPlaceholderText(/reply/i), {
      target: { value: 'Looks good to me' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    expect(onCommentSubmit).toHaveBeenCalledWith('cr-panel-1', 'Looks good to me');
  });

  it('shows before and after changed properties in an accordion', () => {
    const before = createCorridorStreetDesignObject({
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
      <StreetDesignChangeRequestPanel
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
});
