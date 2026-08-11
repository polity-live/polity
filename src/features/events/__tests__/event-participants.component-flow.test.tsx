/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/ui/ui/dialog', () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div role="dialog">{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: ReactNode }) => <footer>{children}</footer>,
  DialogHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));
vi.mock('@/features/shared/ui/dialog', () => ({
  ScrollableDialogContent: ({ children }: { children: ReactNode }) => <section>{children}</section>,
}));

import { ChangeRoleDialog } from '@/features/groups/ui/ChangeRoleDialog';
import { EventParticipationButton } from '../ui/EventParticipationButton';

afterEach(cleanup);

const facilitatorRole = {
  id: 'facilitator',
  name: 'Facilitator',
  sort_order: 0,
  action_rights: [{ id: 'manage-event', resource: 'events', action: 'manage' }],
};

function ParticipantFlow({ initial = 'none' }: { initial?: 'none' | 'invited' | 'active' }) {
  const [status, setStatus] = useState(initial);
  const [role, setRole] = useState('Attendee');
  return (
    <div>
      <output aria-label="participant-status">{status}</output>
      <output aria-label="participant-role">{role}</output>
      <EventParticipationButton
        status={status === 'none' ? null : status}
        isParticipant={status === 'active'}
        hasRequested={false}
        isInvited={status === 'invited'}
        isLoading={false}
        onRequestParticipation={() => setStatus('active')}
        onAcceptInvitation={() => setStatus('active')}
        onLeave={() => setStatus('none')}
      />
      {status === 'active' ? (
        <ChangeRoleDialog
          isOpen
          onOpenChange={() => undefined}
          memberName="Event participant"
          currentRoles={role === 'Facilitator' ? [facilitatorRole] : []}
          roles={[facilitatorRole]}
          onConfirm={roleIds =>
            setRole(roleIds.includes(facilitatorRole.id) ? 'Facilitator' : 'Attendee')
          }
        />
      ) : null}
    </div>
  );
}

describe('event participant component flow', () => {
  it('accepts an invitation and exposes the persisted participant state', () => {
    render(<ParticipantFlow initial="invited" />);
    fireEvent.click(screen.getByRole('button', { name: /accept_invitation/i }));
    expect(screen.getByLabelText('participant-status').textContent).toBe('active');
    expect(screen.getByLabelText('Facilitator')).toBeTruthy();
  });

  it('assigns an event role only after participation is active', () => {
    render(<ParticipantFlow />);
    expect(screen.queryByLabelText('Facilitator')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /request_to_participate/i }));
    fireEvent.click(screen.getByLabelText('Facilitator'));
    fireEvent.click(screen.getByRole('button', { name: /save_roles/i }));
    expect(screen.getByLabelText('participant-role').textContent).toBe('Facilitator');
  });

  it('revokes participation and hides role management actions', () => {
    render(<ParticipantFlow initial="active" />);
    fireEvent.click(screen.getByRole('button', { name: /leave_event/i }));
    expect(screen.getByLabelText('participant-status').textContent).toBe('none');
    expect(screen.queryByLabelText('Facilitator')).toBeNull();
  });
});
