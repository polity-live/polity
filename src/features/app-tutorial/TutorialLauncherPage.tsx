'use client';

import { AlertTriangle, RotateCw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';

import { useTranslation } from '@/features/shared/hooks/use-translation';
import { localizeAppError } from '@/features/shared/errors';
import { AppBootLoadingState } from '@/features/shared/ui/feedback';
import { Button } from '@/features/shared/ui/ui/button';
import { Card, CardContent } from '@/features/shared/ui/ui/card';
import { startTutorial } from './api';

let pendingTutorialStart: ReturnType<typeof startTutorial> | null = null;

function startTutorialDeduplicated(restart: boolean) {
  if (!pendingTutorialStart) {
    pendingTutorialStart = startTutorial(restart).finally(() => {
      pendingTutorialStart = null;
    });
  }
  return pendingTutorialStart;
}

export function TutorialLauncherPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: '/_authed/onboarding' });
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const launchedRef = useRef(false);

  const launch = useCallback(async () => {
    setError(null);
    try {
      const { run } = await startTutorialDeduplicated(search.restart);
      await navigate({ to: run.route as never, replace: true });
    } catch (launchError) {
      setError(localizeAppError(launchError));
    }
  }, [navigate, search.restart]);

  const rebuild = useCallback(async () => {
    setError(null);
    try {
      const { run } = await startTutorialDeduplicated(true);
      await navigate({ to: run.route as never, replace: true });
    } catch (launchError) {
      setError(localizeAppError(launchError));
    }
  }, [navigate]);

  useEffect(() => {
    if (launchedRef.current) return;
    launchedRef.current = true;
    void launch();
  }, [launch]);

  if (!error) return <AppBootLoadingState details="/onboarding" />;

  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <Card className="w-full max-w-lg">
        <CardContent className="space-y-4 p-6">
          <AlertTriangle className="text-destructive h-8 w-8" />
          <div>
            <h1 className="text-lg font-semibold">{t('features.appTutorial.launcher.title')}</h1>
            <p className="text-muted-foreground mt-2 text-sm">{error}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button data-action-id="app-tutorial.launcher.retry" onClick={() => void launch()}>
              {t('features.appTutorial.launcher.retry')}
            </Button>
            <Button
              data-action-id="app-tutorial.launcher.restart"
              variant="outline"
              onClick={() => void rebuild()}
            >
              <RotateCw className="h-4 w-4" />
              {t('features.appTutorial.launcher.restart')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
