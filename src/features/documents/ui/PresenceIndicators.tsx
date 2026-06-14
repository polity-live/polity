/**
 * Presence Indicators Component
 *
 * Displays online users/peers with avatars.
 */

import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { Users } from 'lucide-react';
import type { EditorPresencePeer } from '@/features/editor';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface PresenceIndicatorsProps {
  peers: EditorPresencePeer[];
}

export function PresenceIndicators({ peers }: PresenceIndicatorsProps) {
  if (peers.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <Users className="text-muted-foreground h-4 w-4" />
      <span className="text-muted-foreground text-sm">
        {peers.length}{' '}
        {peers.length === 1
          ? translateText('generated.inline.0026_user_12dea96f')
          : translateText('generated.inline.0027_users_5b7dcd14')}
        {translateText('generated.inline.0035_online_2dbc2fd2')}
      </span>
      <div className="flex -space-x-2">
        {peers.map(peer => (
          <Avatar
            key={peer.peerId}
            className="border-background h-6 w-6 border-2"
            title={peer.name}
          >
            {peer.avatar ? <AvatarImage src={peer.avatar} alt={peer.name} /> : null}
            <AvatarFallback style={{ backgroundColor: peer.color }} className="text-xs text-white">
              {peer.name?.[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
        ))}
      </div>
    </div>
  );
}
