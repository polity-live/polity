import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { Button } from '@/features/shared/ui/ui/button';
import { InlineNotice } from '@/features/shared/ui/feedback';
import { ManagementSection } from '@/features/shared/ui/form';
import { CountBadge, EntityBadge, type BadgeTone } from '@/features/shared/ui/status';
import {
  DataTable,
  UserTableCell,
  TableActionIconButton,
  type ColumnDef,
} from '@/features/shared/ui/data-table';
import { Mail, RotateCw, Trash2 } from 'lucide-react';
import { RoleTag } from './RoleTag';
import {
  emailInvitationRequest,
  EmailInvitationApiError,
} from '../hooks/useEmailInvitationComposer';
import type { EmailInvitationRow, InvitationDeliveryStatus } from '../logic/emailInvitations';

const invitationTones: Record<EmailInvitationRow['state'], BadgeTone> = {
  pending: 'info',
  accepted: 'success',
  revoked: 'neutral',
  expired: 'warning',
};
const deliveryTones: Record<InvitationDeliveryStatus, BadgeTone> = {
  sending: 'info',
  sent: 'success',
  delivered: 'success',
  bounced: 'danger',
  complained: 'danger',
  failed: 'danger',
  unknown: 'warning',
};

export function GroupEmailInvitationsPanel({ groupId }: { groupId: string }) {
  const { t, language } = useTranslation();
  const prefix = 'features.groups.emailInvitations';
  const [data, setData] = useState<{ invitations: EmailInvitationRow[] } | null>(null);
  const [error, setError] = useState('');
  const [available, setAvailable] = useState<number | undefined>();
  const [busy, setBusy] = useState(false);
  const url = `/api/groups/${groupId}/email-invitations`;
  const load = useCallback(async () => {
    try {
      setData(await emailInvitationRequest(url));
      setError('');
    } catch (failure) {
      setError(failure instanceof EmailInvitationApiError ? failure.code : 'server_error');
      setAvailable(failure instanceof EmailInvitationApiError ? failure.available : undefined);
    }
  }, [url]);
  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener('polity-email-invitations-changed', refresh);
    const timer = setInterval(refresh, 30_000);
    return () => {
      window.removeEventListener('polity-email-invitations-changed', refresh);
      clearInterval(timer);
    };
  }, [load]);
  async function act(action: 'resend' | 'revoke', invitationId: string) {
    setBusy(true);
    try {
      await emailInvitationRequest(url, {
        action,
        invitationId,
        idempotencyKey: crypto.randomUUID(),
      });
      await load();
    } catch (failure) {
      setError(failure instanceof EmailInvitationApiError ? failure.code : 'server_error');
      setAvailable(failure instanceof EmailInvitationApiError ? failure.available : undefined);
    } finally {
      setBusy(false);
    }
  }
  const columns: ColumnDef<EmailInvitationRow>[] = [
    {
      id: 'recipient',
      header: t(`${prefix}.recipient`),
      cell: ({ row }) => {
        const person = row.original;
        const name = [person.first_name, person.last_name].filter(Boolean).join(' ');
        return (
          <UserTableCell
            displayName={name || person.email}
            secondaryLabel={name ? person.email : undefined}
          />
        );
      },
    },
    {
      id: 'roles',
      header: t(`${prefix}.roles`),
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-2">
          {row.original.role_names.map((name, index) => (
            <RoleTag key={`${name}-${index}`} roleName={name} />
          ))}
        </div>
      ),
    },
    {
      id: 'expiry',
      header: t(`${prefix}.expiry`),
      cell: ({ row }) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {row.original.expires_at
            ? new Date(row.original.expires_at).toLocaleDateString(
                language === 'de' ? 'de-DE' : 'en-GB'
              )
            : '—'}
        </span>
      ),
    },
    {
      id: 'state',
      header: t(`${prefix}.state`),
      cell: ({ row }) => (
        <EntityBadge tone={invitationTones[row.original.state]}>
          {t(`${prefix}.states.${row.original.state}`)}
        </EntityBadge>
      ),
    },
    {
      id: 'delivery',
      header: t(`${prefix}.delivery`),
      cell: ({ row }) => (
        <EntityBadge tone={deliveryTones[row.original.delivery_status]}>
          {t(`${prefix}.results.${row.original.delivery_status}`)}
        </EntityBadge>
      ),
    },
    {
      id: 'actions',
      header: t(`${prefix}.actions`),
      meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
      cell: ({ row }) => {
        const item = row.original;
        if (!['pending', 'expired'].includes(item.state)) return null;
        const coolingDown =
          !!item.last_attempt_at && Date.now() - Date.parse(item.last_attempt_at) < 600_000;
        return (
          <div className="flex justify-end gap-2">
            <TableActionIconButton
              data-action-id="groups.email-invitations.resend"
              label={t(`${prefix}.resend`)}
              tooltip={coolingDown ? t(`${prefix}.cooldown`) : t(`${prefix}.resend`)}
              icon={<RotateCw className="h-4 w-4" />}
              variant="outline"
              disabled={busy || coolingDown}
              onClick={() => void act('resend', item.id)}
            />
            <TableActionIconButton
              data-action-id="groups.email-invitations.revoke"
              label={t(`${prefix}.revoke`)}
              icon={<Trash2 className="h-4 w-4" />}
              destructive
              disabled={busy}
              onClick={() => void act('revoke', item.id)}
            />
          </div>
        );
      },
    },
  ];
  return (
    <ManagementSection
      aria-busy={busy || (!data && !error)}
      contentClassName="space-y-3"
      title={
        <span className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          {t(`${prefix}.title`)}
          {data && <CountBadge count={data.invitations.length} />}
        </span>
      }
      description={t(`${prefix}.description`)}
    >
      {error && (
        <div role="alert">
          <InlineNotice variant="destructive">
            <p>{t(`${prefix}.errors.${error}`, { available: available ?? 0 })}</p>
            <Button
              data-action-id="groups.email-invitations.retry"
              variant="outline"
              className="mt-2"
              onClick={() => void load()}
            >
              {t(`${prefix}.retry`)}
            </Button>
          </InlineNotice>
        </div>
      )}
      {!data && !error && <p>{t(`${prefix}.loading`)}</p>}
      {data && (
        <DataTable
          columns={columns}
          data={data.invitations}
          getRowId={invitation => invitation.id}
          enablePagination={false}
          emptyTitle={t(`${prefix}.noInvitations`)}
        />
      )}
    </ManagementSection>
  );
}
