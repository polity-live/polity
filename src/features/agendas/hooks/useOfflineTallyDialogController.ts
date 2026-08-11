import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface OfflineTallyEntry {
  id: string;
}

interface UseOfflineTallyDialogControllerOptions<TValue> {
  open: boolean;
  entries: readonly OfflineTallyEntry[];
  tallies: readonly TValue[];
  maxTotalVotes?: number | null;
  maxPerEntryVotes?: number | null;
  getTallyEntryId: (tally: TValue) => string | null | undefined;
  getTallyCount: (tally: TValue) => number | null | undefined;
  onSubmit: (args: { password: string; counts: Record<string, number> }) => Promise<void>;
}

function buildDraftSeed<TValue>({
  entries,
  tallies,
  getTallyEntryId,
  getTallyCount,
}: Pick<
  UseOfflineTallyDialogControllerOptions<TValue>,
  'entries' | 'tallies' | 'getTallyEntryId' | 'getTallyCount'
>) {
  const draft: Record<string, string> = {};
  const signatureEntries: [string, string][] = [];

  for (const entry of entries) {
    const tally = tallies.find(item => getTallyEntryId(item) === entry.id);
    const value = String(tally ? (getTallyCount(tally) ?? 0) : 0);

    draft[entry.id] = value;
    signatureEntries.push([entry.id, value]);
  }

  return {
    draft,
    signature: JSON.stringify(signatureEntries),
  };
}

export function useOfflineTallyDialogController<TValue>({
  open,
  entries,
  tallies,
  maxTotalVotes,
  maxPerEntryVotes,
  getTallyEntryId,
  getTallyCount,
  onSubmit,
}: UseOfflineTallyDialogControllerOptions<TValue>) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const seededDraftSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      seededDraftSignatureRef.current = null;
      return;
    }

    const seed = buildDraftSeed({ entries, tallies, getTallyEntryId, getTallyCount });

    if (seededDraftSignatureRef.current === seed.signature) {
      return;
    }

    seededDraftSignatureRef.current = seed.signature;
    setDraft(seed.draft);
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

  const isOverTotalLimit = maxTotalVotes != null && totalVotes > maxTotalVotes;
  const overLimitEntryIds = useMemo(
    () =>
      maxPerEntryVotes == null
        ? []
        : Object.entries(normalizedCounts)
            .filter(([, value]) => value > maxPerEntryVotes)
            .map(([id]) => id),
    [maxPerEntryVotes, normalizedCounts]
  );
  const isOverEntryLimit = overLimitEntryIds.length > 0;
  const isOverLimit = isOverTotalLimit || isOverEntryLimit;

  const setDraftValue = useCallback((id: string, value: string) => {
    setDraft(current => {
      if (current[id] === value) {
        return current;
      }

      return {
        ...current,
        [id]: value,
      };
    });
  }, []);

  const handlePasswordSubmit = useCallback(
    (password: string) => onSubmit({ password, counts: normalizedCounts }),
    [normalizedCounts, onSubmit]
  );

  return {
    draft,
    totalVotes,
    isOverTotalLimit,
    isOverEntryLimit,
    isOverLimit,
    overLimitEntryIds,
    onDraftValueChange: setDraftValue,
    onPasswordSubmit: handlePasswordSubmit,
  };
}
