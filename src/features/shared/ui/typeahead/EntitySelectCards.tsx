'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card.tsx';
import { Badge } from '@/features/shared/ui/ui/badge.tsx';
import { EditingModeBadge } from '@/features/shared/ui/status/EditingMode';
import {
  getEntityGradientClasses,
  getEntityToneClasses,
  getMotionPreset,
  getRoleToneClasses,
  type EntityTone,
} from '@/features/shared/theme';
import { cn } from '@/features/shared/utils/utils';
import { Calendar, Users, MapPin, Scale, FileText } from 'lucide-react';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import {
  getBranchEditingMode,
  getOrderedBranches,
} from '@/features/amendments/logic/amendmentBranchDisplay';

interface SelectableEvent {
  title?: string | null;
  startDate?: string | number | Date | null;
  location?: string | null;
  group?: { name?: string | null } | null;
}

interface SelectableGroup {
  name?: string | null;
  description?: string | null;
  memberCount?: number | null;
}

interface SelectableAmendment {
  title?: string | null;
  subtitle?: string | null;
  editing_mode?: string | null;
  current_process_run?: {
    branches?:
      | readonly {
          id: string;
          created_at?: number | string | null;
          editing_mode?: string | null;
        }[]
      | null;
  } | null;
}

interface SelectableElection {
  title?: string | null;
  description?: string | null;
  status?: string | null;
}

interface SelectableRole {
  title?: string | null;
  description?: string | null;
  group?: { name?: string | null } | null;
  term?: string | number | null;
}

interface SelectableAmendmentVote {
  title?: string | null;
  description?: string | null;
  status?: string | null;
}

interface SelectableAgendaItem {
  title?: string | null;
  type?: string | null;
  event?: { title?: string | null } | null;
}

function selectCardClassName(tone: EntityTone): string {
  return cn(
    'overflow-hidden',
    getEntityGradientClasses(tone),
    getEntityToneClasses(tone).border,
    getMotionPreset('hoverLift')
  );
}

function entityBadgeClassName(tone: EntityTone): string {
  return cn('flex-shrink-0', getEntityToneClasses(tone).badge);
}

// Event Selection Card
export function EventSelectCard({ event }: { event: SelectableEvent }) {
  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <Card className={selectCardClassName('event')}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{event.title}</CardTitle>
          <Badge variant="outline" className={entityBadgeClassName('event')}>
            <Calendar className="mr-1 h-3 w-3" />
            {translateText('generated.inline.0026_event_ad8919ac')}
          </Badge>
        </div>
        {event.startDate && (
          <CardDescription className="text-xs">
            {formatDate(event.startDate as string | Date)}
          </CardDescription>
        )}
      </CardHeader>
      {(event.location || event.group?.name) && (
        <CardContent className="pt-0">
          <div className="text-muted-foreground space-y-1 text-xs">
            {event.location && (
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                <span className="truncate">{event.location}</span>
              </div>
            )}
            {event.group?.name && (
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                <span className="truncate">{event.group.name}</span>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// Group Selection Card
export function GroupSelectCard({ group }: { group: SelectableGroup }) {
  return (
    <Card className={selectCardClassName('group')}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{group.name}</CardTitle>
          <Badge variant="outline" className={entityBadgeClassName('group')}>
            <Users className="mr-1 h-3 w-3" />
            {translateText('generated.inline.0608_group_171a0606')}
          </Badge>
        </div>
        {group.description && (
          <CardDescription className="line-clamp-2 text-xs">{group.description}</CardDescription>
        )}
      </CardHeader>
      {group.memberCount && (
        <CardContent className="pt-0">
          <div className="text-muted-foreground text-xs">
            {group.memberCount}{' '}
            {translateText('components.labels.members', { count: group.memberCount })}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// Amendment Selection Card
export function AmendmentSelectCard({ amendment }: { amendment: SelectableAmendment }) {
  const firstBranch = getOrderedBranches(amendment.current_process_run?.branches ?? [])[0] ?? null;

  return (
    <Card className={selectCardClassName('amendment')}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{amendment.title}</CardTitle>
          <Badge variant="outline" className={entityBadgeClassName('amendment')}>
            <Scale className="mr-1 h-3 w-3" />
            {translateText('generated.inline.1133_amendment_664ccfae')}
          </Badge>
        </div>
        {amendment.subtitle && (
          <CardDescription className="line-clamp-1 text-xs">{amendment.subtitle}</CardDescription>
        )}
      </CardHeader>
      {firstBranch && (
        <CardContent className="pt-0">
          <EditingModeBadge
            mode={getBranchEditingMode(firstBranch)}
            variant="secondary"
            className="text-xs"
          />
        </CardContent>
      )}
    </Card>
  );
}

// Election Selection Card
export function ElectionSelectCard({ election }: { election: SelectableElection }) {
  return (
    <Card className={selectCardClassName('election')}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{election.title}</CardTitle>
          <Badge variant="outline" className={entityBadgeClassName('election')}>
            {translateText('generated.inline.1052_election_217da2dc')}
          </Badge>
        </div>
        {election.description && (
          <CardDescription className="line-clamp-2 text-xs">{election.description}</CardDescription>
        )}
      </CardHeader>
      {election.status && (
        <CardContent className="pt-0">
          <Badge variant="secondary" className="text-xs">
            {election.status}
          </Badge>
        </CardContent>
      )}
    </Card>
  );
}

// Role Selection Card
export function RoleSelectCard({ role }: { role: SelectableRole }) {
  return (
    <Card className={selectCardClassName('role')}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{role.title}</CardTitle>
          <Badge variant="outline" className={cn('flex-shrink-0', getRoleToneClasses().badge)}>
            {translateText('generated.inline.0091_role_c3f104d1')}
          </Badge>
        </div>
        {role.description && (
          <CardDescription className="line-clamp-2 text-xs">{role.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-muted-foreground flex items-center gap-3 text-xs">
          {role.group?.name && (
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              <span>{role.group.name}</span>
            </div>
          )}
          {role.term && (
            <span>
              {role.term}
              {translateText('generated.inline.0160_months_f1494311')}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Amendment Vote Selection Card (for change requests)
export function AmendmentVoteSelectCard({
  amendmentVote,
}: {
  amendmentVote: SelectableAmendmentVote;
}) {
  return (
    <Card className={selectCardClassName('vote')}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{amendmentVote.title}</CardTitle>
          <Badge variant="outline" className={entityBadgeClassName('vote')}>
            <FileText className="mr-1 h-3 w-3" />
            {translateText('generated.inline.0011_vote_64f87291')}
          </Badge>
        </div>
        {amendmentVote.description && (
          <CardDescription className="line-clamp-2 text-xs">
            {amendmentVote.description}
          </CardDescription>
        )}
      </CardHeader>
      {amendmentVote.status && (
        <CardContent className="pt-0">
          <Badge variant="secondary" className="text-xs">
            {amendmentVote.status}
          </Badge>
        </CardContent>
      )}
    </Card>
  );
}

// Agenda Item Selection Card (for elections/votes)
export function AgendaItemSelectCard({ agendaItem }: { agendaItem: SelectableAgendaItem }) {
  return (
    <Card className={selectCardClassName('agenda_item')}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{agendaItem.title}</CardTitle>
          <Badge variant="outline" className={entityBadgeClassName('agenda_item')}>
            {agendaItem.type}
          </Badge>
        </div>
        {agendaItem.event?.title && (
          <CardDescription className="text-xs">{agendaItem.event.title}</CardDescription>
        )}
      </CardHeader>
    </Card>
  );
}
