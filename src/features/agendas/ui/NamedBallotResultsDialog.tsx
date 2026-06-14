'use client';

import { BadgeControl, StatusBadge, type BadgeTone } from '@/features/shared/ui/status';
import { ScrollableDialogContent } from '@/features/shared/ui/dialog';
import { Link } from '@tanstack/react-router';
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/features/shared/ui/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import type { NamedBallotResultsModel } from '@/features/agendas/logic/buildNamedBallotResults';
import { cn } from '@/features/shared/utils/utils';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface NamedBallotResultsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  model: NamedBallotResultsModel | null;
}

function getPhaseLabel(phase: NamedBallotResultsModel['phase']) {
  return phase === 'indicative' ? 'Indicative' : 'Final';
}

function getDecisionBadgeTone(label: string): BadgeTone {
  const normalized = label.trim().toLowerCase();

  if (['accept', 'yes', 'ja', 'approve', 'approved'].includes(normalized)) {
    return 'success';
  }

  if (['reject', 'rejected', 'no', 'nein'].includes(normalized)) {
    return 'destructive';
  }

  if (['abstain', 'abstention', 'enthaltung'].includes(normalized)) {
    return 'neutral';
  }

  return 'outline';
}

function getInitials(name: string) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return initials || 'U';
}

export function NamedBallotResultsDialog({
  open,
  onOpenChange,
  title,
  description,
  model,
}: NamedBallotResultsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ScrollableDialogContent className="flex h-screen w-screen max-w-none flex-col rounded-none border-0 p-0 sm:h-screen sm:max-w-none">
        <DialogHeader separator className="px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </div>

            {model ? (
              <div className="flex flex-wrap items-center justify-end gap-2">
                <BadgeControl variant="secondary">{getPhaseLabel(model.phase)}</BadgeControl>
                <BadgeControl variant="outline">
                  {model.totalRecordedCount}/{model.totalEligibleCount}
                  {translateText('generated.inline.0012_erfasst_27314b65')}
                </BadgeControl>
                {model.totalOfflineAggregatedCount > 0 ? (
                  <BadgeControl variant="outline">
                    {model.totalOfflineAggregatedCount}
                    {translateText('generated.inline.0061_offline_aggregiert_f49dc01b')}
                  </BadgeControl>
                ) : null}
              </div>
            ) : null}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {!model || model.groups.length === 0 ? (
            <div className="text-muted-foreground rounded-2xl border border-dashed p-8 text-center">
              {translateText(
                'generated.inline.0062_keine_namentlichen_ergebnisse_verfuegbar_36c4a21f'
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {model.groups.map(group => (
                <section key={group.key} className="space-y-4 rounded-3xl border p-5">
                  {model.groupedBySourceGroup ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold">{group.label}</h3>
                      <BadgeControl variant="outline">
                        {group.recordedCount}/{group.eligibleCount}
                        {translateText('generated.inline.0012_erfasst_27314b65')}
                      </BadgeControl>
                      {group.offlineAggregatedCount > 0 ? (
                        <BadgeControl variant="outline">
                          {group.offlineAggregatedCount}
                          {translateText('generated.inline.0061_offline_aggregiert_f49dc01b')}
                        </BadgeControl>
                      ) : null}
                      {group.optionSummaries.map(summary => (
                        <StatusBadge
                          key={summary.id}
                          status={summary.label}
                          tone={getDecisionBadgeTone(summary.label)}
                        >
                          {summary.label}: {summary.count}
                        </StatusBadge>
                      ))}
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    {group.rows.map(row => (
                      <div
                        key={row.id}
                        className="bg-muted/20 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3"
                      >
                        {row.userId ? (
                          <Link
                            to="/user/$id"
                            params={{ id: row.userId }}
                            className="flex min-w-0 items-center gap-3 text-left"
                          >
                            <Avatar className="h-9 w-9 shrink-0">
                              <AvatarImage src={row.avatar ?? undefined} alt={row.displayName} />
                              <AvatarFallback>{getInitials(row.displayName)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div
                                className={cn(
                                  'truncate font-medium hover:underline',
                                  row.isStruckThrough && 'text-muted-foreground line-through'
                                )}
                              >
                                {row.displayName}
                              </div>
                              {row.userHandle ? (
                                <div className="text-muted-foreground truncate text-sm">
                                  @{row.userHandle}
                                </div>
                              ) : null}
                            </div>
                          </Link>
                        ) : (
                          <div className="flex min-w-0 items-center gap-3 text-left">
                            <Avatar className="h-9 w-9 shrink-0">
                              <AvatarImage src={row.avatar ?? undefined} alt={row.displayName} />
                              <AvatarFallback>{getInitials(row.displayName)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div
                                className={cn(
                                  'truncate font-medium',
                                  row.isStruckThrough && 'text-muted-foreground line-through'
                                )}
                              >
                                {row.displayName}
                              </div>
                              {row.userHandle ? (
                                <div className="text-muted-foreground truncate text-sm">
                                  @{row.userHandle}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {row.selections.map(selection => (
                            <StatusBadge
                              key={`${row.id}:${selection}`}
                              status={selection}
                              tone={getDecisionBadgeTone(selection)}
                            >
                              {selection}
                            </StatusBadge>
                          ))}
                          {row.selections.length === 0 ? (
                            <BadgeControl
                              variant={
                                row.status === 'offline_aggregated' ? 'outline' : 'secondary'
                              }
                            >
                              {row.statusLabel}
                            </BadgeControl>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </ScrollableDialogContent>
    </Dialog>
  );
}
