/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  selectChange: undefined as undefined | ((value: string) => void),
  openChange: undefined as undefined | ((open: boolean) => void),
  diffProps: null as any,
}));

vi.mock('@/features/amendments/logic/amendmentBranchDisplay', () => ({
  countOpenChangeRequests: (branch: any) => branch.openCount ?? 0,
  getBranchEditingMode: (branch: any) => branch.mode ?? 'edit',
  getBranchDisplayEvent: (branch: any) => branch.eventStep ?? null,
  getBranchPathLabel: (branch: any) => branch.label ?? branch.id,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/ui/ui/select', () => ({
  Select: ({ children, onValueChange }: any) => {
    mocks.selectChange = onValueChange;
    return <div>{children}</div>;
  },
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value, ...props }: any) => (
    <button {...props} type="button" onClick={() => mocks.selectChange?.(value)}>
      {children}
    </button>
  ),
  SelectTrigger: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock('@/features/shared/ui/ui/collapsible', () => ({
  Collapsible: ({ children, onOpenChange }: any) => {
    mocks.openChange = onOpenChange;
    return <div>{children}</div>;
  },
  CollapsibleContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CollapsibleTrigger: ({ children }: { children: ReactNode }) => (
    <div onClick={() => mocks.openChange?.(true)}>{children}</div>
  ),
}));
vi.mock('@/features/agendas/ui/MergeVariantComparisonPanel', () => ({
  VariantDiffPanel: (props: any) => {
    mocks.diffProps = props;
    return <div>diff panel</div>;
  },
}));
vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  EditingModeBadge: ({ mode }: { mode: string }) => <span>mode:{mode}</span>,
}));

import { AmendmentBranchSelectorSection } from '../AmendmentBranchSelectorSection';

const branch = (overrides: Record<string, any> = {}) => ({
  id: 'branch',
  label: 'Branch',
  mode: 'edit',
  status: 'active',
  openCount: 0,
  eventStep: null,
  ...overrides,
});

describe('AmendmentBranchSelectorSection A04 branch accountability', () => {
  afterEach(() => {
    cleanup();
    mocks.selectChange = undefined;
    mocks.openChange = undefined;
    mocks.diffProps = null;
  });

  it('returns null for an empty branch list', () => {
    const { container } = render(
      <AmendmentBranchSelectorSection branches={[]} onBranchChange={vi.fn()} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('selects a branch and maps main, all, and concrete option changes', () => {
    const onBranchChange = vi.fn();
    const branches = [
      branch({
        id: 'one',
        label: 'One',
        eventStep: { event_id: 'event', event: { title: 'Event title' } },
      }),
      branch({
        id: 'two',
        label: 'Two',
        status: null,
        eventStep: { event_id: 'event', event: null },
      }),
      branch({ id: 'three', label: 'Three', eventStep: { event_id: null } }),
    ];
    const { rerender } = render(
      <AmendmentBranchSelectorSection
        branches={branches as any}
        selectedBranchId="one"
        onBranchChange={onBranchChange}
      />
    );
    expect(screen.getAllByText('One').length).toBeGreaterThan(0);
    expect(screen.getByText('Event title')).toBeTruthy();
    expect(screen.getAllByText('features.amendments.text.branchSelector.sameEvent')).toHaveLength(
      2
    );

    mocks.selectChange?.('main');
    mocks.selectChange?.('all');
    mocks.selectChange?.('two');
    expect(onBranchChange).toHaveBeenNthCalledWith(1, null);
    expect(onBranchChange).toHaveBeenNthCalledWith(2, null);
    expect(onBranchChange).toHaveBeenNthCalledWith(3, 'two');

    rerender(
      <AmendmentBranchSelectorSection
        branches={branches as any}
        selectedBranchId="two"
        onBranchChange={onBranchChange}
      />
    );
    expect(screen.getAllByText('Two').length).toBeGreaterThan(0);

    rerender(
      <AmendmentBranchSelectorSection
        branches={branches as any}
        selectedBranchId="missing"
        onBranchChange={onBranchChange}
      />
    );
    expect(
      screen.getAllByText('features.amendments.text.branchSelector.mainDocument').length
    ).toBeGreaterThan(0);
  });

  it('renders the inline all-branches option with a supplied label', () => {
    render(
      <AmendmentBranchSelectorSection
        branches={[branch()] as any}
        selectedBranchId={null}
        variant="inline"
        includeAllBranchesOption
        allBranchesLabel="Every branch"
        onBranchChange={vi.fn()}
      />
    );
    expect(screen.getAllByText('Every branch').length).toBeGreaterThan(0);
  });

  it('renders and opens diff controls with explicit and fallback candidates', () => {
    const candidates = [{ id: 'left' }, { id: 'right' }] as any;
    const { rerender } = render(
      <AmendmentBranchSelectorSection
        branches={[branch()] as any}
        branchDiffCandidates={candidates}
        defaultDiffRightCandidateId="right"
        onBranchChange={vi.fn()}
      />
    );
    expect(screen.getByText('diff panel')).toBeTruthy();
    expect(mocks.diffProps.defaultRightCandidateId).toBe('right');
    fireEvent.click(screen.getByText('features.amendments.text.branchSelector.branchDiff'));
    expect(screen.getByLabelText('features.amendments.text.branchSelector.closeDiff')).toBeTruthy();

    rerender(
      <AmendmentBranchSelectorSection
        branches={[branch()] as any}
        branchDiffCandidates={candidates}
        defaultDiffRightCandidateId={null}
        onBranchChange={vi.fn()}
      />
    );
    expect(mocks.diffProps.defaultRightCandidateId).toBeNull();
  });

  it('hides diff controls for fewer than two candidates and handles event-count defaults', () => {
    render(
      <AmendmentBranchSelectorSection
        branches={
          [
            branch({ id: 'no-event', eventStep: null }),
            branch({ id: 'unique', eventStep: { event_id: 'unique', event: { title: null } } }),
          ] as any
        }
        branchDiffCandidates={[{ id: 'only' }] as any}
        onBranchChange={vi.fn()}
      />
    );
    expect(screen.queryByText('diff panel')).toBeNull();
    expect(screen.queryByText('features.amendments.text.branchSelector.sameEvent')).toBeNull();
  });
});
