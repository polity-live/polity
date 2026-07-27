'use client';

import { GraduationCap, Play, RotateCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';

import { useTranslation } from '@/features/shared/hooks/use-translation';
import { SettingsPanel } from '@/features/shared/ui/form';
import { BadgeControl } from '@/features/shared/ui/status';
import { Button } from '@/features/shared/ui/ui/button';
import { usePreferenceState } from '@/zero/preferences/usePreferenceState';
import type { PublicAppTutorialRun } from '@/server/app-tutorial/service';
import { getAppTutorialCheckpoint } from './catalog';
import { loadTutorialRun } from './api';

export function AppTutorialSettingsPanel() {
  const { t, language } = useTranslation();
  const { appTutorialCompletedAt } = usePreferenceState();
  const [run, setRun] = useState<PublicAppTutorialRun | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void loadTutorialRun()
      .then(result => {
        if (active) setRun(result.run);
      })
      .catch(error => console.error('Tutorial status load failed:', error))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const checkpoint = run ? getAppTutorialCheckpoint(run.currentCheckpointId) : null;
  const status = run
    ? run.status === 'paused'
      ? t('features.appTutorial.settings.paused')
      : t('features.appTutorial.settings.active')
    : appTutorialCompletedAt
      ? t('features.appTutorial.settings.complete')
      : t('features.appTutorial.settings.notStarted');
  const action = run
    ? t('features.appTutorial.settings.resume')
    : appTutorialCompletedAt
      ? t('features.appTutorial.settings.restart')
      : t('features.appTutorial.settings.start');
  const restart = !run && Boolean(appTutorialCompletedAt);

  return (
    <SettingsPanel
      title={t('features.appTutorial.settings.title')}
      description={t('features.appTutorial.settings.description')}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <BadgeControl variant="outline">{status}</BadgeControl>
          {checkpoint && (
            <p className="text-muted-foreground text-sm">
              {t('features.appTutorial.settings.chapter', { chapter: checkpoint.chapter })}
              {' · '}
              {checkpoint.copy[language].title}
            </p>
          )}
        </div>
        <Button asChild variant={run ? 'default' : 'outline'} disabled={loading}>
          <Link to="/onboarding" search={{ restart }}>
            {restart ? (
              <RotateCw className="h-4 w-4" />
            ) : run ? (
              <Play className="h-4 w-4" />
            ) : (
              <GraduationCap className="h-4 w-4" />
            )}
            {action}
          </Link>
        </Button>
      </div>
    </SettingsPanel>
  );
}
