'use client';

/**
 * Editor Header Component
 *
 * Displays title editing, save status, and online users.
 */

import { Input } from '@/features/shared/ui/ui/input';
import { Button } from '@/features/shared/ui/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { Loader2, Eye, Pencil, Users } from 'lucide-react';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import type { EditorPresencePeer } from '../types';

interface EditorHeaderProps {
  title: string;
  onTitleChange: (title: string) => void;
  isEditingTitle: boolean;
  setIsEditingTitle: (editing: boolean) => void;
  canEditTitle?: boolean;
  isSavingTitle: boolean;
  saveStatus: 'saved' | 'saving' | 'error';
  hasUnsavedChanges: boolean;
  onlinePeers?: EditorPresencePeer[];
  showPresence?: boolean;
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
  onlinePeers = [],
  showPresence = true,
  statusBadge,
}: EditorHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-4">
      <div className="flex-1">
        {isEditingTitle && canEditTitle ? (
          <Input
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

      {/* Online presence */}
      {showPresence && onlinePeers.length > 0 && (
        <div className="flex items-center gap-2">
          <Users className="text-muted-foreground h-4 w-4" />
          <span className="text-muted-foreground text-sm">
            {onlinePeers.length}{' '}
            {onlinePeers.length === 1
              ? translateText('generated.inline.0026_user_12dea96f')
              : translateText('generated.inline.0027_users_5b7dcd14')}
            {translateText('generated.inline.0035_online_2dbc2fd2')}
          </span>
          <div className="flex -space-x-2">
            {onlinePeers.slice(0, 5).map(peer => (
              <Avatar
                key={peer.peerId}
                className="border-background h-6 w-6 border-2"
                title={peer.name}
              >
                {peer.avatar ? <AvatarImage src={peer.avatar} alt={peer.name} /> : null}
                <AvatarFallback
                  style={{ backgroundColor: peer.color }}
                  className="text-xs text-white"
                >
                  {peer.name?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ))}
            {onlinePeers.length > 5 && (
              <div className="border-background bg-muted flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs">
                +{onlinePeers.length - 5}
              </div>
            )}
          </div>
        </div>
      )}

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
            <span className="text-yellow-600">{t('features.editor.header.unsavedChanges')}</span>
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
