import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/features/shared/ui/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { TableTag } from '@/features/shared/ui/ui/table-tag';
import { SmartLink } from '@/features/shared/ui/navigation/SmartLink.tsx';
import { Check, X, Trash2, LucideIcon } from 'lucide-react';
import { richTextToPlainText } from '@/features/shared/logic/richText';
import type { FilterableRecord } from '../hooks/useUserMembershipsFilters';
import type { GroupMembershipsByUserRow } from '@/zero/groups/queries';
import type { EventParticipantsByUserRow } from '@/zero/events/queries';
import type { AmendmentCollaboratorsByUserRow } from '@/zero/amendments/queries';
import type { BloggersByUserRow } from '@/zero/blogs/queries';
import { useGroupConflictPreflight } from '@/features/groups/hooks/useGroupConflictPreflight';
import type { GroupConflictMembershipPreflight } from '@/features/groups/logic/groupConflictPreflight';
import { GroupConflictDialog } from '@/features/groups/ui/GroupConflictPanel';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

type EntityKey = 'group' | 'event' | 'amendment' | 'blog';

/** Minimal display shape shared by group, event, amendment, and blog entities */
interface DisplayEntity {
  id: string;
  name?: string | null;
  title?: string | null;
  description?: unknown;
  image_url?: string | null;
}

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

function InvitationActions({
  item,
  onAccept,
  onDecline,
  getAcceptPreflightInput,
}: {
  item: FilterableRecord;
  onAccept?: (id: string) => void;
  onDecline?: (id: string) => void;
  getAcceptPreflightInput?: (
    membership: FilterableRecord
  ) => GroupConflictMembershipPreflight | null | undefined;
}) {
  const preflightInput = getAcceptPreflightInput?.(item) ?? null;
  const { response, blocking } = useGroupConflictPreflight(preflightInput, {
    enabled: Boolean(preflightInput),
  });

  return (
    <div className="flex justify-end gap-2">
      <Button variant="default" size="sm" disabled={blocking} onClick={() => onAccept?.(item.id)}>
        <Check className="mr-1 h-4 w-4" />
        {translateText('generated.inline.0121_accept_bb54db51')}
      </Button>
      {blocking ? (
        <GroupConflictDialog
          response={response}
          triggerLabel={translateText('generated.inline.0693_warum_194dad5c')}
          triggerVariant="ghost"
          title={translateText('generated.inline.1195_warum_ist_diese_annahme_blockiert_1fd1c7d1')}
        />
      ) : null}
      <Button variant="outline" size="sm" onClick={() => onDecline?.(item.id)}>
        <X className="mr-1 h-4 w-4" />
        {translateText('generated.inline.0122_decline_b59cf9ed')}
      </Button>
    </div>
  );
}

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
  if (items.length === 0 && statusType === 'active') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground py-8 text-center">
            {translateText('generated.inline.0609_no_816c52fd')}
            {statusType}
            {translateText('generated.inline.1196_items_found_b7242dc8')}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return null;
  }

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
    if (!entity) return `Unknown ${entityKey}`;
    return entity.name || entity.title || `Unknown ${entityKey}`;
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{entityKey.charAt(0).toUpperCase() + entityKey.slice(1)}</TableHead>
              {statusType === 'active' && (
                <TableHead>{translateText('generated.inline.0091_role_c3f104d1')}</TableHead>
              )}
              {statusType === 'invited' && (
                <TableHead>{translateText('generated.inline.0091_role_c3f104d1')}</TableHead>
              )}
              {statusType === 'requested' && (
                <TableHead>{translateText('generated.inline.0091_role_c3f104d1')}</TableHead>
              )}
              <TableHead>
                {statusType === 'invited'
                  ? translateText('generated.inline.0146_invited_53469df1')
                  : statusType === 'requested'
                    ? translateText('generated.inline.0147_requested_c26bf60f')
                    : translateText('generated.inline.0148_joined_43a1c626')}
              </TableHead>
              <TableHead className="text-right">
                {translateText('generated.inline.0093_actions_c3cd636a')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(item => {
              const entity = getEntityData(item);
              const entityName = getEntityName(entity);
              const entityImage = getEntityImage(entity);
              const role = (item as { role?: { name?: string | null } }).role?.name || 'Member';
              const createdAt = item.created_at
                ? new Date(item.created_at).toLocaleDateString()
                : 'N/A';
              const entityDescription =
                statusType === translateText('generated.inline.0045_active_2bb6b986')
                  ? richTextToPlainText(entity?.description)
                  : '';
              const entityHref = getEntityHref?.(entity, item) ?? buildDefaultEntityHref(entity);
              const entityContent = (
                <>
                  <Avatar className="h-10 w-10">
                    {entityImage && <AvatarImage src={entityImage} alt={entityName} />}
                    <AvatarFallback>
                      <FallbackIcon className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{entityName}</div>
                    {entityDescription && (
                      <div className="text-muted-foreground line-clamp-1 text-sm">
                        {entityDescription}
                      </div>
                    )}
                  </div>
                </>
              );

              return (
                <TableRow key={item.id}>
                  <TableCell>
                    {entityHref ? (
                      <SmartLink
                        href={entityHref}
                        className="flex items-center gap-3 hover:underline"
                      >
                        {entityContent}
                      </SmartLink>
                    ) : (
                      <div className="flex items-center gap-3">{entityContent}</div>
                    )}
                  </TableCell>
                  {(statusType === 'active' ||
                    statusType === 'invited' ||
                    statusType === 'requested') && (
                    <TableCell>
                      <TableTag entityType={entityKey}>{role}</TableTag>
                    </TableCell>
                  )}
                  <TableCell className="text-muted-foreground">{createdAt}</TableCell>
                  <TableCell className="text-right">
                    {statusType === 'invited' && (
                      <InvitationActions
                        item={item}
                        onAccept={onAccept}
                        onDecline={onDecline}
                        getAcceptPreflightInput={getAcceptPreflightInput}
                      />
                    )}
                    {statusType === 'active' && (
                      <Button variant="ghost" size="sm" onClick={() => onLeave?.(item.id)}>
                        <Trash2 className="h-4 w-4" />
                        <span className="ml-2">
                          {translateText('generated.inline.1197_leave_7e3520a9')}
                        </span>
                      </Button>
                    )}
                    {statusType === 'requested' && (
                      <Button variant="ghost" size="sm" onClick={() => onWithdraw?.(item.id)}>
                        <Trash2 className="h-4 w-4" />
                        <span className="ml-2">
                          {translateText('generated.inline.1198_withdraw_request_898cc3e4')}
                        </span>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
