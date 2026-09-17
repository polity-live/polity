import { useRef, useState } from 'react';
import { Star } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { useWorkspacePreferences } from '@/zero/preferences/useWorkspacePreferences';
import type { WorkspaceFavorite } from '@/zero/preferences/workspace-schema';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { Button } from '../ui/button';
import { toast } from '../ui/sonner';

function ConnectedFavoriteButton({ favorite }: { favorite: WorkspaceFavorite }) {
  const { t } = useTranslation();
  const { favorites, setFavorite, isLoading } = useWorkspacePreferences();
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const active = favorites.some(item => item.href === favorite.href);
  const label = t(active ? 'common.workspace.unfavorite' : 'common.workspace.favorite');
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      aria-pressed={active}
      aria-disabled={isLoading || pending}
      className="aria-disabled:opacity-50"
      data-action-id="workspace.favorite.toggle"
      onClick={async () => {
        if (isLoading || busy.current) return;
        busy.current = true;
        setPending(true);
        try {
          await setFavorite(favorite, !active);
        } catch {
          toast.error(t('common.workspace.saveFailed'));
        } finally {
          busy.current = false;
          setPending(false);
        }
      }}
    >
      <Star
        className={
          active ? 'size-4 fill-current text-[var(--highlight)]' : 'text-muted-foreground size-4'
        }
      />
    </Button>
  );
}

export function FavoriteButton(props: { favorite: WorkspaceFavorite }) {
  const { user } = useAuth();
  return user ? <ConnectedFavoriteButton {...props} /> : null;
}
