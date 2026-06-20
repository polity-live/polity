'use client';

import { BadgeControl } from '@/features/shared/ui/status';
/**
 * Amendment Metadata Component
 *
 * Displays amendment-specific metadata including code, status, and collaborators list.
 */

import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';

interface Collaborator {
  id: string;
  user?: {
    id: string;
    name?: string;
    avatar?: string;
  };
  status?: string;
}

interface AmendmentMetadataProps {
  /** Amendment code (e.g., "A-2024-001") */
  code?: string;
  /** Amendment status */
  status?: string;
  /** List of collaborators */
  collaborators?: Collaborator[];
  /** Whether to show the collaborators list */
  showCollaborators?: boolean;
}

export function AmendmentMetadata({
  code,
  status,
  collaborators = [],
  showCollaborators = true,
}: AmendmentMetadataProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      {/* Amendment metadata badges */}
      <div className="flex flex-wrap items-center gap-4 text-sm">
        {code && (
          <BadgeControl variant="secondary" textStyle="mono">
            {code}
          </BadgeControl>
        )}
        {status && (
          <BadgeControl variant="outline" textTransform="capitalize">
            {status}
          </BadgeControl>
        )}
      </div>

      {/* Collaborators list */}
      {showCollaborators && collaborators.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-sm">
            {t('features.editor.metadata.collaborators')}:
          </span>
          {collaborators.map(collab => (
            <div
              key={collab.id}
              className="bg-muted flex items-center gap-1 rounded-full px-2 py-1"
            >
              <Avatar className="h-5 w-5">
                {collab.user?.avatar ? (
                  <AvatarImage src={collab.user.avatar} alt={collab.user.name || ''} />
                ) : null}
                <AvatarFallback className="text-xs">
                  {collab.user?.name?.[0]?.toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs">
                {collab.user?.name || translateText('generated.inline.0031_unknown_bc7819b3')}
              </span>
              {collab.status && collab.status !== 'member' && (
                <BadgeControl variant="outline" size="tiny" className="ml-1 h-4 px-1">
                  {collab.status}
                </BadgeControl>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
