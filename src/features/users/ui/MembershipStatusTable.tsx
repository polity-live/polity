import { Trash2, type LucideIcon } from 'lucide-react';
import { useState } from 'react';

import { getMembershipRoleNames } from '@/features/shared/logic/membershipRoleHelpers';
import { richTextToPlainText } from '@/features/shared/logic/richText';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import type { GroupConflictMembershipPreflight } from '@/features/groups/logic/groupConflictPreflight';
import { SmartLink } from '@/features/shared/ui/navigation/SmartLink.tsx';
import { EntityCell, type ColumnDef } from '@/features/shared/ui/data-table';
import { EntityBadge } from '@/features/shared/ui/status';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { Button } from '@/features/shared/ui/ui/button';
import type { AmendmentCollaboratorsByUserRow } from '@/zero/amendments/queries';
import type { BloggersByUserRow } from '@/zero/blogs/queries';
import type { EventParticipantsByUserRow } from '@/zero/events/queries';
import type { GroupMembershipsByUserRow } from '@/zero/groups/queries';
import type { FilterableRecord } from '../hooks/useUserMembershipsFilters';
import { DangerConfirmDialog } from '@/features/shared/ui/dialog';

type EntityKey = 'group' | 'event' | 'amendment' | 'blog';

/** Minimal display shape shared by group, event, amendment, and blog entities */
interface DisplayEntity {
  id: string;
  name?: string | null;
  title?: string | null;
  description?: unknown;
  image_url?: string | null;
}

const FALLBACK_ROLE_LABELS: Record<EntityKey, string> = {
  group: 'Member',
  event: 'Participant',
  amendment: 'Collaborator',
  blog: 'Writer',
};

interface MembershipStatusTableProps {
  title: string;
  description: string;
  icon: LucideIcon;
  items: FilterableRecord[];
  statusType: 'invited' | 'active' | 'requested';
  entityKey: EntityKey;
  fallbackIcon: LucideIcon;
  onAccept?: (id: string) => void;
  onDecline?: (id: string) => void;
  onLeave?: (id: string) => void;
  onWithdraw?: (id: string) => void;
  getEntityHref?: (entity: DisplayEntity | null, item: FilterableRecord) => string | null;
  getAcceptPreflightInput?: (
    item: FilterableRecord
  ) => GroupConflictMembershipPreflight | null | undefined;
}

import { InvitationActions } from './InvitationActions';
import { MembershipStatusTableView } from './MembershipStatusTableView';
export function MembershipStatusTable({
  title,
  description,
  icon: Icon,
  items,
  statusType,
  entityKey,
  fallbackIcon: FallbackIcon,
  onAccept,
  onDecline,
  onLeave,
  onWithdraw,
  getEntityHref,
  getAcceptPreflightInput,
}: MembershipStatusTableProps) {
  const [pendingAction, setPendingAction] = useState<{
    kind: 'leave' | 'withdraw';
    id: string;
    entityName: string;
  } | null>(null);
  const getEntityTypeLabel = (entityKey: MembershipStatusTableProps['entityKey']): string => {
    const translationKeys = {
      group: 'components.linkPreview.group',
      event: 'components.linkPreview.event',
      amendment: 'components.linkPreview.amendment',
      blog: 'components.linkPreview.blog',
    } as const;

    return translateText(translationKeys[entityKey]);
  };

  const getEntityData = (item: FilterableRecord): DisplayEntity | null => {
    switch (entityKey) {
      case 'group':
        return (item as GroupMembershipsByUserRow).group ?? null;
      case 'event':
        return (item as EventParticipantsByUserRow).event ?? null;
      case 'amendment':
        return (item as AmendmentCollaboratorsByUserRow).amendment ?? null;
      case 'blog':
        return (item as BloggersByUserRow).blog ?? null;
    }
  };

  const getEntityName = (entity: DisplayEntity | null): string => {
    const fallbackName = translateText('pages.user.memberships.sections.unknownEntity', {
      entityType: getEntityTypeLabel(entityKey),
    });
    if (!entity) return fallbackName;
    return entity.name || entity.title || fallbackName;
  };

  const getEntityImage = (entity: DisplayEntity | null): string | undefined => {
    if (!entity) return undefined;
    return entity.image_url ?? undefined;
  };

  const buildDefaultEntityHref = (entity: DisplayEntity | null): string | null => {
    if (!entity?.id) {
      return null;
    }

    switch (entityKey) {
      case 'group':
        return `/group/${entity.id}`;
      case 'event':
        return `/event/${entity.id}`;
      case 'amendment':
        return `/amendment/${entity.id}`;
      case 'blog':
        return null;
    }
  };

  const columns: ColumnDef<FilterableRecord>[] = [
    {
      id: 'entity',
      header: entityKey.charAt(0).toUpperCase() + entityKey.slice(1),
      cell: ({ row }) => {
        const entity = getEntityData(row.original);
        const entityName = getEntityName(entity);
        const entityImage = getEntityImage(entity);
        const entityDescription =
          statusType === 'active' ? richTextToPlainText(entity?.description) : '';
        const entityHref = getEntityHref?.(entity, row.original) ?? buildDefaultEntityHref(entity);
        const content = (
          <EntityCell
            title={entityName}
            description={entityDescription || undefined}
            leading={
              <Avatar className="h-10 w-10">
                {entityImage ? <AvatarImage src={entityImage} alt={entityName} /> : null}
                <AvatarFallback>
                  <FallbackIcon className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
            }
          />
        );

        if (!entityHref) {
          return content;
        }

        return (
          <SmartLink href={entityHref} className="block hover:underline">
            {content}
          </SmartLink>
        );
      },
    },
    {
      id: 'role',
      header: translateText('generated.inline.0091_role_c3f104d1'),
      cell: ({ row }) => {
        const roleNames = getMembershipRoleNames(row.original);
        const displayRoleNames =
          roleNames.length > 0 ? roleNames : [FALLBACK_ROLE_LABELS[entityKey]];

        return (
          <div className="flex flex-wrap gap-2">
            {displayRoleNames.map((roleName, index) => (
              <EntityBadge key={`${row.original.id}-${roleName}-${index}`} tone="accent">
                {roleName}
              </EntityBadge>
            ))}
          </div>
        );
      },
    },
    {
      id: 'created',
      header:
        statusType === 'invited'
          ? translateText('generated.inline.0146_invited_53469df1')
          : statusType === 'requested'
            ? translateText('generated.inline.0147_requested_c26bf60f')
            : translateText('generated.inline.0148_joined_43a1c626'),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.created_at
            ? new Date(row.original.created_at).toLocaleDateString()
            : translateText('components.membershipTables.notAvailable')}
        </span>
      ),
    },
    {
      id: 'actions',
      header: translateText('generated.inline.0093_actions_c3cd636a'),
      meta: {
        headerClassName: 'text-right',
        cellClassName: 'text-right',
      },
      cell: ({ row }) => (
        <>
          {statusType === 'invited' ? (
            <InvitationActions
              item={row.original}
              onAccept={onAccept}
              onDecline={onDecline}
              getAcceptPreflightInput={getAcceptPreflightInput}
            />
          ) : null}
          {statusType === 'active' ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setPendingAction({
                  kind: 'leave',
                  id: row.original.id,
                  entityName: getEntityName(getEntityData(row.original)),
                })
              }
            >
              <Trash2 className="h-4 w-4" />
              <span className="ml-2">{translateText('generated.inline.1197_leave_7e3520a9')}</span>
            </Button>
          ) : null}
          {statusType === 'requested' ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setPendingAction({
                  kind: 'withdraw',
                  id: row.original.id,
                  entityName: getEntityName(getEntityData(row.original)),
                })
              }
            >
              <Trash2 className="h-4 w-4" />
              <span className="ml-2">
                {translateText('generated.inline.1198_withdraw_request_898cc3e4')}
              </span>
            </Button>
          ) : null}
        </>
      ),
    },
  ];
  return (
    <>
      <MembershipStatusTableView
        title={title}
        description={description}
        Icon={Icon}
        items={items}
        statusType={statusType}
        entityKey={entityKey}
        FallbackIcon={FallbackIcon}
        onAccept={onAccept}
        onDecline={onDecline}
        onLeave={onLeave}
        onWithdraw={onWithdraw}
        getEntityHref={getEntityHref}
        getAcceptPreflightInput={getAcceptPreflightInput}
        getEntityData={getEntityData}
        getEntityName={getEntityName}
        getEntityImage={getEntityImage}
        buildDefaultEntityHref={buildDefaultEntityHref}
        columns={columns}
      />
      <DangerConfirmDialog
        open={pendingAction !== null}
        onOpenChange={open => {
          if (!open) setPendingAction(null);
        }}
        title={translateText(
          pendingAction?.kind === 'withdraw'
            ? 'pages.user.memberships.confirmations.withdrawTitle'
            : 'pages.user.memberships.confirmations.leaveTitle'
        )}
        description={translateText(
          pendingAction?.kind === 'withdraw'
            ? 'pages.user.memberships.confirmations.withdrawDescription'
            : 'pages.user.memberships.confirmations.leaveDescription',
          { name: pendingAction?.entityName ?? '' }
        )}
        cancelLabel={translateText('common.actions.cancel')}
        confirmLabel={translateText(
          pendingAction?.kind === 'withdraw'
            ? 'pages.user.memberships.confirmations.withdrawConfirm'
            : 'pages.user.memberships.confirmations.leaveConfirm'
        )}
        onConfirm={() => {
          if (!pendingAction) return;
          if (pendingAction.kind === 'withdraw') {
            onWithdraw?.(pendingAction.id);
          } else {
            onLeave?.(pendingAction.id);
          }
          setPendingAction(null);
        }}
      />
    </>
  );
}
