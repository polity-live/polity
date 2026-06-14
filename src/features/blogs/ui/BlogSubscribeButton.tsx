'use client';

import { useSubscribeBlog } from '../hooks/useSubscribeBlog';

interface BlogSubscribeButtonProps {
  blogId: string;
  onSubscribeChange?: (isSubscribed: boolean) => void;
}
import { BlogSubscribeButtonView } from './BlogSubscribeButtonView';
export function BlogSubscribeButton({ blogId, onSubscribeChange }: BlogSubscribeButtonProps) {
  const { isSubscribed, toggleSubscribe, isLoading } = useSubscribeBlog(blogId);

  const handleClick = async () => {
    await toggleSubscribe();
    onSubscribeChange?.(!isSubscribed);
  };
  return (
    <BlogSubscribeButtonView
      blogId={blogId}
      onSubscribeChange={onSubscribeChange}
      isSubscribed={isSubscribed}
      toggleSubscribe={toggleSubscribe}
      isLoading={isLoading}
      handleClick={handleClick}
    />
  );
}
