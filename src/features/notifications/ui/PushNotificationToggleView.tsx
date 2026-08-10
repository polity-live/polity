'use client';

import { Bell, BellOff, CheckCircle2, CircleAlert, Loader2, Send } from 'lucide-react';

import { Alert, AlertDescription } from '@/features/shared/ui/ui/alert';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';

type Translate = (
  key: string,
  paramsOrFallback?: string | Record<string, string | number | null | undefined>,
  fallback?: string
) => string;

interface PushTestState {
  status: 'pending' | 'processing' | 'sent' | 'skipped' | 'failed';
  skipReason?: string | null;
  error?: string | null;
}

export interface PushNotificationToggleViewProps {
  variant: 'default' | 'card' | 'minimal' | 'settings';
  showDescription: boolean;
  showDiagnostics: boolean;
  t: Translate;
  isSupported: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
  permission: NotificationPermission;
  error: string | null;
  serviceWorkerReady: boolean;
  serverSynchronized: boolean;
  requiresIosInstall: boolean;
  testState: PushTestState | null;
  testLoading: boolean;
  handleToggle: () => Promise<void>;
  handleTest: () => Promise<void>;
}

function StatusRow({ ok, label, value }: { ok: boolean; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5 text-right">
        {ok ? (
          <CheckCircle2 className="size-3.5 text-emerald-600" />
        ) : (
          <CircleAlert className="text-muted-foreground size-3.5" />
        )}
        {value}
      </span>
    </div>
  );
}

function Diagnostics({
  t,
  isSubscribed,
  permission,
  serviceWorkerReady,
  serverSynchronized,
  testState,
  testLoading,
  handleTest,
}: Pick<
  PushNotificationToggleViewProps,
  | 't'
  | 'isSubscribed'
  | 'permission'
  | 'serviceWorkerReady'
  | 'serverSynchronized'
  | 'testState'
  | 'testLoading'
  | 'handleTest'
>) {
  const testStatus =
    testState?.status === 'skipped' && testState.skipReason
      ? t(`components.pushNotifications.test.skipReasons.${testState.skipReason}`)
      : testState
        ? t(`components.pushNotifications.test.status.${testState.status}`)
        : null;

  return (
    <div className="bg-muted/40 space-y-3 rounded-md border p-3">
      <div className="space-y-2">
        <StatusRow
          ok
          label={t('components.pushNotifications.diagnostics.browser')}
          value={t('components.pushNotifications.diagnostics.ready')}
        />
        <StatusRow
          ok={permission === 'granted'}
          label={t('components.pushNotifications.diagnostics.permission')}
          value={t(`components.pushNotifications.diagnostics.permissionValues.${permission}`)}
        />
        <StatusRow
          ok={serviceWorkerReady}
          label={t('components.pushNotifications.diagnostics.serviceWorker')}
          value={t(
            serviceWorkerReady
              ? 'components.pushNotifications.diagnostics.ready'
              : 'components.pushNotifications.diagnostics.missing'
          )}
        />
        <StatusRow
          ok={serverSynchronized}
          label={t('components.pushNotifications.diagnostics.server')}
          value={t(
            serverSynchronized
              ? 'components.pushNotifications.diagnostics.synchronized'
              : 'components.pushNotifications.diagnostics.notSynchronized'
          )}
        />
      </div>
      <div className="flex flex-col items-start gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-muted-foreground text-xs">
          {testStatus ?? t('components.pushNotifications.test.description')}
          {testState?.error ? `: ${t('common.appErrors.push_operation_failed')}` : null}
        </div>
        <Button
          data-action-id="notifications.push-test.send.current-device"
          type="button"
          size="sm"
          variant="outline"
          disabled={!isSubscribed || testLoading}
          onClick={() => void handleTest()}
        >
          {testLoading ? (
            <Loader2 className="mr-2 size-3.5 animate-spin" />
          ) : (
            <Send className="mr-2 size-3.5" />
          )}
          {t('components.pushNotifications.test.action')}
        </Button>
      </div>
      {testState?.status === 'pending' ? (
        <p className="text-xs font-medium">
          {t('components.pushNotifications.test.backgroundInstruction')}
        </p>
      ) : null}
    </div>
  );
}

function ToggleButton({
  'data-action-id': actionId,
  t,
  isSubscribed,
  isLoading,
  handleToggle,
}: Pick<PushNotificationToggleViewProps, 't' | 'isSubscribed' | 'isLoading' | 'handleToggle'> & {
  'data-action-id': string;
}) {
  return (
    <Button
      data-action-id={actionId}
      onClick={() => void handleToggle()}
      disabled={isLoading}
      variant={isSubscribed ? 'outline' : 'default'}
      size="sm"
    >
      {isLoading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : isSubscribed ? (
        <>
          <Bell className="mr-2 size-4" />
          {t('components.pushNotifications.active')}
        </>
      ) : (
        <>
          <BellOff className="mr-2 size-4" />
          {t('components.pushNotifications.activate')}
        </>
      )}
    </Button>
  );
}

export function PushNotificationToggleView(props: PushNotificationToggleViewProps) {
  const {
    variant,
    showDescription,
    showDiagnostics,
    t,
    isSupported,
    isSubscribed,
    permission,
    error,
    requiresIosInstall,
  } = props;

  if (requiresIosInstall) {
    return (
      <Alert>
        <BellOff className="size-4" />
        <AlertDescription>{t('components.pushNotifications.iosInstallRequired')}</AlertDescription>
      </Alert>
    );
  }

  if (!isSupported) {
    if (variant === 'minimal' && !showDiagnostics) {
      return (
        <Button
          data-action-id="notifications.push-unavailable.show.browser"
          variant="outline"
          size="sm"
          disabled
          title={t('components.pushNotifications.notSupported')}
        >
          <BellOff className="size-4" />
        </Button>
      );
    }
    return (
      <Alert>
        <BellOff className="size-4" />
        <AlertDescription>{t('components.pushNotifications.notSupported')}</AlertDescription>
      </Alert>
    );
  }

  if (permission === 'denied') {
    if (variant === 'minimal' && !showDiagnostics) {
      return (
        <Button
          data-action-id="notifications.push-unavailable.show.permission"
          variant="outline"
          size="sm"
          disabled
          title={t('components.pushNotifications.blocked')}
        >
          <BellOff className="size-4" />
        </Button>
      );
    }
    return (
      <Alert variant="destructive">
        <BellOff className="size-4" />
        <AlertDescription>{t('components.pushNotifications.blockedLong')}</AlertDescription>
      </Alert>
    );
  }

  if (variant === 'card') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isSubscribed ? <Bell className="size-5" /> : <BellOff className="size-5" />}
            {t('components.pushNotifications.title')}
          </CardTitle>
          {showDescription ? (
            <CardDescription>{t('components.pushNotifications.description')}</CardDescription>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="text-sm font-medium">
                {t(
                  isSubscribed
                    ? 'components.pushNotifications.enabled'
                    : 'components.pushNotifications.disabled'
                )}
              </div>
              <div className="text-muted-foreground text-sm">
                {t(
                  isSubscribed
                    ? 'components.pushNotifications.enabledDescription'
                    : 'components.pushNotifications.disabledDescription'
                )}
              </div>
            </div>
            <ToggleButton data-action-id="notifications.push.toggle.card" {...props} />
          </div>
          {showDiagnostics ? <Diagnostics {...props} /> : null}
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  if (variant === 'settings') {
    return (
      <div className="space-y-3 py-3">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <div className="text-sm font-medium">{t('components.pushNotifications.title')}</div>
            <p className="text-muted-foreground text-xs">
              {t('components.pushNotifications.description')}
            </p>
          </div>
          <ToggleButton data-action-id="notifications.push.toggle.settings" {...props} />
        </div>
        {showDiagnostics ? <Diagnostics {...props} /> : null}
        {error ? <p className="text-destructive text-xs">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        {variant === 'default' ? (
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 text-sm font-medium">
              {isSubscribed ? <Bell className="size-4" /> : <BellOff className="size-4" />}
              {t('components.pushNotifications.title')}
            </div>
            {showDescription ? (
              <div className="text-muted-foreground text-sm">
                {t(
                  isSubscribed
                    ? 'components.pushNotifications.enabledDescriptionShort'
                    : 'components.pushNotifications.disabledDescriptionShort'
                )}
              </div>
            ) : null}
          </div>
        ) : null}
        <ToggleButton data-action-id="notifications.push.toggle.inline" {...props} />
      </div>
      {showDiagnostics ? <Diagnostics {...props} /> : null}
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
