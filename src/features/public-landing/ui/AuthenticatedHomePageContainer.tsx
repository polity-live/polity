import { useHomePageController } from '@/features/public-landing/hooks/useHomePageController';
import { HomePageContainerView } from './HomePageContainerView';

export default function AuthenticatedHomePageContainer() {
  const viewState = useHomePageController();
  return <HomePageContainerView viewState={viewState} />;
}
