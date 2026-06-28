import { SummaryPillList } from '@/features/shared/ui/form';
import { SectionSkeleton } from '@/features/shared/ui/feedback';
import {
  TargetGroupEventDisplay,
  TargetGroupEventSelector,
  type TargetGroupEventSelection,
} from '@/features/amendments/ui/TargetGroupEventSelector';
import type { PathWithEventSegment } from '@/features/amendments/logic/amendmentPathHelpers';

interface AmendmentTargetSelection {
  sourceGroupId: string;
  groupId: string;
  groupData: {
    id: string;
    name?: string | null;
    description?: string | null;
    member_count?: number | null;
    event_count?: number | null;
    amendment_count?: number | null;
  };
  eventId: string | null;
  eventData: {
    id: string;
    title?: string | null;
    start_date?: number | null;
    location_name?: string | null;
    description?: string | null;
    participant_count?: number | null;
  } | null;
  pathWithEvents: PathWithEventSegment[];
  missingEventSteps: PathWithEventSegment[];
}

type AmendmentPathMode = 'hierarchy' | 'workflow';

export function AmendmentTargetSelectionField({
  hint,
  loadingLabel,
  userId,
  targetSelection,
  sourceGroupIdParam,
  targetGroupIdParam,
  pathMode,
  workflowId,
  openEventStepsLabel,
  missingEventStepsDescription,
  onSourceGroupSelectionChange,
  onGroupSelectionChange,
  onPathModeChange,
  onWorkflowSelectionChange,
  onSelect,
}: {
  hint: string;
  loadingLabel: string;
  userId?: string;
  targetSelection: AmendmentTargetSelection | null;
  sourceGroupIdParam: string;
  targetGroupIdParam: string;
  pathMode: AmendmentPathMode;
  workflowId?: string;
  openEventStepsLabel: string;
  missingEventStepsDescription: string;
  onSourceGroupSelectionChange: (groupId: string | null) => void;
  onGroupSelectionChange: (groupId: string | null) => void;
  onPathModeChange: (mode: AmendmentPathMode) => void;
  onWorkflowSelectionChange: (workflowId: string | null) => void;
  onSelect: (selection: TargetGroupEventSelection | null) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-xs">{hint}</p>
      {userId ? (
        <TargetGroupEventSelector
          userId={userId}
          allowGroupWithoutEvent
          allowSourceGroupAsTarget
          layoutScope="create-amendment"
          onSourceGroupSelectionChange={onSourceGroupSelectionChange}
          onGroupSelectionChange={onGroupSelectionChange}
          onPathModeChange={onPathModeChange}
          onWorkflowSelectionChange={onWorkflowSelectionChange}
          onSelect={onSelect}
          selectedSourceGroupId={targetSelection?.sourceGroupId ?? sourceGroupIdParam}
          selectedGroupId={targetSelection?.groupId ?? targetGroupIdParam}
          selectedEventId={targetSelection?.eventId ?? undefined}
          selectedPathMode={pathMode}
          selectedWorkflowId={workflowId || undefined}
        />
      ) : (
        <SectionSkeleton rows={2} density="compact" label={loadingLabel} />
      )}

      {targetSelection ? (
        <div className="space-y-3">
          <TargetGroupEventDisplay
            groupData={targetSelection.groupData}
            eventData={targetSelection.eventData}
            pathWithEvents={targetSelection.pathWithEvents}
          />
          {targetSelection.missingEventSteps.length > 0 ? (
            <div className="rounded-md border border-dashed p-3 text-sm">
              <p className="font-medium">{openEventStepsLabel}</p>
              <p className="text-muted-foreground mt-1">{missingEventStepsDescription}</p>
              <SummaryPillList
                items={targetSelection.missingEventSteps.map(step => step.groupName)}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
