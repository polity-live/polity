'use client';

import { Button } from '@/features/shared/ui/ui/button';
import { Bell, BellOff } from 'lucide-react';
import { useSubscribeBlog } from '../hooks/useSubscribeBlog';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface BlogSubscribeButtonProps {
  blogId: string;
  onSubscribeChange?: (isSubscribed: boolean) => void;
}

export function BlogSubscribeButton({ blogId, onSubscribeChange }: BlogSubscribeButtonProps) {
  const { isSubscribed, toggleSubscribe, isLoading } = useSubscribeBlog(blogId);

  const handleClick = async () => {
    await toggleSubscribe();
    onSubscribeChange?.(!isSubscribed);
  };

  return (
    <Button onClick={handleClick} disabled={isLoading} variant="outline">
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
