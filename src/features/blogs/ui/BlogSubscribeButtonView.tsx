'use client';

import { Button } from '@/features/shared/ui/ui/button';
import { Bell, BellOff } from 'lucide-react';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
export interface BlogSubscribeButtonViewProps {
  blogId: any;
  onSubscribeChange: any;
  isSubscribed: any;
  toggleSubscribe: any;
  isLoading: any;
  handleClick: any;
}

export function BlogSubscribeButtonView({
  isSubscribed,
  isLoading,
  handleClick,
}: BlogSubscribeButtonViewProps) {
  return (
    <Button
      data-action-id="blogs.subscribe.toggle"
      onClick={handleClick}
      disabled={isLoading}
      variant="outline"
    >
      {isSubscribed ? (
        <>
          <BellOff className="mr-2 h-4 w-4" />
          {translateText('generated.inline.0169_unsubscribe_834cc0ee')}
        </>
      ) : (
        <>
          <Bell className="mr-2 h-4 w-4" />
          {translateText('generated.inline.0170_subscribe_d6981f74')}
        </>
      )}
    </Button>
  );
}
