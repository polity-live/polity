'use client';

import { Badge } from '@/features/shared/ui/ui/badge';
import { EditingModeBadge } from '@/features/shared/ui/ui/editing-mode.tsx';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import {
  TimelineCardBadge,
  TimelineCardBase,
  TimelineCardContent,
  TimelineCardHeader,
  TimelineCardStats,
} from '@/features/timeline/ui/cards/TimelineCardBase';
import { Building2, GitPullRequest, ScrollText, Users } from 'lucide-react';

interface AgendaRelatedAmendment {
  readonly id: string;
  title?: string | null;
  reason?: string | null;
  status?: string | null;
  editing_mode?: string | null;
  image_url?: string | null;
  upvotes?: number | null;
  downvotes?: number | null;
  collaborator_count?: number | null;
  change_requests?: readonly { readonly id: string }[] | null;
  group?: {
    readonly id: string;
    readonly name?: string | null;
  } | null;
}

interface AgendaRelatedRole {
  readonly id: string;
  title?: string | null;
  description?: string | null;
  term?: string | null;
  group?: {
    readonly id: string;
    readonly name?: string | null;
  } | null;
}

function hasText(value?: string | null): value is string {
  return Boolean(value && value.trim());
}

export function AgendaRelatedAmendmentCard({
  amendment,
  className,
}: {
  amendment: AgendaRelatedAmendment;
  className?: string;
}) {
  const { t } = useTranslation();
  const title = hasText(amendment.title)
    ? amendment.title
    : t('features.timeline.contentTypes.amendment');
  const supportCount = (amendment.upvotes ?? 0) - (amendment.downvotes ?? 0);
  const stats = [
    ...(amendment.collaborator_count && amendment.collaborator_count > 0
      ? [
          {
            icon: Users,
            label: t('features.timeline.cards.amendment.collaborators', 'collaborators'),
            value: amendment.collaborator_count,
          },
        ]
      : []),
    ...(amendment.change_requests && amendment.change_requests.length > 0
      ? [
          {
            icon: GitPullRequest,
            label: t('features.timeline.cards.amendment.changeRequests'),
            value: amendment.change_requests.length,
          },
        ]
      : []),
    ...(supportCount !== 0
      ? [
          {
            icon: ScrollText,
            label: t('features.timeline.cards.support', 'support'),
            value: supportCount,
          },
        ]
      : []),
  ];
  const groupName = amendment.group?.name?.trim() || undefined;

  return (
    <TimelineCardBase
      contentType="amendment"
      href={`/amendment/${amendment.id}`}
      className={className}
    >
      <TimelineCardHeader
        contentType="amendment"
        title={title}
        href={`/amendment/${amendment.id}`}
        subtitle={groupName}
        subtitleHref={amendment.group?.id ? `/group/${amendment.group.id}` : undefined}
        badge={
          <TimelineCardBadge
            label={t('features.timeline.contentTypes.amendment')}
            icon={ScrollText}
          />
        }
      >
        {amendment.editing_mode && (
          <div className="mt-2 flex flex-wrap gap-2">
            <EditingModeBadge mode={amendment.editing_mode} variant="secondary" />
          </div>
        )}
      </TimelineCardHeader>

      <TimelineCardContent className="space-y-3">
        {hasText(amendment.reason) && (
          <p className="text-muted-foreground line-clamp-3 text-sm">{amendment.reason}</p>
        )}
        {stats.length > 0 && <TimelineCardStats stats={stats} />}
      </TimelineCardContent>
    </TimelineCardBase>
  );
}

export function AgendaRelatedRoleCard({
  role,
  className,
}: {
  role: AgendaRelatedRole;
  className?: string;
}) {
  const { t } = useTranslation();
  const title = hasText(role.title) ? role.title : t('features.events.agenda.role');
  const groupName = role.group?.name?.trim() || undefined;

  return (
    <TimelineCardBase contentType="election" className={className}>
      <TimelineCardHeader
        contentType="election"
        title={title}
        subtitle={groupName}
        subtitleHref={role.group?.id ? `/group/${role.group.id}` : undefined}
        badge={<TimelineCardBadge label={t('features.events.agenda.role')} icon={Building2} />}
      >
        {hasText(role.term) && (
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="secondary" className="text-xs">
              {role.term}
            </Badge>
          </div>
        )}
      </TimelineCardHeader>

      <TimelineCardContent>
        {hasText(role.description) ? (
          <p className="text-muted-foreground line-clamp-3 text-sm">{role.description}</p>
        ) : (
          <p className="text-muted-foreground text-sm">
            {t('features.events.agenda.electionFor')} {title}
          </p>
        )}
      </TimelineCardContent>
    </TimelineCardBase>
  );
}
