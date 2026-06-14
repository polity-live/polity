'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/features/shared/ui/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { Badge } from '@/features/shared/ui/ui/badge';
import { Card, CardContent } from '@/features/shared/ui/ui/card';
import { History, User, Calendar, TrendingUp, UserX, Award, UserCheck, Clock } from 'lucide-react';
import { format, formatDistanceStrict, formatDistanceToNow } from 'date-fns';

import { useGroupRoles as useFacadeGroupRoles } from '@/zero/groups/useGroupState';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

type RoleRow = ReturnType<typeof useFacadeGroupRoles>['roles'][number];

interface RoleHolderHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: RoleRow;
}

interface HolderUserLike {
  id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  handle?: string | null;
  avatar?: string | null;
}

interface PresentHolderRow {
  key: string;
  user: HolderUserLike;
  source: 'history' | 'membership';
  reason: string | null;
  startDate: number | null;
}

interface PastHolderPeriod {
  key: string;
  startDate: number | null;
  endDate: number | null;
  entries: {
    id: string;
    user: HolderUserLike | null | undefined;
    reason: string | null;
  }[];
}

const getReasonIcon = (reason: string) => {
  switch (reason) {
    case 'elected':
      return <Award className="h-4 w-4" />;
    case 'appointed':
      return <UserCheck className="h-4 w-4" />;
    case 'resigned':
      return <UserX className="h-4 w-4" />;
    case 'removed':
      return <UserX className="h-4 w-4" />;
    case 'term_ended':
      return <Clock className="h-4 w-4" />;
    default:
      return <User className="h-4 w-4" />;
  }
};

const getReasonLabel = (reason: string) => {
  switch (reason) {
    case 'elected':
      return 'Elected';
    case 'appointed':
      return 'Appointed';
    case 'resigned':
      return 'Resigned';
    case 'removed':
      return 'Removed';
    case 'term_ended':
      return 'Term Ended';
    default:
      return reason;
  }
};

const getReasonColor = (reason: string) => {
  switch (reason) {
    case 'elected':
      return 'bg-blue-100 text-blue-700 border-blue-300';
    case 'appointed':
      return 'bg-green-100 text-green-700 border-green-300';
    case 'resigned':
      return 'bg-orange-100 text-orange-700 border-orange-300';
    case 'removed':
      return 'bg-red-100 text-red-700 border-red-300';
    case 'term_ended':
      return 'bg-gray-100 text-gray-700 border-gray-300';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-300';
  }
};

export function RoleHolderHistoryDialog({
  open,
  onOpenChange,
  role,
}: RoleHolderHistoryDialogProps) {
  const historyEntries = [...(role?.holder_history || [])].sort(
    (a, b) => (b.start_date ?? 0) - (a.start_date ?? 0)
  );

  const presentHolders = buildPresentHolders(role, historyEntries);
  const pastPeriods = buildPastPeriods(historyEntries);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            {translateText('generated.inline.1058_role_history_c082afdb')}
            {role?.title}
          </DialogTitle>
          <DialogDescription>
            {translateText(
              'generated.inline.1059_current_holders_appear_as_present_while_past__b5cc6629'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {presentHolders.length > 0 ? (
            <div className="space-y-3">
              <h4 className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
                {translateText('generated.inline.1060_present_4e9f7a31')}
              </h4>
              <div className="grid gap-3 md:grid-cols-2">
                {presentHolders.map(entry => {
                  const displayName = getUserDisplayName(entry.user);

                  return (
                    <Card key={entry.key} className="border-primary/20 bg-primary/5 border-2">
                      <CardContent className="pt-4">
                        <div className="flex items-start gap-4">
                          <Avatar className="ring-primary/70 h-12 w-12 ring-2">
                            <AvatarImage src={entry.user.avatar ?? undefined} />
                            <AvatarFallback>{getUserInitials(entry.user)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 space-y-2">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold">{displayName}</span>
                                <Badge className="bg-primary">
                                  {translateText('generated.inline.1060_present_4e9f7a31')}
                                </Badge>
                                {entry.source === 'membership' ? (
                                  <Badge
                                    variant="outline"
                                    className="border-cyan-300 bg-cyan-50 text-cyan-700"
                                  >
                                    {translateText(
                                      'generated.inline.1061_membership_role_8da20220'
                                    )}
                                  </Badge>
                                ) : entry.reason ? (
                                  <Badge variant="outline" className={getReasonColor(entry.reason)}>
                                    <span className="mr-1">{getReasonIcon(entry.reason)}</span>
                                    {getReasonLabel(entry.reason)}
                                  </Badge>
                                ) : null}
                              </div>
                              {entry.user.handle ? (
                                <div className="text-muted-foreground text-sm">
                                  @{entry.user.handle}
                                </div>
                              ) : null}
                            </div>

                            <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
                              <div className="flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5" />
                                <span>
                                  {translateText('generated.inline.1062_since_22a4ed66')}{' '}
                                  {entry.startDate
                                    ? format(new Date(entry.startDate), 'MMM d, yyyy')
                                    : 'N/A'}
                                </span>
                              </div>
                              {entry.startDate ? (
                                <div className="flex items-center gap-1.5">
                                  <TrendingUp className="h-3.5 w-3.5" />
                                  <span>
                                    {formatDistanceToNow(new Date(entry.startDate), {
                                      addSuffix: false,
                                    })}
                                  </span>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ) : null}

          {pastPeriods.length > 0 ? (
            <div className="space-y-3">
              <h4 className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
                {translateText('generated.inline.1063_past_periods_02966b6c')}
              </h4>
              <div className="space-y-4">
                {pastPeriods.map(period => (
                  <Card key={period.key}>
                    <CardContent className="pt-4">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-sm font-semibold">
                            <Calendar className="h-4 w-4" />
                            <span>{formatDateRange(period.startDate, period.endDate)}</span>
                          </div>
                          <div className="text-muted-foreground flex items-center gap-2 text-sm">
                            <Clock className="h-3.5 w-3.5" />
                            <span>{formatPeriodDuration(period.startDate, period.endDate)}</span>
                            <Badge variant="outline">
                              {period.entries.length}
                              {translateText('generated.inline.0134_holders_6f9351dc')}
                            </Badge>
                          </div>
                        </div>

                        <div className="space-y-3">
                          {period.entries.map(entry => (
                            <div
                              key={entry.id}
                              className="border-border/60 flex items-start gap-3 rounded-xl border p-3"
                            >
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={entry.user?.avatar ?? undefined} />
                                <AvatarFallback>{getUserInitials(entry.user)}</AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-medium">
                                    {getUserDisplayName(entry.user)}
                                  </span>
                                  {entry.reason ? (
                                    <Badge
                                      variant="outline"
                                      className={getReasonColor(entry.reason)}
                                    >
                                      <span className="mr-1">{getReasonIcon(entry.reason)}</span>
                                      {getReasonLabel(entry.reason)}
                                    </Badge>
                                  ) : null}
                                </div>
                                {entry.user?.handle ? (
                                  <div className="text-muted-foreground text-sm">
                                    @{entry.user.handle}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : null}

          {presentHolders.length === 0 && pastPeriods.length === 0 ? (
            <div className="py-12 text-center">
              <History className="text-muted-foreground/50 mx-auto h-12 w-12" />
              <p className="text-muted-foreground mt-4">
                {translateText(
                  'generated.inline.1064_no_current_or_past_holders_were_found_for_thi_68816dc1'
                )}
              </p>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function buildPresentHolders(
  role: RoleRow,
  historyEntries: NonNullable<RoleRow['holder_history']>
) {
  const presentRows: PresentHolderRow[] = [];
  const seenUserIds = new Set<string>();

  for (const entry of historyEntries) {
    if (entry.end_date || !entry.user?.id) {
      continue;
    }

    presentRows.push({
      key: `history-${entry.id}`,
      user: entry.user,
      source: 'history',
      reason: entry.reason ?? null,
      startDate: entry.start_date ?? null,
    });
    seenUserIds.add(entry.user.id);
  }

  for (const membershipRole of role.group_membership_roles || []) {
    const membership = membershipRole.group_membership;
    const user = membership?.user;

    if (!user?.id || seenUserIds.has(user.id)) {
      continue;
    }

    presentRows.push({
      key: `membership-${membershipRole.id}`,
      user,
      source: 'membership',
      reason: null,
      startDate: membershipRole.assigned_at ?? membership?.created_at ?? null,
    });
    seenUserIds.add(user.id);
  }

  return presentRows;
}

function buildPastPeriods(historyEntries: NonNullable<RoleRow['holder_history']>) {
  const periods = new Map<string, PastHolderPeriod>();

  for (const entry of historyEntries) {
    if (!entry.end_date) {
      continue;
    }

    const key = `${entry.start_date ?? 'unknown'}-${entry.end_date ?? 'unknown'}`;
    const existingPeriod = periods.get(key);

    if (existingPeriod) {
      existingPeriod.entries.push({
        id: entry.id,
        user: entry.user,
        reason: entry.reason ?? null,
      });
      continue;
    }

    periods.set(key, {
      key,
      startDate: entry.start_date ?? null,
      endDate: entry.end_date ?? null,
      entries: [
        {
          id: entry.id,
          user: entry.user,
          reason: entry.reason ?? null,
        },
      ],
    });
  }

  return [...periods.values()]
    .map(period => ({
      ...period,
      entries: [...period.entries].sort((left, right) =>
        getUserDisplayName(left.user).localeCompare(getUserDisplayName(right.user), undefined, {
          sensitivity: 'base',
        })
      ),
    }))
    .sort(
      (left, right) =>
        (right.endDate ?? right.startDate ?? 0) - (left.endDate ?? left.startDate ?? 0)
    );
}

function formatDateRange(startDate: number | null, endDate: number | null) {
  const formattedStartDate = startDate
    ? format(new Date(startDate), 'MMM d, yyyy')
    : 'Unknown start';
  const formattedEndDate = endDate ? format(new Date(endDate), 'MMM d, yyyy') : 'Present';

  return `${formattedStartDate} -> ${formattedEndDate}`;
}

function formatPeriodDuration(startDate: number | null, endDate: number | null) {
  if (!startDate || !endDate) {
    return 'Duration unavailable';
  }

  return formatDistanceStrict(new Date(startDate), new Date(endDate));
}

function getUserDisplayName(user: HolderUserLike | null | undefined) {
  return [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.handle || 'Unknown';
}

function getUserInitials(user: HolderUserLike | null | undefined) {
  const displayName = getUserDisplayName(user);
  return (
    displayName
      .split(' ')
      .map(part => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'U'
  );
}
