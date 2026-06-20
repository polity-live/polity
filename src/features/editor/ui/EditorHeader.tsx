'use client';

import { featureThemeClassName } from '@/features/shared/theme';
import { FormControlInput } from '@/features/shared/ui/form';
/**
 * Editor Header Component
 *
 * Displays title editing and save status.
 */

import { Button } from '@/features/shared/ui/ui/button';
import { Loader2, Eye, Pencil } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';

interface EditorHeaderProps {
  title: string;
  onTitleChange: (title: string) => void;
  isEditingTitle: boolean;
  setIsEditingTitle: (editing: boolean) => void;
  canEditTitle?: boolean;
  isSavingTitle: boolean;
  saveStatus: 'saved' | 'saving' | 'error';
  hasUnsavedChanges: boolean;
  presenceSlot?: React.ReactNode;
  statusBadge?: React.ReactNode;
}

export function EditorHeader({
  title,
  onTitleChange,
  isEditingTitle,
  setIsEditingTitle,
  canEditTitle = true,
  isSavingTitle,
  saveStatus,
  hasUnsavedChanges,
  presenceSlot,
  statusBadge,
}: EditorHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-4">
      <div className="flex-1">
        {isEditingTitle && canEditTitle ? (
          <FormControlInput
            value={title}
            onChange={e => onTitleChange(e.target.value)}
            className="border-none px-0 text-2xl font-bold shadow-none focus-visible:ring-0"
            placeholder={t('features.editor.header.titlePlaceholder')}
            autoFocus
            onBlur={() => setIsEditingTitle(false)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === 'Escape') {
                setIsEditingTitle(false);
              }
            }}
          />
        ) : (
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold">{title || t('features.editor.header.untitled')}</h2>
            {canEditTitle ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setIsEditingTitle(true)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        )}
      </div>

      {presenceSlot}

      {/* Status badge */}
      {statusBadge}

      {/* Save status */}
      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        {saveStatus === 'saving' || isSavingTitle ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>{t('features.editor.header.saving')}</span>
          </>
        ) : saveStatus === 'error' ? (
          <>
            <span className="text-destructive">⚠️ {t('features.editor.header.saveFailed')}</span>
          </>
        ) : hasUnsavedChanges ? (
          <>
            <span className={featureThemeClassName('editorEditorHeaderWarningText')}>
              {t('features.editor.header.unsavedChanges')}
            </span>
          </>
        ) : (
          <>
            <Eye className="h-3 w-3" />
            <span>{t('features.editor.header.allSaved')}</span>
          </>
        )}
      </div>
    </div>
  );
}
