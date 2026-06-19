/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useOfflineTallyDialogController } from '../useOfflineTallyDialogController';

interface Entry {
  id: string;
}

interface Tally {
  id: string;
  count?: number | null;
}

interface HookProps {
  open: boolean;
  entries: Entry[];
  tallies: Tally[];
  maxTotalVotes?: number | null;
  maxPerEntryVotes?: number | null;
}

interface SubmitArgs {
  password: string;
  counts: Record<string, number>;
}

const getTallyEntryId = (tally: Tally) => tally.id;
const getTallyCount = (tally: Tally) => tally.count;

function buildProps(overrides: Partial<HookProps> = {}): HookProps {
  return {
    open: true,
    entries: [{ id: 'accept' }, { id: 'reject' }],
    tallies: [{ id: 'accept', count: 2 }],
    maxTotalVotes: null,
    maxPerEntryVotes: null,
    ...overrides,
  };
}

function renderController(
  initialProps: HookProps = buildProps(),
  options: { unstableGetters?: boolean } = {}
) {
  const onSubmit = vi.fn<(args: SubmitArgs) => Promise<void>>(async () => undefined);

  const hook = renderHook(
    (props: HookProps) =>
      useOfflineTallyDialogController<Tally>({
        ...props,
        getTallyEntryId: options.unstableGetters ? tally => tally.id : getTallyEntryId,
        getTallyCount: options.unstableGetters ? tally => tally.count : getTallyCount,
        onSubmit,
      }),
    { initialProps }
  );

  return {
    ...hook,
    onSubmit,
  };
}

describe('useOfflineTallyDialogController', () => {
  it('seeds draft counts from existing tallies when opened', () => {
    const { result } = renderController();

    expect(result.current.draft).toEqual({
      accept: '2',
      reject: '0',
    });
    expect(result.current.totalVotes).toBe(2);
    expect(result.current.isOverLimit).toBe(false);
  });

  it('preserves edits across equivalent rerenders with unstable getter identities', () => {
    const { result, rerender } = renderController(buildProps(), { unstableGetters: true });

    act(() => {
      result.current.onDraftValueChange('reject', '7');
    });

    rerender(
      buildProps({
        entries: [{ id: 'accept' }, { id: 'reject' }],
        tallies: [{ id: 'accept', count: 2 }],
      })
    );

    expect(result.current.draft).toEqual({
      accept: '2',
      reject: '7',
    });
  });

  it('reseeds from persisted tallies after close and reopen', () => {
    const { result, rerender } = renderController();

    act(() => {
      result.current.onDraftValueChange('accept', '9');
    });

    rerender(buildProps({ open: false }));
    rerender(buildProps({ open: true }));

    expect(result.current.draft).toEqual({
      accept: '2',
      reject: '0',
    });
  });

  it('reseeds while open when the persisted tally source changes', () => {
    const { result, rerender } = renderController();

    act(() => {
      result.current.onDraftValueChange('reject', '7');
    });

    rerender(
      buildProps({
        tallies: [
          { id: 'accept', count: 3 },
          { id: 'reject', count: 1 },
        ],
      })
    );

    expect(result.current.draft).toEqual({
      accept: '3',
      reject: '1',
    });
  });

  it('submits normalized counts and flags totals over the limit', async () => {
    const { result, onSubmit } = renderController(buildProps({ maxTotalVotes: 3 }));

    act(() => {
      result.current.onDraftValueChange('accept', '4');
      result.current.onDraftValueChange('reject', '-2');
    });

    expect(result.current.totalVotes).toBe(4);
    expect(result.current.isOverTotalLimit).toBe(true);
    expect(result.current.isOverLimit).toBe(true);

    await act(async () => {
      await result.current.onPasswordSubmit('1234');
    });

    expect(onSubmit).toHaveBeenCalledWith({
      password: '1234',
      counts: {
        accept: 4,
        reject: 0,
      },
    });
  });

  it('flags entries over the per-entry limit', () => {
    const { result } = renderController(buildProps({ maxTotalVotes: 12, maxPerEntryVotes: 3 }));

    act(() => {
      result.current.onDraftValueChange('accept', '4');
      result.current.onDraftValueChange('reject', '3');
    });

    expect(result.current.totalVotes).toBe(7);
    expect(result.current.isOverTotalLimit).toBe(false);
    expect(result.current.isOverEntryLimit).toBe(true);
    expect(result.current.isOverLimit).toBe(true);
    expect(result.current.overLimitEntryIds).toEqual(['accept']);
  });

  it('allows entries at the per-entry limit when the total is within the cap', () => {
    const { result } = renderController(
      buildProps({
        entries: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }],
        tallies: [
          { id: 'a', count: 3 },
          { id: 'b', count: 3 },
          { id: 'c', count: 3 },
          { id: 'd', count: 3 },
        ],
        maxTotalVotes: 12,
        maxPerEntryVotes: 3,
      })
    );

    expect(result.current.totalVotes).toBe(12);
    expect(result.current.isOverTotalLimit).toBe(false);
    expect(result.current.isOverEntryLimit).toBe(false);
    expect(result.current.isOverLimit).toBe(false);
    expect(result.current.overLimitEntryIds).toEqual([]);
  });
});
