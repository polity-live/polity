import React from 'react';
import { Button } from '@/features/shared/ui/ui/button';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface WikiFollowButtonProps {
  following: boolean;
  onClick: () => void;
  className?: string;
}

/**
 * Dumb follow button for the user wiki.
 * Handles only display and click, not state.
 */
export const WikiFollowButton: React.FC<WikiFollowButtonProps> = ({
  following,
  onClick,
  className,
}) => (
  <Button
    variant={following ? 'outline' : 'default'}
    onClick={onClick}
    className={className}
    data-action-id="network.wiki-follow.toggle"
  >
    {following
      ? translateText('generated.inline.0117_following_90eeb100')
      : translateText('generated.inline.0118_follow_66587a7a')}
  </Button>
);
