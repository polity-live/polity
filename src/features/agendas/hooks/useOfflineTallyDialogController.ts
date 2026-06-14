import { useEffect, useMemo, useState } from 'react';

interface OfflineTallyEntry {
  id: string;
}

interface UseOfflineTallyDialogControllerOptions<TValue> {
  open: boolean;
  entries: readonly OfflineTallyEntry[];
  tallies: readonly TValue[];
  maxTotalVotes?: number | null;
  getTallyEntryId: (tally: TValue) => string | null | undefined;
  getTallyCount: (tally: TValue) => number | null | undefined;
  onSubmit: (args: { password: string; counts: Record<string, number> }) => Promise<void>;
}

export function useOfflineTallyDialogController<TValue>({
  open,
  entries,
  tallies,
  maxTotalVotes,
  getTallyEntryId,
  getTallyCount,
  onSubmit,
}: UseOfflineTallyDialogControllerOptions<TValue>) {
  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) {
      return;
    }

    const nextDraft: Record<string, string> = {};
    for (const entry of entries) {
      const tally = tallies.find(item => getTallyEntryId(item) === entry.id);
      nextDraft[entry.id] = String(tally ? (getTallyCount(tally) ?? 0) : 0);
    }
    setDraft(nextDraft);
  }, [entries, getTallyCount, getTallyEntryId, open, tallies]);

  const normalizedCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const entry of entries) {
      counts[entry.id] = Math.max(0, Number.parseInt(draft[entry.id] ?? '0', 10) || 0);
    }
    return counts;
  }, [entries, draft]);

  const totalVotes = useMemo(
    () => Object.values(normalizedCounts).reduce((sum, value) => sum + value, 0),
    [normalizedCounts]
  );

  const isOverLimit = maxTotalVotes != null && totalVotes > maxTotalVotes;

  const setDraftValue = (id: string, value: string) => {
    setDraft(current => ({
      ...current,
      [id]: value,
    }));
  };

  const handlePasswordSubmit = (password: string) =>
    onSubmit({ password, counts: normalizedCounts });

  return {
    draft,
    totalVotes,
    isOverLimit,
    onDraftValueChange: setDraftValue,
    onPasswordSubmit: handlePasswordSubmit,
  };
}
