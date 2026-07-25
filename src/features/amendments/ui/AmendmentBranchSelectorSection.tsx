import { useMemo, useState } from 'react';
import {
  CalendarClock,
  ChevronDown,
  GitBranch,
  GitCompare,
  MessageSquareWarning,
} from 'lucide-react';
import {
  VariantDiffPanel,
  type VariantDiffCandidate,
} from '@/features/agendas/ui/MergeVariantComparisonPanel';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/features/shared/ui/ui/collapsible';
import { Button } from '@/features/shared/ui/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/features/shared/ui/ui/select';
import { BadgeControl } from '@/features/shared/ui/status';
import { EditingModeBadge } from '@/features/shared/ui/status';
import { cn } from '@/features/shared/utils/utils';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import {
  countOpenChangeRequests,
  getBranchEditingMode,
  getBranchDisplayEvent,
  getBranchPathLabel,
  type AmendmentProcessBranchSource,
} from '../logic/amendmentBranchDisplay';

interface AmendmentBranchSelectorSectionProps {
  branches: readonly AmendmentProcessBranchSource[];
  selectedBranchId?: string | null;
  variant?: 'page' | 'inline';
  includeAllBranchesOption?: boolean;
  allBranchesLabel?: string;
  branchDiffCandidates?: VariantDiffCandidate[];
  defaultDiffRightCandidateId?: string | null;
  onBranchChange: (branchId: string | null) => void;
}

export function AmendmentBranchSelectorSection({
  branches,
  selectedBranchId,
  variant = 'page',
  includeAllBranchesOption = false,
  allBranchesLabel,
  branchDiffCandidates = [],
  defaultDiffRightCandidateId,
  onBranchChange,
}: AmendmentBranchSelectorSectionProps) {
  const { t } = useTranslation();
  const [branchDiffOpen, setBranchDiffOpen] = useState(false);
  const resolvedAllBranchesLabel =
    allBranchesLabel ?? t('features.amendments.text.branchSelector.allBranches');
  const selectedBranch = useMemo(
    () => branches.find(branch => branch.id === selectedBranchId) ?? null,
    [branches, selectedBranchId]
  );
  const eventIdCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const branch of branches) {
      const eventId = getBranchDisplayEvent(branch)?.event_id;
      if (eventId) counts.set(eventId, (counts.get(eventId) ?? 0) + 1);
    }
    return counts;
  }, [branches]);
  const showBranchDiff = branchDiffCandidates.length >= 2;
  const selectedLabel = selectedBranch
    ? getBranchPathLabel(selectedBranch)
    : includeAllBranchesOption
      ? resolvedAllBranchesLabel
      : t('features.amendments.text.branchSelector.mainDocument');
  const isInline = variant === 'inline';

  if (branches.length === 0) return null;

  return (
    <Collapsible open={branchDiffOpen} onOpenChange={setBranchDiffOpen}>
      <div
        className={cn(
          'bg-background flex w-full flex-col gap-3 py-2 sm:flex-row sm:items-center sm:justify-between',
          isInline && 'rounded-md border px-4'
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <GitBranch className="text-muted-foreground h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {t('features.amendments.text.branchSelector.label')}
            </p>
            <p className="text-muted-foreground truncate text-xs">{selectedLabel}</p>
            {selectedBranch ? (
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <EditingModeBadge mode={getBranchEditingMode(selectedBranch)} variant="secondary" />
                {selectedBranch.status ? (
                  <BadgeControl variant="outline">{selectedBranch.status}</BadgeControl>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
          <Select
            value={selectedBranchId ?? (includeAllBranchesOption ? 'all' : 'main')}
            onValueChange={branchId =>
              onBranchChange(branchId === 'main' || branchId === 'all' ? null : branchId)
            }
          >
            <SelectTrigger
              className="w-full sm:w-48"
              aria-label={t('features.amendments.text.branchSelector.selectAria')}
            >
              <span className="min-w-0 truncate">{selectedLabel}</span>
            </SelectTrigger>
            <SelectContent className="w-[min(48rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)]">
              {includeAllBranchesOption ? (
                <SelectItem value="all" textValue={resolvedAllBranchesLabel}>
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="truncate">{resolvedAllBranchesLabel}</span>
                    <span className="text-muted-foreground text-xs">
                      {t('features.amendments.text.branchSelector.allBranchesDescription')}
                    </span>
                  </div>
                </SelectItem>
              ) : null}
              {branches.map(branch => {
                const branchLabel = getBranchPathLabel(branch);
                const eventStep = getBranchDisplayEvent(branch);
                const eventCount = eventStep?.event_id
                  ? (eventIdCounts.get(eventStep.event_id) ?? 0)
                  : 0;
                const openChangeRequests = countOpenChangeRequests(branch);

                return (
                  <SelectItem key={branch.id} value={branch.id} textValue={branchLabel}>
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="truncate">{branchLabel}</span>
                      <span className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                        <EditingModeBadge mode={getBranchEditingMode(branch)} variant="secondary" />
                        <BadgeControl variant="outline">{branch.status}</BadgeControl>
                        {eventStep?.event?.title ? (
                          <span className="inline-flex items-center gap-1">
                            <CalendarClock className="h-3 w-3" />
                            {eventStep.event.title}
                          </span>
                        ) : null}
                        <span>
                          {t('features.amendments.text.branchSelector.openChangeRequests', {
                            count: openChangeRequests,
                          })}
                        </span>
                        {eventCount > 1 ? (
                          <span className="inline-flex items-center gap-1">
                            <MessageSquareWarning className="h-3 w-3" />
                            {t('features.amendments.text.branchSelector.sameEvent')}
                          </span>
                        ) : null}
                      </span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          {showBranchDiff ? (
            <CollapsibleTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-between sm:w-auto"
                aria-label={
                  branchDiffOpen
                    ? t('features.amendments.text.branchSelector.closeDiff')
                    : t('features.amendments.text.branchSelector.openDiff')
                }
              >
                <span className="inline-flex items-center gap-2">
                  <GitCompare className="h-4 w-4" />
                  {t('features.amendments.text.branchSelector.branchDiff')}
                </span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${branchDiffOpen ? 'rotate-180' : ''}`}
                />
              </Button>
            </CollapsibleTrigger>
          ) : null}
        </div>
      </div>
      {showBranchDiff ? (
        <CollapsibleContent className="pt-3">
          <VariantDiffPanel
            candidates={branchDiffCandidates}
            title={t('features.amendments.text.branchSelector.branchDiff')}
            badgeLabel={null}
            defaultLeftCandidateId="original-document"
            defaultRightCandidateId={defaultDiffRightCandidateId ?? null}
          />
        </CollapsibleContent>
      ) : null}
    </Collapsible>
  );
}
