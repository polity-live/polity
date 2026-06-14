'use client';

import { useSubscribeAmendment } from '../hooks/useSubscribeAmendment';

interface AmendmentSubscribeButtonProps {
  amendmentId: string;
  onSubscribeChange?: (isSubscribed: boolean) => void;
}
import { AmendmentSubscribeButtonView } from './AmendmentSubscribeButtonView';
export function AmendmentSubscribeButton({
  amendmentId,
  onSubscribeChange,
}: AmendmentSubscribeButtonProps) {
  const { isSubscribed, toggleSubscribe, isLoading } = useSubscribeAmendment(amendmentId);

  const handleClick = async () => {
    await toggleSubscribe();
    onSubscribeChange?.(!isSubscribed);
  };
  return (
    <AmendmentSubscribeButtonView
      amendmentId={amendmentId}
      onSubscribeChange={onSubscribeChange}
      isSubscribed={isSubscribed}
      toggleSubscribe={toggleSubscribe}
      isLoading={isLoading}
      handleClick={handleClick}
    />
  );
}
