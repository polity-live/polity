import { useMemo } from 'react';
import { Trash2, User } from 'lucide-react';
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
import { SmartLink } from '@/features/shared/ui/navigation/SmartLink.tsx';
import { DataTable } from '@/features/shared/ui/data-table';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface SubscriberUser {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  avatar?: string | null;
}

interface SubscriberRow {
  id: string;
  created_at?: string | number | Date | null;
  subscriber_user?: SubscriberUser | null;
}

interface SubscriberTableRow {
  subscription: SubscriberRow;
  subscriber: SubscriberUser;
}

interface SubscribersTableProps {
  subscribers: SubscriberRow[];
  onRemove: (id: string) => void;
}

export function SubscribersTable({ subscribers, onRemove }: SubscribersTableProps) {
  const rows = useMemo<SubscriberTableRow[]>(
    () =>
      subscribers.flatMap(subscription =>
        subscription.subscriber_user
          ? [{ subscription, subscriber: subscription.subscriber_user }]
          : []
      ),
    [subscribers]
  );

  const columns = useMemo<ColumnDef<SubscriberTableRow>[]>(
    () => [
      {
        accessorKey: 'subscriber.id',
        header: translateText('generated.inline.0090_user_9f8a2389'),
        cell: ({ row }) => {
          const { subscriber } = row.original;
          const name =
            [subscriber.first_name, subscriber.last_name].filter(Boolean).join(' ') ||
            translateText('features.payments.subscriptions.unknown.user');

          return (
            <SmartLink
              data-action-id="payments.subscribers.user.open"
              href={`/user/${subscriber.id}`}
              className="flex items-center gap-3 hover:underline"
            >
              <Avatar className="h-10 w-10">
                {subscriber.avatar ? <AvatarImage src={subscriber.avatar} alt={name} /> : null}
                <AvatarFallback>
                  <User className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium">{name}</div>
              </div>
            </SmartLink>
          );
        },
      },
      {
        accessorKey: 'subscription.created_at',
        header: translateText('generated.inline.0983_subscribed_dd1242a8'),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.subscription.created_at
              ? new Date(row.original.subscription.created_at).toLocaleDateString()
              : translateText('features.payments.subscriptions.notAvailable')}
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
              data-action-id="payments.subscribers.remove"
              variant="ghost"
              size="sm"
              onClick={() => onRemove(row.original.subscription.id)}
            >
              <Trash2 className="h-4 w-4" />
              <span className="ml-2">{translateText('generated.inline.0096_remove_e963907d')}</span>
            </Button>
          </div>
        ),
        enableSorting: false,
      },
    ],
    [onRemove]
  );

  const isEmpty = rows.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {isEmpty
            ? translateText('generated.inline.0979_my_subscribers_7c714699')
            : `${translateText('generated.inline.0982_my_subscribers_0a36629c')}${rows.length})`}
        </CardTitle>
        <CardDescription>
          {translateText('generated.inline.0980_users_subscribed_to_you_d0af94ce')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={rows}
          getRowId={row => row.subscription.id}
          emptyTitle={translateText(
            'generated.inline.0981_no_subscribers_yet_when_users_subscribe_to_yo_922ce2bb'
          )}
          enablePagination={false}
        />
      </CardContent>
    </Card>
  );
}

export type { SubscriberRow };
