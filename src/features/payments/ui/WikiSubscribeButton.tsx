import React from 'react';
import { Button } from '@/features/shared/ui/ui/button';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface WikiSubscribeButtonProps {
  subscribed: boolean;
  onClick: () => void;
  className?: string;
}

/**
 * Subscribe button for the user wiki.
 * Handles only display and click, not state.
 */
export const WikiSubscribeButton: React.FC<WikiSubscribeButtonProps> = ({
  subscribed,
  onClick,
  className,
}) => (
  <Button variant={subscribed ? 'outline' : 'default'} onClick={onClick} className={className}>
    {subscribed
      ? translateText('generated.inline.0131_unsubscribe_834cc0ee')
      : translateText('generated.inline.0128_subscribe_d6981f74')}
  </Button>
);
