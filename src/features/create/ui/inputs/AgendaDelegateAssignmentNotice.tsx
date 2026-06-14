import { BadgeControl } from '@/features/shared/ui/status';

interface AgendaDelegateAssignmentNoticeProps {
  assignmentLabel: string;
  assignmentModeLabel?: string | null;
  seatCount: number;
  seatLabel: string;
  description: string;
  targetTitle: string;
}

export function AgendaDelegateAssignmentNotice({
  assignmentLabel,
  assignmentModeLabel,
  seatCount,
  seatLabel,
  description,
  targetTitle,
}: AgendaDelegateAssignmentNoticeProps) {
  return (
    <div className="bg-muted/30 rounded-2xl border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <BadgeControl variant="outline">{assignmentLabel}</BadgeControl>
        {assignmentModeLabel ? (
          <BadgeControl variant="secondary">{assignmentModeLabel}</BadgeControl>
        ) : null}
        <BadgeControl variant="secondary">
          {seatCount} {seatLabel}
        </BadgeControl>
      </div>
      <p className="text-muted-foreground mt-3 text-sm">
        {description} <strong>{targetTitle}</strong>.
      </p>
    </div>
  );
}
