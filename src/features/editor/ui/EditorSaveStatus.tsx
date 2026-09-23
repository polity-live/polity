'use client';

import { Eye, Loader2 } from 'lucide-react';

import { featureThemeClassName } from '@/features/shared/theme';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { cn } from '@/features/shared/utils/utils';

interface EditorSaveStatusProps {
  saveStatus: 'saved' | 'saving' | 'error';
  hasUnsavedChanges: boolean;
  isSavingTitle?: boolean;
  className?: string;
}

export function EditorSaveStatus({
  saveStatus,
  hasUnsavedChanges,
  isSavingTitle = false,
  className,
}: EditorSaveStatusProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        'text-muted-foreground flex w-full min-w-0 items-center gap-2 text-xs md:w-auto md:shrink-0',
        className
      )}
      role="status"
    >
      {saveStatus === 'saving' || isSavingTitle ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>{t('features.editor.header.saving')}</span>
        </>
      ) : saveStatus === 'error' ? (
        <span className="text-destructive">⚠️ {t('features.editor.header.saveFailed')}</span>
      ) : hasUnsavedChanges ? (
        <span className={featureThemeClassName('editorEditorHeaderWarningText')}>
          {t('features.editor.header.unsavedChanges')}
        </span>
      ) : (
        <>
          <Eye className="h-3 w-3" />
          <span>{t('features.editor.header.allSaved')}</span>
        </>
      )}
    </div>
  );
}
