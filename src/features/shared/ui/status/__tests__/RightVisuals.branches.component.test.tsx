/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ translation: undefined as string | undefined }));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string) => mocks.translation ?? `translated:${key}`,
  }),
}));

import {
  formatRights,
  getRightLabel,
  isEdgeVisible,
  isRightType,
  RightBadge,
  RightBadgeVisual,
  RightFilterOptionButton,
} from '../RightVisuals';

afterEach(cleanup);

describe('RightVisuals branches', () => {
  it('labels membership, known rights, and unknown rights with every translation fallback', () => {
    expect(getRightLabel('membership')).toBe('Membership');
    expect(getRightLabel('membership', () => 'Member')).toBe('Member');
    expect(getRightLabel('membership', () => '')).toBe('Membership');
    expect(getRightLabel('customRight')).toBe('customRight');
    expect(getRightLabel('informationRight')).toBe('Info');
    expect(getRightLabel('informationRight', () => 'Information')).toBe('Information');
    expect(getRightLabel('informationRight', () => '')).toBe('Info');
    expect(isRightType('activeVotingRight')).toBe(true);
    expect(isRightType('unknown')).toBe(false);
    expect(formatRights(['informationRight', 'customRight'])).toBe('Info, customRight');
    expect(formatRights(['membership'], () => 'Member')).toBe('Member');
  });

  it('checks edge visibility for matching and nonmatching selections', () => {
    expect(isEdgeVisible(['informationRight'], new Set(['informationRight']))).toBe(true);
    expect(isEdgeVisible(['informationRight'], new Set(['amendmentRight']))).toBe(false);
  });

  it('renders outline and gradient visuals in both sizes', () => {
    const view = render(
      <RightBadgeVisual right="informationRight" label="Outline" variant="outline" />
    );
    expect(screen.getByText('Outline').className).toContain('text-xs');
    view.rerender(
      <RightBadgeVisual
        className="custom-right"
        label="Compact outline"
        right="informationRight"
        size="compact"
        variant="outline"
      />
    );
    expect(screen.getByText('Compact outline').className).toContain('px-1.5');
    view.rerender(
      <RightBadgeVisual right="unknownRight" label="Unknown gradient" variant="gradient" />
    );
    expect(screen.getByText('Unknown gradient')).toBeTruthy();
    view.rerender(
      <RightBadgeVisual right="informationRight" label="Compact gradient" size="compact" />
    );
    expect(screen.getByText('Compact gradient').className).toContain('px-1.5');
  });

  it('renders both request directions and suppresses incomplete request markers', () => {
    const view = render(
      <RightBadgeVisual
        right="informationRight"
        label="Incoming"
        requestKind="incoming"
        requestStatusLabel="Incoming request"
      />
    );
    expect(screen.getByLabelText('Incoming request').className).toContain('--badge-info-fg');
    view.rerender(
      <RightBadgeVisual
        right="informationRight"
        label="Outgoing"
        requestKind="outgoing"
        requestStatusLabel="Outgoing request"
      />
    );
    expect(screen.getByLabelText('Outgoing request').className).toContain('--badge-warning-fg');
    view.rerender(
      <RightBadgeVisual
        right="informationRight"
        label="No status"
        requestKind="incoming"
        requestStatusLabel={null}
      />
    );
    expect(screen.queryByLabelText('Incoming request')).toBeNull();
    view.rerender(
      <RightBadgeVisual
        right="informationRight"
        label="No kind"
        requestKind={null}
        requestStatusLabel="Status"
      />
    );
    expect(screen.queryByLabelText('Status')).toBeNull();
  });

  it('resolves incoming, outgoing, and absent request labels in RightBadge', () => {
    const view = render(<RightBadge right="informationRight" requestKind="incoming" />);
    expect(screen.getByLabelText('translated:common.network.incomingRequest')).toBeTruthy();
    view.rerender(<RightBadge right="informationRight" requestKind="outgoing" />);
    expect(screen.getByLabelText('translated:common.network.outgoingRequest')).toBeTruthy();
    view.rerender(<RightBadge right="informationRight" />);
    expect(screen.queryByLabelText(/translated:common.network/)).toBeNull();
    mocks.translation = '';
    view.rerender(<RightBadge right="informationRight" />);
    expect(screen.getByText('Info')).toBeTruthy();
    mocks.translation = undefined;
  });

  it('renders and activates both filter states, including an unknown right', () => {
    const onClick = vi.fn();
    const view = render(
      <RightFilterOptionButton active right="informationRight" onClick={onClick}>
        Active
      </RightFilterOptionButton>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Active' }));
    expect(onClick).toHaveBeenCalled();
    view.rerender(
      <RightFilterOptionButton active right="unknownRight" onClick={onClick}>
        Unknown
      </RightFilterOptionButton>
    );
    expect(screen.getByRole('button', { name: 'Unknown' })).toBeTruthy();
    view.rerender(
      <RightFilterOptionButton active={false} right="informationRight" onClick={onClick}>
        Inactive
      </RightFilterOptionButton>
    );
    expect(screen.getByRole('button', { name: 'Inactive' }).className).toContain('border-border');
  });
});
