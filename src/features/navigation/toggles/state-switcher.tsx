import { useStateSwitcherController } from '@/features/navigation/hooks/useStateSwitcherController';
import type { NavigationType } from '@/features/navigation/types/navigation.types.tsx';
import { StateSwitcherView } from './StateSwitcherView';

export const StateSwitcher: React.FC<{
  isMobile: boolean;
  navigationType: NavigationType;
}> = ({ isMobile, navigationType: navigationType }) => {
  const viewProps = useStateSwitcherController({ isMobile, navigationType });

  return <StateSwitcherView {...viewProps} isMobile={isMobile} />;
};
