'use client';

import { Link } from '@tanstack/react-router';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/features/shared/ui/ui/dialog';
import { Badge } from '@/features/shared/ui/ui/badge';
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

function getDecisionBadgeClassName(label: string) {
  const normalized = label.trim().toLowerCase();

  if (['accept', 'yes', 'ja', 'approve', 'approved'].includes(normalized)) {
    return 'border-green-200 bg-green-100 text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-200';
  }

  if (['reject', 'rejected', 'no', 'nein'].includes(normalized)) {
    return 'border-red-200 bg-red-100 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200';
  }

  if (['abstain', 'abstention', 'enthaltung'].includes(normalized)) {
    return 'border-gray-200 bg-gray-100 text-gray-800 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200';
  }

  return '';
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
      <DialogContent className="flex h-screen w-screen max-w-none flex-col rounded-none border-0 p-0 sm:h-screen sm:max-w-none">
        <DialogHeader className="border-b px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </div>

            {model ? (
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Badge variant="secondary">{getPhaseLabel(model.phase)}</Badge>
                <Badge variant="outline">
                  {model.totalRecordedCount}/{model.totalEligibleCount}
                  {translateText('generated.inline.0012_erfasst_27314b65')}
                </Badge>
                {model.totalOfflineAggregatedCount > 0 ? (
                  <Badge variant="outline">
                    {model.totalOfflineAggregatedCount}
                    {translateText('generated.inline.0061_offline_aggregiert_f49dc01b')}
                  </Badge>
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
                      <Badge variant="outline">
                        {group.recordedCount}/{group.eligibleCount}
                        {translateText('generated.inline.0012_erfasst_27314b65')}
                      </Badge>
                      {group.offlineAggregatedCount > 0 ? (
                        <Badge variant="outline">
                          {group.offlineAggregatedCount}
                          {translateText('generated.inline.0061_offline_aggregiert_f49dc01b')}
                        </Badge>
                      ) : null}
                      {group.optionSummaries.map(summary => (
                        <Badge
                          key={summary.id}
                          variant="outline"
                          className={getDecisionBadgeClassName(summary.label)}
                        >
                          {summary.label}: {summary.count}
                        </Badge>
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
                            <Badge
                              key={`${row.id}:${selection}`}
                              variant="outline"
                              className={getDecisionBadgeClassName(selection)}
                            >
                              {selection}
                            </Badge>
                          ))}
                          {row.selections.length === 0 ? (
                            <Badge
                              variant={
                                row.status === 'offline_aggregated' ? 'outline' : 'secondary'
                              }
                            >
                              {row.statusLabel}
                            </Badge>
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
      </DialogContent>
    </Dialog>
  );
}
