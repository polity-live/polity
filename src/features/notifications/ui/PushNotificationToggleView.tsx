'use client';

import { Bell, BellOff, Loader2 } from 'lucide-react';
import { Button } from '@/features/shared/ui/ui/button.tsx';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card.tsx';
import { Alert, AlertDescription } from '@/features/shared/ui/ui/alert.tsx';
export interface PushNotificationToggleViewProps {
  variant: any;
  showDescription: any;
  t: any;
  isSupported: any;
  isSubscribed: any;
  isLoading: any;
  permission: any;
  error: any;
  subscribe: any;
  unsubscribe: any;
  handleToggle: any;
}

export function PushNotificationToggleView({
  variant,
  showDescription,
  t,
  isSupported,
  isSubscribed,
  isLoading,
  permission,
  error,
  handleToggle,
}: PushNotificationToggleViewProps) {
  // Browser doesn't support push notifications
  if (!isSupported) {
    if (variant === 'minimal') {
      return (
        <Button
          variant="outline"
          size="sm"
          disabled
          title={t('components.pushNotifications.notSupported')}
        >
          <BellOff className="h-4 w-4" />
        </Button>
      );
    }

    return (
      <Alert>
        <BellOff className="h-4 w-4" />
        <AlertDescription>{t('components.pushNotifications.notSupported')}</AlertDescription>
      </Alert>
    );
  }

  // Permission denied
  if (permission === 'denied') {
    if (variant === 'minimal') {
      return (
        <Button
          variant="outline"
          size="sm"
          disabled
          title={t('components.pushNotifications.blocked')}
        >
          <BellOff className="h-4 w-4" />
        </Button>
      );
    }

    return (
      <Alert variant="destructive">
        <BellOff className="h-4 w-4" />
        <AlertDescription>{t('components.pushNotifications.blockedLong')}</AlertDescription>
      </Alert>
    );
  }

  // Minimal variant - just a button
  if (variant === 'minimal') {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant={isSubscribed ? 'default' : 'outline'}
          size="sm"
          onClick={handleToggle}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isSubscribed ? (
            <>
              <Bell className="mr-2 h-4 w-4" />
              {t('components.pushNotifications.active')}
            </>
          ) : (
            <>
              <BellOff className="mr-2 h-4 w-4" />
              {t('components.pushNotifications.activate')}
            </>
          )}
        </Button>
        {error && <span className="text-destructive text-xs">{error}</span>}
      </div>
    );
  }

  // Card variant
  if (variant === 'card') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isSubscribed ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
            {t('components.pushNotifications.title')}
          </CardTitle>
          {showDescription && (
            <CardDescription>{t('components.pushNotifications.description')}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-sm font-medium">
                {isSubscribed
                  ? t('components.pushNotifications.enabled')
                  : t('components.pushNotifications.disabled')}
              </div>
              <div className="text-muted-foreground text-sm">
                {isSubscribed
                  ? t('components.pushNotifications.enabledDescription')
                  : t('components.pushNotifications.disabledDescription')}
              </div>
            </div>
            <Button
              onClick={handleToggle}
              disabled={isLoading}
              variant={isSubscribed ? 'outline' : 'default'}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isSubscribed ? (
                t('components.pushNotifications.deactivate')
              ) : (
                t('components.pushNotifications.activate')
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Default variant
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 text-sm font-medium">
            {isSubscribed ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            {t('components.pushNotifications.title')}
          </div>
          {showDescription && (
            <div className="text-muted-foreground text-sm">
              {isSubscribed
                ? t('components.pushNotifications.enabledDescriptionShort')
                : t('components.pushNotifications.disabledDescriptionShort')}
            </div>
          )}
        </div>
        <Button
          onClick={handleToggle}
          disabled={isLoading}
          variant={isSubscribed ? 'outline' : 'default'}
          size="sm"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isSubscribed ? (
            t('components.pushNotifications.deactivate')
          ) : (
            t('components.pushNotifications.activate')
          )}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
