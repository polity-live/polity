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
    expect(deriveControllingEventForSettings(process, null)).toBeNull();
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

  it('returns null without event steps and filters steps without event identities', () => {
    expect(deriveControllingEventForSettings(null, 'suggest_event')).toBeNull();
    expect(
      deriveControllingEventForSettings(
        {
          current_process_run: {
            step_runs: [{ id: 'no-event', event_id: null, event: null, order_index: null }],
          },
        },
        'suggest_event'
      )
    ).toBeNull();
  });

  it('sorts event relations and falls back from joined IDs and blank titles', () => {
    expect(
      deriveControllingEventForSettings(
        {
          current_process_run: {
            step_runs: [
              {
                id: 'later',
                event_id: null,
                event: { id: 'event-later', title: '   ' },
                status: 'completed',
                decision_status: 'completed',
                order_index: undefined,
              },
              {
                id: 'earlier',
                event_id: 'event-earlier',
                event: null,
                status: 'completed',
                decision_status: 'completed',
                order_index: -1,
              },
            ],
          },
        },
        'event_final_closing_vote'
      )
    ).toEqual({ id: 'event-earlier', title: null });

    expect(
      deriveControllingEventForSettings(
        {
          current_process_run: {
            step_runs: [
              {
                id: 'earlier',
                event_id: 'event-earlier',
                status: 'completed',
                order_index: -1,
              },
              {
                id: 'later',
                event: { id: 'event-later', title: 'Later' },
                status: 'completed',
                order_index: undefined,
              },
            ],
          },
        },
        'suggest_event'
      )
    ).toEqual({ id: 'event-earlier', title: null });
  });

  it.each(['approved', 'accepted', 'supported', 'merged', 'rejected', 'withdrawn'])(
    'falls back to the first all-terminal event for %s',
    status => {
      expect(
        deriveControllingEventForSettings(
          {
            current_process_run: {
              step_runs: [
                {
                  id: 'terminal',
                  event_id: 'event',
                  status,
                  decision_status: null,
                  order_index: 1,
                },
              ],
            },
          },
          'suggest_event'
        )
      ).toEqual({ id: 'event', title: null });
    }
  );
});
