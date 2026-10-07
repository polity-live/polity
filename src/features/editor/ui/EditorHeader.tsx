'use client';

import { FormControlInput } from '@/features/shared/ui/form';
/**
 * Editor Header Component
 *
 * Displays title editing and save status.
 */

import { Button } from '@/features/shared/ui/ui/button';
import { Pencil } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { EditorSaveStatus } from './EditorSaveStatus';

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
    <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
      <div className="min-w-0 flex-1">
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
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="min-w-0 text-2xl font-bold break-words">
              {title || t('features.editor.header.untitled')}
            </h2>
            {canEditTitle ? (
              <Button
                data-action-id="editor.header.title.edit"
                variant="ghost"
                size="sm"
                aria-label={t('features.editor.header.editTitle', 'Edit title')}
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

      <EditorSaveStatus
        saveStatus={saveStatus}
        hasUnsavedChanges={hasUnsavedChanges}
        isSavingTitle={isSavingTitle}
      />
    </div>
  );
}
