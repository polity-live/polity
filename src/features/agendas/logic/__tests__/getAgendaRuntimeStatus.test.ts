import { describe, expect, it } from 'vitest';
import { getAgendaRuntimeStatus } from '../getAgendaRuntimeStatus';

describe('getAgendaRuntimeStatus', () => {
  it('treats active, current, and activated agenda items as in progress', () => {
    expect(getAgendaRuntimeStatus({ id: 'agenda-1', status: 'active' })).toBe('in-progress');
    expect(getAgendaRuntimeStatus({ id: 'agenda-1', currentAgendaItemId: 'agenda-1' })).toBe(
      'in-progress'
    );
    expect(getAgendaRuntimeStatus({ id: 'agenda-1', activated_at: 1 })).toBe('in-progress');
  });

  it('lets completed status and end timestamps take precedence over active markers', () => {
    expect(getAgendaRuntimeStatus({ id: 'agenda-1', status: 'active', end_time: 1 })).toBe(
      'completed'
    );
    expect(getAgendaRuntimeStatus({ id: 'agenda-1', status: 'active', completed_at: 1 })).toBe(
      'completed'
    );
  });

  it('keeps planned and pending statuses distinct before runtime markers exist', () => {
    expect(getAgendaRuntimeStatus({ id: 'agenda-1', status: 'planned' })).toBe('planned');
    expect(getAgendaRuntimeStatus({ id: 'agenda-1' })).toBe('pending');
  });
});
