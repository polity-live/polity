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
    expect(screen.getByRole('button', { name: LOCK_LABEL }).getAttribute('data-action-id')).toBe(
      'events.attendance-mode.help'
    );
    expect(screen.getByText(LOCK_DESCRIPTION)).not.toBeNull();
    const help = screen.getByRole('button', { name: LOCK_LABEL });
    fireEvent.pointerEnter(help, { pointerType: 'mouse' });
    const content = screen
      .getByText(LOCK_DESCRIPTION)
      .closest('[data-slot="popover-content"]') as HTMLElement;
    fireEvent.pointerEnter(help, { pointerType: 'touch' });
    fireEvent.pointerLeave(help, { pointerType: 'touch' });
    fireEvent.pointerEnter(content, { pointerType: 'touch' });
    fireEvent.pointerLeave(content, { pointerType: 'touch' });
    fireEvent.pointerEnter(content, { pointerType: 'mouse' });
    fireEvent.pointerLeave(content, { pointerType: 'mouse' });
    fireEvent.pointerEnter(help, { pointerType: 'mouse' });
    fireEvent.pointerLeave(help, { pointerType: 'mouse' });
  });

  it('allows mode changes and hides the lock help when no ballot has started', () => {
    const onChange = vi.fn();
    render(<EventAttendanceModeSelector value="online" locked={false} onChange={onChange} t={t} />);

    const hybrid = screen.getByRole('button', { name: 'Hybrid' });
    expect(hybrid.getAttribute('data-action-id')).toBe('events.attendance-mode.select');
    fireEvent.click(hybrid);
    expect(onChange).toHaveBeenCalledWith('hybrid');
    fireEvent.click(screen.getByRole('button', { name: 'Online' }));
    fireEvent.click(screen.getByRole('button', { name: 'Offline' }));
    expect(onChange.mock.calls.map(([mode]) => mode)).toEqual(['hybrid', 'online', 'offline']);
    expect(screen.queryByRole('button', { name: LOCK_LABEL })).toBeNull();
  });
});
