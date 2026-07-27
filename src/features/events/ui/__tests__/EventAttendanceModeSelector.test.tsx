/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventAttendanceModeSelector } from '../EventAttendanceModeSelector';

const LOCK_LABEL = 'Warum ist der Teilnahmemodus gesperrt?';
const LOCK_DESCRIPTION =
  'Der Teilnahmemodus kann nicht geändert werden, weil eine finale Abstimmung oder Wahl bereits gestartet wurde. Schließe sie zuerst ab.';

function t(key: string) {
  return key.endsWith('attendanceModeLockedLabel') ? LOCK_LABEL : LOCK_DESCRIPTION;
}

afterEach(cleanup);

describe('EventAttendanceModeSelector', () => {
  it('disables every mode and explains the lock through the help control', () => {
    render(<EventAttendanceModeSelector value="online" locked onChange={vi.fn()} t={t} />);

    expect(screen.getByRole('button', { name: 'Online' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Hybrid' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Offline' })).toHaveProperty('disabled', true);

    fireEvent.click(screen.getByRole('button', { name: LOCK_LABEL }));
    expect(screen.getByText(LOCK_DESCRIPTION)).not.toBeNull();
  });

  it('allows mode changes and hides the lock help when no ballot has started', () => {
    const onChange = vi.fn();
    render(<EventAttendanceModeSelector value="online" locked={false} onChange={onChange} t={t} />);

    fireEvent.click(screen.getByRole('button', { name: 'Hybrid' }));
    expect(onChange).toHaveBeenCalledWith('hybrid');
    expect(screen.queryByRole('button', { name: LOCK_LABEL })).toBeNull();
  });
});
