/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: any) => (typeof fallback === 'string' ? fallback : key),
  }),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));

import {
  MembershipRightsAlignmentPanel,
  membershipRightsAlignmentPanelInternals as internals,
} from '../MembershipRightsAlignmentPanel';
import {
  MembershipRightsAlignmentPanelView,
  membershipRightsAlignmentPanelViewInternals as viewInternals,
} from '../MembershipRightsAlignmentPanelView';

afterEach(cleanup);
const membership = (extra: any = {}) => ({
  id: 'm',
  user_id: 'u',
  group_id: 'g',
  user: {},
  roles: [],
  role: null,
  ...extra,
});
const row = (extra: any = {}) => ({
  status: 'aligned',
  membership: membership(),
  sourceGroupId: null,
  connectedRights: [],
  missingRights: [],
  extraRights: [],
  ...extra,
});

describe('MembershipRightsAlignmentPanel branches', () => {
  it('renders every status, origin, rights, and role variant', () => {
    const components = internals;
    render(
      <>
        {(['aligned', 'missing', 'extra', 'mixed'] as const).map(status => (
          <components.AlignmentStatusBadge key={status} status={status} />
        ))}
        <components.OriginCell partGroup={null} baseGroup={null} sourceGroupId={null} />
        <components.OriginCell
          partGroup={{ id: 'p', name: 'Part' }}
          baseGroup={{ id: 'b', name: 'Base' }}
          sourceGroupId="source"
        />
        <components.OriginCell
          partGroup={{ id: 'p', name: null as any }}
          baseGroup={{ id: 'b', name: null as any }}
          sourceGroupId="source"
        />
        <components.OriginCell
          partGroup={{ id: 'p', name: null as any }}
          baseGroup={{ id: 'b', name: null as any }}
          sourceGroupId={null}
        />
        <components.ConnectedRightsCell row={row()} />
        <components.ConnectedRightsCell
          row={row({
            connectedRights: [
              { rightKey: 'informationRight', paths: [{ groupPath: ['A', 'B'] }] },
              { rightKey: 'customRight', paths: [] },
            ],
          })}
        />
        <components.ActionRightList rights={[]} variant="missing" />
        <components.ActionRightList
          rights={[{ key: 'x', resource: 'r', action: 'a', label: 'Missing right' }]}
          variant="missing"
        />
        <components.ActionRightList
          rights={[{ key: 'x', resource: 'r', action: 'a', label: 'Extra right' }]}
          variant="extra"
        />
        <components.RoleList membership={membership()} />
        <components.RoleList
          membership={membership({
            roles: [
              { id: 'r1', name: '' },
              { id: 'r2', name: 'Named role' },
            ],
          })}
        />
      </>
    );
    expect(document.body.textContent).toContain('Missing right');
    expect(document.body.textContent).toContain('Named role');
  });

  it('covers translation, member-name, path formatting, and filter validation fallbacks', () => {
    expect(internals.tText(() => 3, 'key', 'fallback')).toBe('3');
    expect(internals.tText(() => null, 'key', 'fallback')).toBe('fallback');
    expect(viewInternals.tText(() => 4, 'key', 'fallback')).toBe('4');
    expect(viewInternals.tText(() => undefined, 'key', 'fallback')).toBe('fallback');
    expect(
      internals.getMemberName(membership({ user: { first_name: 'First', last_name: 'Last' } }))
    ).toBe('First Last');
    expect(internals.getMemberName(membership({ user: { handle: 'handle' } }))).toBe('handle');
    expect(internals.getMemberName(membership({ user: { email: 'mail' } }))).toBe('mail');
    expect(internals.getMemberName(membership({ user_id: 'user-id' }))).toBe('user-id');
    expect(internals.getMemberName(membership({ user_id: '', id: 'membership-id' }))).toBe(
      'membership-id'
    );
    expect(internals.formatPathTitle([{ groupPath: ['A', 'B'] }, { groupPath: ['C'] }])).toBe(
      'A > B\nC'
    );
    for (const value of ['all', 'aligned', 'missing', 'extra', 'mixed'])
      expect(viewInternals.isAlignmentFilter(value)).toBe(true);
    expect(viewInternals.isAlignmentFilter('invalid')).toBe(false);
  });

  it('sorts equal statuses by every member-name fallback and distinct statuses by priority', () => {
    const rows = [
      row({ status: 'aligned', membership: membership({ id: 'z', user: { handle: 'Zulu' } }) }),
      row({ status: 'aligned', membership: membership({ id: 'a', user: { handle: 'Alpha' } }) }),
      row({ status: 'mixed', membership: membership({ id: 'm', user: { handle: 'Mixed' } }) }),
    ];
    render(
      <MembershipRightsAlignmentPanel
        rows={rows as any}
        onOpenRightsDialog={vi.fn()}
        onOpenChangeRoleDialog={vi.fn()}
      />
    );
    const names = screen
      .getAllByText(/Alpha|Zulu|Mixed/)
      .map(node => node.textContent)
      .filter(name => !name?.startsWith('@'));
    expect(names).toEqual(['Mixed', 'Alpha', 'Zulu']);
  });

  it('passes loading empty-state text and calls invalid and valid view filter guards', () => {
    const setFilter = vi.fn();
    render(
      <MembershipRightsAlignmentPanelView
        {...({
          rows: [],
          isLoading: true,
          t: (key: string) => key,
          filter: 'all',
          setFilter,
          counts: { aligned: 0, missing: 0, extra: 0, mixed: 0 },
          visibleRows: [],
          columns: [],
        } as any)}
      />
    );
    expect(document.body.textContent).toContain('rightsAlignment.title');
  });
});
