/* @vitest-environment jsdom */

import { cleanup, fireEvent, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderComponentFlow } from '@/test/render-component-flow';
import { getProcessPathGroupOptions } from '@/features/amendments/logic/amendmentPathHelpers';
import { buildAmendmentPathVisualizationData } from '@/features/amendments/logic/buildAmendmentPathVisualizationData';
import { buildAmendmentForwardingPreview } from '@/features/amendments/logic/amendmentForwardingPreview';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, params }: { children: ReactNode; to: string; params: { id: string } }) => (
    <a href={to.replace('$id', params.id)}>{children}</a>
  ),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { AmendmentForwardingPreview } from '@/features/amendments/ui/AmendmentForwardingPreview';

const groups = [
  { id: 'group-source', name: 'Source' },
  { id: 'group-middle', name: 'Middle' },
  { id: 'group-target', name: 'Target' },
] as any[];

const relationship = (source: string, target: string, granted = true) =>
  ({
    id: `${source}-${target}`,
    group_id: source,
    related_group_id: target,
    group: groups.find(group => group.id === source),
    related_group: groups.find(group => group.id === target),
    status: 'active',
    with_right: 'amendmentRight',
    grant_id: granted ? `grant-${source}-${target}` : null,
  }) as any;

function ForwardingFlow() {
  const [materialized, setMaterialized] = useState(false);
  const stepRuns = useMemo(
    () => [
      {
        id: 'step-source',
        target_group_id: 'group-source',
        target_group: { name: 'Source' },
        order_index: 0,
        status: materialized ? 'approved' : 'in_vote',
        decision_status: materialized ? 'approved' : null,
      },
      {
        id: 'step-target',
        target_group_id: 'group-target',
        target_group: { id: 'group-target', name: 'Target' },
        order_index: 1,
        status: 'scheduled',
        event_id: 'event-target',
        event: { id: 'event-target', title: 'Target vote', start_date: 2_000_000_000_000 },
        agenda_item_id: materialized ? 'agenda-target' : null,
        vote_id: materialized ? 'vote-target' : null,
      },
    ],
    [materialized]
  );
  const visualization = buildAmendmentPathVisualizationData(stepRuns);
  const preview = buildAmendmentForwardingPreview({
    amendmentId: 'amendment-1',
    currentStepRun: stepRuns[0],
    nextStepRun: stepRuns[1],
  });

  return (
    <div>
      <output data-testid="branch-count">{visualization.length}</output>
      {preview ? <AmendmentForwardingPreview {...preview} /> : null}
      <button type="button" onClick={() => setMaterialized(true)}>
        Resolve branch vote
      </button>
    </div>
  );
}

afterEach(cleanup);

describe('amendment forwarding component flow', () => {
  it('validates that a forwarding path only traverses active amendment grants', () => {
    const valid = getProcessPathGroupOptions({
      sourceGroupId: 'group-source',
      targetGroupId: 'group-target',
      groups: groups as any,
      relationships: [
        relationship('group-source', 'group-middle'),
        relationship('group-middle', 'group-target'),
      ],
    });
    const invalid = getProcessPathGroupOptions({
      sourceGroupId: 'group-source',
      targetGroupId: 'group-target',
      groups: groups as any,
      relationships: [relationship('group-source', 'group-target', false)],
    });

    expect(valid.map(path => path.groupIds)).toContainEqual([
      'group-source',
      'group-middle',
      'group-target',
    ]);
    expect(invalid).toEqual([]);
  });

  it('creates the next branch view and becomes forwarded after vote materialization', () => {
    const { container } = renderComponentFlow(<ForwardingFlow />);

    expect(screen.getByTestId('branch-count').textContent).toBe('2');
    expect(container.querySelector('[data-forwarding-status="pending"]')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Resolve branch vote' }));

    expect(container.querySelector('[data-forwarding-status="forwarded"]')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Target vote · Target' }).getAttribute('href')).toBe(
      '/event/event-target/agenda'
    );
  });

  it('shows explicit merge waiting, tie, and rejection states without a false success', () => {
    const destination = {
      nextEventTitle: 'Merge event',
      nextGroupName: 'Target',
    };
    const { container, rerender } = renderComponentFlow(
      <AmendmentForwardingPreview {...destination} status="pending" />
    );
    expect(container.querySelector('[data-forwarding-status="pending"]')).toBeTruthy();

    rerender(<AmendmentForwardingPreview {...destination} status="tie" />);
    expect(container.querySelector('[data-forwarding-status="tie"]')).toBeTruthy();
    expect(container.querySelector('[data-forwarding-status="forwarded"]')).toBeNull();

    rerender(<AmendmentForwardingPreview {...destination} status="rejected" />);
    expect(container.querySelector('[data-forwarding-status="rejected"]')).toBeTruthy();
  });
});
