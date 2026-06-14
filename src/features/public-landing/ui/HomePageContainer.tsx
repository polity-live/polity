import { useHomePageController } from '@/features/public-landing/hooks/useHomePageController';
import { HomePageContainerView } from './HomePageContainerView';
export function HomePageContainer() {
  const viewState = useHomePageController();
  return <HomePageContainerView viewState={viewState} />;
}
