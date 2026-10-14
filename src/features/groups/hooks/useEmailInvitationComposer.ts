import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import {
  parseInvitationEmails,
  type InvitationPreview,
  type InvitationRecipient,
  type EmailInvitationRow,
} from '../logic/emailInvitations';

export class EmailInvitationApiError extends Error {
  constructor(
    public code: string,
    public available?: number
  ) {
    super(code);
  }
}
export async function emailInvitationRequest<T>(
  url: string,
  body?: unknown,
  signal?: AbortSignal
): Promise<T> {
  const { data } = await createClient().auth.getSession();
  const response = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal,
  });
  const result = await response.json();
  if (!response.ok)
    throw new EmailInvitationApiError(result.error || 'server_error', result.available);
  return result as T;
}

export function useEmailInvitationComposer(
  groupId: string | undefined,
  open: boolean,
  roleIds: string[]
) {
  const { t, language } = useTranslation();
  const [mode, setMode] = useState<'users' | 'email'>('users');
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<InvitationPreview | null>(null);
  const [names, setNames] = useState<Record<string, Omit<InvitationRecipient, 'email'>>>({});
  const [invitations, setInvitations] = useState<EmailInvitationRow[]>([]);
  const [listError, setListError] = useState('');
  const [loadingInvitations, setLoadingInvitations] = useState(false);
  const inFlight = useRef(false);
  const key = useRef(crypto.randomUUID());
  const parsed = useMemo(() => parseInvitationEmails(text), [text]);
  const recipients = parsed.emails.map(email => ({ email, ...names[email] }));
  const recipientsKey = JSON.stringify(recipients);
  const invalidKey = JSON.stringify(parsed.invalid);
  const rolesKey = JSON.stringify(roleIds);
  const url = groupId ? `/api/groups/${groupId}/email-invitations` : undefined;
  const refreshInvitations = useCallback(
    async (signal?: AbortSignal) => {
      if (!url) return;
      setLoadingInvitations(true);
      try {
        const value = await emailInvitationRequest<{ invitations: EmailInvitationRow[] }>(
          url,
          undefined,
          signal
        );
        if (!signal?.aborted) {
          setInvitations(value.invitations);
          setListError('');
        }
      } catch (failure) {
        if (!signal?.aborted)
          setListError(failure instanceof EmailInvitationApiError ? failure.code : 'server_error');
      } finally {
        if (!signal?.aborted) setLoadingInvitations(false);
      }
    },
    [url]
  );
  useEffect(() => {
    if (!open || mode !== 'email' || !url) return;
    let controller: AbortController;
    const refresh = () => {
      controller?.abort();
      controller = new AbortController();
      void refreshInvitations(controller.signal);
    };
    refresh();
    const timer = setInterval(refresh, 30_000);
    window.addEventListener('polity-email-invitations-changed', refresh);
    return () => {
      controller?.abort();
      clearInterval(timer);
      window.removeEventListener('polity-email-invitations-changed', refresh);
    };
  }, [open, mode, url, refreshInvitations]);
  useEffect(() => {
    setText('');
    setNames({});
    setPreview(null);
    setResult(null);
    setError('');
    setInvitations([]);
    setListError('');
    key.current = crypto.randomUUID();
  }, [groupId]);
  useEffect(() => {
    if (result) {
      setChecking(false);
      return;
    }
    setPreview(null);
    setError('');
    key.current = crypto.randomUUID();
    if (
      !open ||
      mode !== 'email' ||
      !url ||
      !parsed.emails.length ||
      parsed.invalid.length ||
      !roleIds.length
    ) {
      setChecking(false);
      return;
    }
    const controller = new AbortController();
    setChecking(true);
    const timer = setTimeout(() => {
      void emailInvitationRequest<InvitationPreview>(
        url,
        {
          action: 'preview',
          recipients: JSON.parse(recipientsKey),
          roleIds: JSON.parse(rolesKey),
          language,
        },
        controller.signal
      )
        .then(value => {
          if (!controller.signal.aborted) {
            setPreview(value);
            setChecking(false);
          }
        })
        .catch(failure => {
          if (!controller.signal.aborted) {
            setError(failure instanceof EmailInvitationApiError ? failure.code : 'server_error');
            setChecking(false);
          }
        });
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [recipientsKey, invalidKey, rolesKey, mode, open, url, language, result]);
  const readyCount = preview?.results.filter(row => row.status === 'ready').length ?? 0;
  const canSend =
    !!preview &&
    !checking &&
    !sending &&
    !parsed.invalid.length &&
    readyCount > 0 &&
    readyCount <= preview.available &&
    !result;
  async function send() {
    if (!url || !canSend || inFlight.current) return;
    inFlight.current = true;
    setSending(true);
    setError('');
    try {
      const value = await emailInvitationRequest<InvitationPreview>(url, {
        action: 'create',
        recipients,
        roleIds,
        language,
        idempotencyKey: key.current,
      });
      setResult(value);
      window.dispatchEvent(new Event('polity-email-invitations-changed'));
    } catch (failure) {
      setError(failure instanceof EmailInvitationApiError ? failure.code : 'server_error');
      if (failure instanceof EmailInvitationApiError && failure.available !== undefined) {
        const available = failure.available;
        setPreview(previous => (previous ? { ...previous, available } : previous));
      }
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }
  function setRecipientName(email: string, field: 'firstName' | 'lastName', value: string) {
    if (sending || result) return;
    setNames(previous => ({ ...previous, [email]: { ...previous[email], [field]: value } }));
  }
  function removeRecipient(email: string) {
    if (sending || result) return;
    setText(previous =>
      previous
        .split(/[\n\r,;]+/)
        .filter(entry => entry.trim().toLowerCase() !== email)
        .join('\n')
    );
    setNames(previous => {
      return Object.fromEntries(Object.entries(previous).filter(([address]) => address !== email));
    });
  }
  function startNewList() {
    if (sending) return;
    setResult(null);
    setText('');
    setNames({});
    setPreview(null);
    setError('');
    key.current = crypto.randomUUID();
  }
  return {
    t,
    mode,
    setMode,
    text,
    setText,
    parsed,
    recipients,
    setRecipientName,
    removeRecipient,
    startNewList,
    openInvitations: invitations.filter(
      row => row.state === 'pending' && !parsed.emails.includes(row.email)
    ),
    listError: listError ? t(`features.groups.emailInvitations.errors.${listError}`) : '',
    loadingInvitations,
    refreshInvitations,
    preview,
    checking,
    sending,
    readyCount,
    canSend,
    send,
    result,
    error: error
      ? t(`features.groups.emailInvitations.errors.${error}`, {
          available: preview?.available ?? 0,
        })
      : '',
  };
}
export type EmailInvitationComposer = ReturnType<typeof useEmailInvitationComposer>;
