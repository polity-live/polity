import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuth } from '@/providers/auth-provider';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { Button } from '@/features/shared/ui/ui/button';
import { storePendingSignInRedirect } from '@/features/auth/logic/authRedirects';
import {
  EmailInvitationApiError,
  emailInvitationRequest,
} from '../hooks/useEmailInvitationComposer';
import type { PublicInvitation } from '../logic/emailInvitations';

export function GroupInvitationPage({ token }: { token: string }) {
  const { user, signOut, loading } = useAuth();
  const { t, language } = useTranslation();
  const navigate = useNavigate();
  const [data, setData] = useState<PublicInvitation | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const prefix = 'features.groups.emailInvitations';
  const url = `/api/invitations/${encodeURIComponent(token)}`;
  const load = useCallback(async () => {
    try {
      setData(await emailInvitationRequest(url));
      setError('');
    } catch (failure) {
      setError(failure instanceof EmailInvitationApiError ? failure.code : 'server_error');
    }
  }, [url, user?.id, user?.email]);
  useEffect(() => {
    if (!loading) void load();
  }, [load, loading]);
  async function authenticate(signUp: boolean) {
    storePendingSignInRedirect(`/invite/${token}`);
    await navigate({ to: signUp ? '/auth/sign-up' : '/auth/sign-in' });
  }
  async function switchAccount() {
    setBusy(true);
    try {
      await signOut();
      storePendingSignInRedirect(`/invite/${token}`);
      await navigate({ to: '/auth/sign-in' });
    } finally {
      setBusy(false);
    }
  }
  async function accept() {
    setBusy(true);
    setError('');
    try {
      const accepted = await emailInvitationRequest<{ groupId: string; needsOnboarding: boolean }>(
        url,
        {}
      );
      sessionStorage.removeItem('polity_pending_sign_in_redirect');
      if (accepted.needsOnboarding || sessionStorage.getItem('polity_onboarding') === 'true') {
        sessionStorage.setItem('polity_onboarding', 'true');
        sessionStorage.setItem(
          'polity_invitation_onboarding_destination',
          `/group/${accepted.groupId}`
        );
        await navigate({ to: '/', replace: true });
      } else await navigate({ to: '/group/$id', params: { id: accepted.groupId }, replace: true });
    } catch (failure) {
      setError(failure instanceof EmailInvitationApiError ? failure.code : 'server_error');
    } finally {
      setBusy(false);
    }
  }
  const available = data?.state === 'pending' || data?.state === 'accepted';
  return (
    <main className="mx-auto max-w-xl space-y-5 px-4 py-12" aria-busy={busy}>
      <h1 className="text-2xl font-semibold">{t(`${prefix}.invitation`)}</h1>
      {error && <p role="alert">{t(`${prefix}.errors.${error}`)}</p>}
      {!data && !error && <p role="status">{t(`${prefix}.loading`)}</p>}
      {data && (
        <>
          <p>{t(`${prefix}.invitedBy`, { name: data.inviterName, group: data.groupName })}</p>
          <p>
            {t(`${prefix}.roles`)}: {data.roles.join(', ')}
          </p>
          {data.expiresAt && (
            <p>
              {t(`${prefix}.expires`, {
                date: new Date(data.expiresAt).toLocaleDateString(
                  language === 'de' ? 'de-DE' : 'en-GB'
                ),
              })}
            </p>
          )}
          {!available && <p role="alert">{t(`${prefix}.errors.${data.state}`)}</p>}
          {available && !user && (
            <p>
              {t(`${prefix}.recipient`)}: {data.maskedEmail}
            </p>
          )}
          {available && !user && (
            <div className="flex flex-wrap gap-3">
              <Button
                data-action-id="groups.email-invitations.sign-in"
                onClick={() => void authenticate(false)}
              >
                {t(`${prefix}.signIn`)}
              </Button>
              <Button
                data-action-id="groups.email-invitations.sign-up"
                variant="outline"
                onClick={() => void authenticate(true)}
              >
                {t(`${prefix}.signUp`)}
              </Button>
            </div>
          )}
          {available && user && !data.matchesEmail && (
            <>
              <p>{t(`${prefix}.wrongAccount`, { email: data.maskedEmail })}</p>
              <Button
                data-action-id="groups.email-invitations.switch-account"
                variant="outline"
                disabled={busy}
                onClick={() => void switchAccount()}
              >
                {t(`${prefix}.switchAccount`)}
              </Button>
            </>
          )}
          {available && user && data.matchesEmail && !data.emailConfirmed && (
            <p>{t(`${prefix}.confirmEmail`)}</p>
          )}
          {available && user && data.matchesEmail && data.emailConfirmed && (
            <Button
              data-action-id="groups.email-invitations.accept"
              disabled={busy}
              onClick={() => void accept()}
            >
              {t(`${prefix}.accept`)}
            </Button>
          )}
        </>
      )}
    </main>
  );
}
