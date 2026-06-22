import { describe, expect, it } from 'vitest';
import { deriveControllingEventForSettings } from '../amendmentSettingsEventPhase';

describe('deriveControllingEventForSettings', () => {
  it('does not expose an event phase while the amendment is in an internal mode', () => {
    const process = {
      current_process_run: {
        step_runs: [
          {
            id: 'step-1',
            event_id: 'event-1',
            event: { id: 'event-1', title: 'Annual Assembly' },
            status: 'scheduled',
            order_index: 1,
          },
        ],
      },
    };

    expect(deriveControllingEventForSettings(process, 'edit')).toBeNull();
    expect(deriveControllingEventForSettings(process, 'suggest_internal')).toBeNull();
    expect(deriveControllingEventForSettings(process, 'vote_internal')).toBeNull();
  });

  it('uses the active process event instead of the first linked event id', () => {
    const process = {
      current_process_run: {
        step_runs: [
          {
            id: 'step-1',
            event_id: 'event-old',
            event: { id: 'event-old', title: 'Previous Assembly' },
            status: 'completed',
            decision_status: 'completed',
            order_index: 1,
          },
          {
            id: 'step-2',
            event_id: 'event-current',
            event: { id: 'event-current', title: 'Current Assembly' },
            status: 'scheduled',
            order_index: 2,
          },
        ],
      },
    };

    expect(deriveControllingEventForSettings(process, 'suggest_event')).toEqual({
      id: 'event-current',
      title: 'Current Assembly',
    });
  });

  it('does not fall back to the event id as a visible title', () => {
    const process = {
      current_process_run: {
        step_runs: [
          {
            id: 'step-1',
            event_id: '082e8fa5-2cd4-4e82-bedf-ac77844e3d99',
            event: { id: '082e8fa5-2cd4-4e82-bedf-ac77844e3d99', title: null },
            status: 'in_vote',
            order_index: 1,
          },
        ],
      },
    };

    expect(deriveControllingEventForSettings(process, 'event_final_closing_vote')).toEqual({
      id: '082e8fa5-2cd4-4e82-bedf-ac77844e3d99',
      title: null,
    });
  });
});
