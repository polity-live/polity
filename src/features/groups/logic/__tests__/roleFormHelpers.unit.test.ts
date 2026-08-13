import { describe, expect, it } from 'vitest';
import { emptyRoleEditorForm, roleEditorFormToMutation, toDateInput } from '../roleFormHelpers';

describe('role form date helpers', () => {
  it('roundtrips calendar dates through local timestamps', () => {
    const mutation = roleEditorFormToMutation({
      ...emptyRoleEditorForm(),
      name: 'Treasurer',
      term_start_date: '2026-07-19',
      scheduled_revote_date: '2030-07-19',
    });

    expect(toDateInput(mutation.term_start_date)).toBe('2026-07-19');
    expect(toDateInput(mutation.scheduled_revote_date)).toBe('2030-07-19');
  });
});
