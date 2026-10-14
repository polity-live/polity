import { Textarea } from '@/features/shared/ui/ui/textarea';
import { InlineNotice } from '@/features/shared/ui/feedback';
import { Button } from '@/features/shared/ui/ui/button';
import { Input } from '@/features/shared/ui/ui/input';
import { TypeaheadSelectedCard } from '@/features/shared/ui/typeahead/TypeaheadSelectedCard';
import { Loader2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { EmailInvitationComposer } from '../hooks/useEmailInvitationComposer';

export function EmailInvitationInput({ composer }: { composer: EmailInvitationComposer }) {
  const { t } = composer;
  const resultNoticeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (composer.result)
      resultNoticeRef.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  }, [composer.result]);
  const prefix = 'features.groups.emailInvitations';
  const display = composer.result ?? composer.preview;
  const locked = composer.sending || !!composer.result;
  const cards = composer.result?.results ?? composer.recipients;
  const counts = composer.result?.results.reduce(
    (totals, row) => {
      if (['sent', 'delivered'].includes(row.status)) totals.success++;
      else if (['failed', 'bounced', 'complained'].includes(row.status)) totals.failed++;
      else if (['unknown', 'sending'].includes(row.status)) totals.unknown++;
      else totals.skipped++;
      return totals;
    },
    { success: 0, failed: 0, unknown: 0, skipped: 0 }
  );
  return (
    <div className="space-y-3" aria-busy={composer.checking || composer.sending}>
      <label htmlFor="group-invitation-emails">{t(`${prefix}.addresses`)}</label>
      <Textarea
        id="group-invitation-emails"
        value={composer.text}
        onChange={event => composer.setText(event.target.value)}
        disabled={locked}
        aria-invalid={composer.parsed.invalid.length > 0}
        aria-describedby="group-invitation-emails-hint"
      />
      <p id="group-invitation-emails-hint" className="text-muted-foreground text-sm">
        {t(`${prefix}.hint`)}
      </p>
      {composer.parsed.invalid.length > 0 && (
        <div role="alert">
          <InlineNotice variant="destructive">
            {t(`${prefix}.invalid`, { emails: composer.parsed.invalid.join(', ') })}
          </InlineNotice>
        </div>
      )}
      {composer.parsed.duplicates.length > 0 && (
        <p>{t(`${prefix}.duplicates`, { emails: composer.parsed.duplicates.join(', ') })}</p>
      )}
      {composer.checking && <p role="status">{t(`${prefix}.checking`)}</p>}
      {composer.sending && (
        <div role="status">
          <InlineNotice variant="info">
            <span className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              {t(`${prefix}.sending`)}
            </span>
          </InlineNotice>
        </div>
      )}
      {composer.error && (
        <div role="alert">
          <InlineNotice variant="destructive">{composer.error}</InlineNotice>
        </div>
      )}
      {display && (
        <div aria-live="polite">
          {!composer.result && (
            <p>
              {t(`${prefix}.summary`, { count: composer.readyCount, available: display.available })}
            </p>
          )}
          {!composer.result && composer.readyCount > display.available && (
            <div role="alert">
              <InlineNotice variant="destructive">
                {t(`${prefix}.errors.quota_exceeded`, { available: display.available })}
              </InlineNotice>
            </div>
          )}
        </div>
      )}
      {counts && (
        <div
          ref={resultNoticeRef}
          className="scroll-mt-24"
          data-testid="email-invitation-send-result"
          role={counts.failed || counts.unknown ? 'alert' : 'status'}
          aria-live="polite"
        >
          <InlineNotice
            variant={
              counts.failed
                ? 'destructive'
                : counts.unknown
                  ? 'warning'
                  : counts.success
                    ? 'success'
                    : 'info'
            }
            title={t(
              `${prefix}.${counts.failed ? 'sendFailed' : counts.unknown ? 'sendUnknown' : counts.success ? 'sendSuccess' : 'nothingSent'}`
            )}
          >
            <p>{t(`${prefix}.sendSummary`, counts)}</p>
            {counts.success > 0 && <p>{t(`${prefix}.providerAccepted`)}</p>}
          </InlineNotice>
        </div>
      )}
      <ul className="space-y-2">
        {cards?.map(person => {
          const status =
            composer.result?.results.find(row => row.email === person.email)?.status ??
            composer.preview?.results.find(row => row.email === person.email)?.status;
          const name = [person.firstName, person.lastName].filter(Boolean).join(' ');
          return (
            <li key={person.email}>
              <TypeaheadSelectedCard
                item={{
                  id: person.email,
                  entityType: 'user',
                  label: name || person.email,
                  secondaryLabel: person.email,
                  metadata: status ? [t(`${prefix}.results.${status}`)] : [],
                }}
                variant="stacked"
                badgeLabel={t(`${prefix}.emailPerson`)}
                onRemove={locked ? undefined : () => composer.removeRecipient(person.email)}
              >
                {!composer.result && (
                  <details>
                    <summary className="cursor-pointer text-sm">{t(`${prefix}.addName`)}</summary>
                    <div className="mt-2 grid gap-3 sm:grid-cols-2">
                      {(['firstName', 'lastName'] as const).map(field => (
                        <label key={field} className="space-y-1 text-sm">
                          <span>{t(`${prefix}.${field}`)}</span>
                          <Input
                            data-action-id={`groups.email-invitations.${field}`}
                            aria-label={`${t(`${prefix}.${field}`)}: ${person.email}`}
                            value={person[field] ?? ''}
                            maxLength={100}
                            disabled={composer.sending}
                            onChange={event =>
                              composer.setRecipientName(person.email, field, event.target.value)
                            }
                          />
                        </label>
                      ))}
                    </div>
                  </details>
                )}
              </TypeaheadSelectedCard>
            </li>
          );
        })}
      </ul>
      {composer.result && (
        <Button
          data-action-id="groups.email-invitations.new-list"
          type="button"
          variant="outline"
          onClick={composer.startNewList}
        >
          {t(`${prefix}.morePeople`)}
        </Button>
      )}
      <section className="space-y-2" aria-busy={composer.loadingInvitations}>
        <h3 className="text-sm font-semibold">{t(`${prefix}.openInvitations`)}</h3>
        {composer.listError && (
          <div role="alert">
            <InlineNotice variant="destructive">
              <p>{composer.listError}</p>
              <Button
                data-action-id="groups.email-invitations.list-retry"
                type="button"
                variant="outline"
                className="mt-2"
                disabled={composer.loadingInvitations}
                onClick={() => void composer.refreshInvitations()}
              >
                {t(`${prefix}.retry`)}
              </Button>
            </InlineNotice>
          </div>
        )}
        {!composer.listError && composer.openInvitations?.length === 0 && (
          <p className="text-muted-foreground text-sm">{t(`${prefix}.noOpenInvitations`)}</p>
        )}
        <ul className="space-y-2">
          {composer.openInvitations?.map(person => (
            <li key={person.id}>
              <TypeaheadSelectedCard
                item={{
                  id: person.id,
                  entityType: 'user',
                  label:
                    [person.first_name, person.last_name].filter(Boolean).join(' ') || person.email,
                  secondaryLabel: person.email,
                  metadata: [t(`${prefix}.results.${person.delivery_status}`)],
                }}
                variant="stacked"
                badgeLabel={t(`${prefix}.openInvitation`)}
              />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
