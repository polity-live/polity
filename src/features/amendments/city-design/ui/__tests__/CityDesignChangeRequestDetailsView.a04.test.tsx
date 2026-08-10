/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CityDesignChangeRequestDetailsView } from '../CityDesignChangeRequestDetailsView';

afterEach(cleanup);

describe('CityDesignChangeRequestDetailsView A04 alternatives', () => {
  it('renders empty fallbacks and zero vote counts', () => {
    const onClearSelection = vi.fn();
    render(
      <CityDesignChangeRequestDetailsView
        changeRequest={{ id: 'empty', change_type: 'update' }}
        onClearSelection={onClearSelection}
      />
    );
    expect(screen.getByText(/no details yet/i)).toBeTruthy();
    expect(screen.getByText(/no property diff stored/i)).toBeTruthy();
    expect(screen.getAllByText('0')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClearSelection).toHaveBeenCalled();
  });

  it('renders source descriptions, non-empty diffs, and explicit vote counts', () => {
    render(
      <CityDesignChangeRequestDetailsView
        changeRequest={{
          id: 'diff',
          source_title: 'Source description',
          change_type: 'update',
          original_properties: { properties: { width: 2 } },
          new_properties: { properties: { width: 3 } },
          votes_for: 4,
          votes_against: 2,
          votes_abstain: 1,
        }}
        onClearSelection={vi.fn()}
      />
    );
    expect(screen.getAllByText('Source description')).toHaveLength(2);
    expect(screen.getByText('width')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
  });
});
