'use client';

import { featureThemeClassName } from '@/features/shared/theme';
import { BadgeControl } from '@/features/shared/ui/status';
/**
 * Editor Toolbar Component
 *
 * Configurable toolbar for the unified editor with optional features:
 * - Share button
 * - Version control
 * - Mode selector
 * - Online users indicator
 */

import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { Users } from 'lucide-react';
import { ShareButton } from '@/features/shared/ui/action-buttons/ShareButton.tsx';
import { VersionControl } from './VersionControl';
import { ModeSelector } from './ModeSelector';
import type { Value } from 'platejs';
import type {
  EditorEntityType,
  EditorMode,
  EditorPresencePeer,
  EditorCapabilities,
} from '../types';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface EditorToolbarProps {
  /** Entity type for the editor */
  entityType: EditorEntityType;
  /** Entity ID */
  entityId: string;
  /** Current user ID */
  userId?: string;
  /** Title for sharing */
  shareTitle?: string;
  /** Description for sharing */
  shareDescription?: string;
  /** Current content for version control */
  currentContent?: Value;
  /** Handler for restoring a version */
  onRestoreVersion?: (content: Value) => void;
  /** Amendment ID (for amendment-specific notifications) */
  amendmentId?: string;
  /** Amendment title (for amendment-specific notifications) */
  amendmentTitle?: string;
  /** Current editing mode */
  currentMode?: EditorMode;
  /** Handler for mode changes */
  onModeChange?: (mode: EditorMode) => void;
  /** Whether user is owner or collaborator */
  isOwnerOrCollaborator?: boolean;
  /** Online peers for presence indicator */
  onlinePeers?: EditorPresencePeer[];
  /** Status badge text */
  statusBadge?: string;
  /** Capabilities configuration */
  capabilities?: Partial<EditorCapabilities>;
}

export function EditorToolbar({
  entityType,
  entityId,
  userId,
  shareTitle,
  shareDescription,
  currentContent,
  onRestoreVersion,
  amendmentId,
  amendmentTitle,
  currentMode,
  onModeChange,
  isOwnerOrCollaborator,
  onlinePeers = [],
  statusBadge,
  capabilities = {},
}: EditorToolbarProps) {
  // Determine which features to show based on capabilities
  const showVersioning =
    capabilities.versioning !== false && currentContent && onRestoreVersion && userId;
  const showSharing = capabilities.sharing !== false && shareTitle;
  const showModeSelector = capabilities.modeSelection !== false && currentMode && onModeChange;
  const showPresence = capabilities.presence !== false && onlinePeers.length > 0;

  return (
    <div className="scrollbar-hide mb-6 overflow-x-auto">
      <div className="flex w-max min-w-full items-center justify-end gap-4">
        {/* Share Button */}
        {showSharing && (
          <ShareButton
            url={typeof window !== 'undefined' ? window.location.href : ''}
            title={shareTitle}
            description={shareDescription || ''}
          />
        )}

        {/* Version Control */}
        {showVersioning && (
          <VersionControl
            entityType={entityType}
            entityId={entityId}
            currentContent={currentContent}
            currentUserId={userId}
            onRestoreVersion={onRestoreVersion}
            amendmentId={amendmentId}
            amendmentTitle={amendmentTitle}
          />
        )}

        {/* Mode Selector */}
        {showModeSelector && (
          <ModeSelector
            entityType={entityType}
            entityId={entityId}
            currentMode={currentMode}
            onModeChange={onModeChange}
            isOwnerOrCollaborator={!!isOwnerOrCollaborator}
          />
        )}

        {/* Online users indicator */}
        {showPresence && (
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
                    className={featureThemeClassName('documentPresenceIndicatorsContrastText')}
                  >
                    {peer.name?.[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ))}
              {onlinePeers.length > 5 && (
                <Avatar className="border-background h-6 w-6 border-2">
                  <AvatarFallback className="text-xs">+{onlinePeers.length - 5}</AvatarFallback>
                </Avatar>
              )}
            </div>
          </div>
        )}

        {/* Status Badge */}
        {statusBadge && (
          <BadgeControl variant="outline" textTransform="capitalize">
            {statusBadge}
          </BadgeControl>
        )}
      </div>
    </div>
  );
}
