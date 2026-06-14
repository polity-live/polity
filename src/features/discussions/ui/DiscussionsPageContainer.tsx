interface DiscussionsPageContainerProps {
  amendmentId: string;
  userId?: string;
}
import { useDiscussionsPageContainerController } from './useDiscussionsPageContainerController';
import { DiscussionsPageContainerView } from './DiscussionsPageContainerView';

export function DiscussionsPageContainer({ amendmentId, userId }: DiscussionsPageContainerProps) {
  const viewProps = useDiscussionsPageContainerController({ amendmentId, userId });

  return <DiscussionsPageContainerView {...viewProps} />;
}
