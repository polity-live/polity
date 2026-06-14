import { BadgeControl } from '@/features/shared/ui/status';
import { FormControlInput } from '@/features/shared/ui/form';
/**
 * Document Header Component
 *
 * Displays document title, save status, and online users.
 */

import { Loader2, Eye } from 'lucide-react';
import { PresenceIndicators } from './PresenceIndicators';
import type { EditorPresencePeer } from '@/features/editor';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface DocumentHeaderProps {
  title: string;
  onTitleChange: (title: string) => void;
  isSaving: boolean;
  isOwner: boolean;
  onlinePeers: EditorPresencePeer[];
}

export function DocumentHeader({
  title,
  onTitleChange,
  isSaving,
  isOwner,
  onlinePeers,
}: DocumentHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <FormControlInput
            value={title}
            onChange={e => onTitleChange(e.target.value)}
            className="border-none px-0 text-2xl font-bold shadow-none focus-visible:ring-0"
            placeholder={translateText('generated.inline.0410_untitled_document_0654a04f')}
          />
        </div>
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          {isSaving ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>{translateText('generated.inline.0268_saving_ae7e8875')}</span>
            </>
          ) : (
            <>
              <Eye className="h-3 w-3" />
              <span>{translateText('generated.inline.0411_auto_save_enabled_914b94c9')}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <PresenceIndicators peers={onlinePeers} />
        {isOwner && (
          <BadgeControl variant="outline">
            {translateText('generated.inline.0412_owner_89ff3122')}
          </BadgeControl>
        )}
      </div>
    </div>
  );
}
