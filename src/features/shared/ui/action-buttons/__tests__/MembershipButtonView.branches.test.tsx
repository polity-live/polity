/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { UserPlus } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MembershipButtonView } from '../MembershipButtonView';

const labels = {
  accept: 'Accept invitation',
  leave: 'Leave group',
  pending: 'Request pending',
  request: 'Request membership',
};
const compactLabels = {
  accept: 'Accept',
  leave: 'Leave',
  pending: 'Pending',
  request: 'Join',
};

function props(overrides: Record<string, unknown> = {}) {
  return {
    buttonConfig: {
      compactLabel: 'Join',
      icon: UserPlus,
      label: 'Request membership',
      onClick: vi.fn(),
      variant: 'default' as const,
    },
    compactLabels,
    disabledAriaLabel: 'Membership unavailable',
    hasRequested: false,
    isInvited: false,
    isLoading: false,
    isMember: false,
    labels,
    loadingLabel: 'Loading membership',
    onDisabledBlur: vi.fn(),
    onDisabledPointerCancel: vi.fn(),
    onDisabledPointerDown: vi.fn(),
    onDisabledPointerLeave: vi.fn(),
    onDisabledPointerUp: vi.fn(),
    onDisabledReasonOpenChange: vi.fn(),
    showDisabledReason: false,
    ...overrides,
  };
}

afterEach(cleanup);

describe('MembershipButtonView branches', () => {
  it.each([
    ['pending', { hasRequested: true }, 'Request pending'],
    ['member', { isMember: true }, 'Leave group'],
    ['invited', { isInvited: true }, 'Accept invitation'],
  ])('renders the %s action in full and compact modes', (_name, state, label) => {
    const full = props(state);
    const view = render(<MembershipButtonView {...(full as any)} />);
    fireEvent.click(screen.getByRole('button', { name: label }));
    expect(full.buttonConfig.onClick).toHaveBeenCalled();

    const compact = props({ ...state, compactOnMobile: true });
    view.rerender(<MembershipButtonView {...(compact as any)} />);
    expect(screen.getByRole('button', { name: label })).toBeTruthy();
  });

  it('renders and operates the disabled-reason wrapper with conflict details', () => {
    const viewProps = props({
      actionId: 'membership-action',
      className: 'custom-membership',
      conflictDetails: <span>Conflict details</span>,
      disabled: true,
      disabledReason: 'A role conflicts',
      showDisabledReason: true,
    });
    const view = render(<MembershipButtonView {...(viewProps as any)} />);
    const wrapper = screen.getByLabelText('Membership unavailable');
    fireEvent.pointerDown(wrapper);
    fireEvent.pointerUp(wrapper);
    fireEvent.pointerCancel(wrapper);
    fireEvent.pointerLeave(wrapper);
    fireEvent.blur(wrapper);
    expect(viewProps.onDisabledPointerDown).toHaveBeenCalled();
    expect(viewProps.onDisabledPointerUp).toHaveBeenCalled();
    expect(viewProps.onDisabledPointerCancel).toHaveBeenCalled();
    expect(viewProps.onDisabledPointerLeave).toHaveBeenCalled();
    expect(viewProps.onDisabledBlur).toHaveBeenCalled();
    expect(screen.getByRole('tooltip').textContent).toContain('A role conflicts');
    expect(screen.getByText('Conflict details')).toBeTruthy();

    view.rerender(
      <MembershipButtonView
        {...(props({ compactOnMobile: true, disabled: true, disabledReason: undefined }) as any)}
      />
    );
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('does not enter the disabled-reason state while only a loading disable is active', () => {
    const viewProps = props({ disabled: true, isLoading: true });
    render(<MembershipButtonView {...(viewProps as any)} />);
    expect(screen.getByRole('button').getAttribute('data-loading')).toBe('true');
    expect(screen.queryByLabelText('Membership unavailable')).toBeNull();
  });
});
