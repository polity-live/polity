import { useMemo } from 'react';
import type { LucideIcon } from 'lucide-react';
import { BookOpen, Calendar, Scale, Trash2, User, Users } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { EntityBadge, getEntityBadgeSurfaceClassName } from '@/features/shared/ui/status';
import { SmartLink } from '@/features/shared/ui/navigation/SmartLink.tsx';
import { DataTable } from '@/features/shared/ui/data-table';
import type { SearchCardGradientEntity } from '@/features/shared/utils/search-card-gradients';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface SubscriptionUser {
  id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  avatar?: string | null;
}

interface SubscriptionEntity {
  id?: string | null;
  name?: string | null;
  title?: string | null;
  image_url?: string | null;
  group_id?: string | null;
}

interface SubscriptionRow {
  id: string;
  created_at?: string | number | Date | null;
  user?: SubscriptionUser | null;
  group?: SubscriptionEntity | null;
  amendment?: SubscriptionEntity | null;
  event?: SubscriptionEntity | null;
  blog?: SubscriptionEntity | null;
}

interface SubscriptionEntityInfo {
  name: string;
  type: string;
  icon: LucideIcon;
  avatar?: string | null;
  entityType: SearchCardGradientEntity;
}

interface SubscriptionTableRow {
  subscription: SubscriptionRow;
  entityInfo: SubscriptionEntityInfo;
  entityHref: string | null;
}

interface SubscriptionsTableProps {
  subscriptions: SubscriptionRow[];
  onUnsubscribe: (id: string) => void;
  getSubscriptionHref: (subscription: SubscriptionRow) => string | null;
  emptyMessage?: string;
}

function getEntityInfo(subscription: SubscriptionRow): SubscriptionEntityInfo | null {
  if (subscription.user) {
    const user = subscription.user;

    return {
      name: [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Unknown User',
      type: 'User',
      icon: User,
      avatar: user.avatar,
      entityType: 'user',
    };
  }

  if (subscription.group) {
    return {
      name: subscription.group.name || 'Unknown Group',
      type: 'Group',
      icon: Users,
      avatar: subscription.group.image_url,
      entityType: 'group',
    };
  }

  if (subscription.amendment) {
    return {
      name: subscription.amendment.title || 'Unknown Amendment',
      type: 'Amendment',
      icon: Scale,
      avatar: subscription.amendment.image_url,
      entityType: 'amendment',
    };
  }

  if (subscription.event) {
    return {
      name: subscription.event.title || 'Unknown Event',
      type: 'Event',
      icon: Calendar,
      avatar: subscription.event.image_url,
      entityType: 'event',
    };
  }

  if (subscription.blog) {
    return {
      name: subscription.blog.title || 'Unknown Blog',
      type: 'Blog',
      icon: BookOpen,
      avatar: subscription.blog.image_url,
      entityType: 'blog',
    };
  }

  return null;
}

export function SubscriptionsTable({
  subscriptions,
  onUnsubscribe,
  getSubscriptionHref,
  emptyMessage,
}: SubscriptionsTableProps) {
  const rows = useMemo<SubscriptionTableRow[]>(
    () =>
      subscriptions.flatMap(subscription => {
        const entityInfo = getEntityInfo(subscription);

        if (!entityInfo) return [];

        return [
          {
            subscription,
            entityInfo,
            entityHref: getSubscriptionHref(subscription),
          },
        ];
      }),
    [getSubscriptionHref, subscriptions]
  );

  const columns = useMemo<ColumnDef<SubscriptionTableRow>[]>(
    () => [
      {
        accessorKey: 'entityInfo.name',
        header: translateText('generated.inline.1000_name_709a2322'),
        cell: ({ row }) => {
          const { avatar, icon: Icon, name } = row.original.entityInfo;
          const nameCellContent = (
            <>
              <Avatar className="h-10 w-10">
                {avatar ? <AvatarImage src={avatar} alt={name} /> : null}
                <AvatarFallback>
                  <Icon className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium">{name}</div>
              </div>
            </>
          );

          if (!row.original.entityHref) {
            return <div className="flex items-center gap-3">{nameCellContent}</div>;
          }

          return (
            <SmartLink
              href={row.original.entityHref}
              className="flex items-center gap-3 hover:underline"
            >
              {nameCellContent}
            </SmartLink>
          );
        },
      },
      {
        accessorKey: 'entityInfo.type',
        header: translateText('generated.inline.0599_type_3deb7456'),
        cell: ({ row }) => (
          <EntityBadge
            tone="outline"
            className={getEntityBadgeSurfaceClassName(row.original.entityInfo.entityType)}
          >
            {row.original.entityInfo.type}
          </EntityBadge>
        ),
      },
      {
        accessorKey: 'subscription.created_at',
        header: translateText('generated.inline.0983_subscribed_dd1242a8'),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.subscription.created_at
              ? new Date(row.original.subscription.created_at).toLocaleDateString()
              : 'N/A'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: () => (
          <span className="block text-right">
            {translateText('generated.inline.0093_actions_c3cd636a')}
          </span>
        ),
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onUnsubscribe(row.original.subscription.id)}
            >
              <Trash2 className="h-4 w-4" />
              <span className="ml-2">
                {translateText('generated.inline.0169_unsubscribe_834cc0ee')}
              </span>
            </Button>
          </div>
        ),
        enableSorting: false,
      },
    ],
    [onUnsubscribe]
  );

  const isEmpty = rows.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {isEmpty
            ? translateText('generated.inline.0997_my_subscriptions_075a188d')
            : `${translateText('generated.inline.0999_my_subscriptions_a1f3e400')}${rows.length})`}
        </CardTitle>
        <CardDescription>
          {translateText('generated.inline.0998_entities_you_re_subscribed_to_409792e3')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={rows}
          getRowId={row => row.subscription.id}
          emptyTitle={
            emptyMessage ||
            translateText(
              'generated.inline.0129_no_subscriptions_found_start_following_users__12823014'
            )
          }
          enablePagination={false}
        />
      </CardContent>
    </Card>
  );
}

export type { SubscriptionRow };
