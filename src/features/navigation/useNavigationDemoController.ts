import { useState, useEffect } from 'react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { NavigationType, ScreenType } from '@/features/navigation/types/navigation.types.tsx';
import { useIsMobileScreen } from '@/features/shared/hooks/useIsMobileScreen';

export function useNavigationDemoController({
  onScreenTypeChange,
  onPriorityChange,
}: {
  onScreenTypeChange?: (screenType: ScreenType) => void;
  onPriorityChange?: (priority: NavigationType) => void;
}) {
  const { t } = useTranslation();

  const isMobile = useIsMobileScreen();

  const [screenType, setScreenType] = useState<ScreenType>('automatic');

  const [actualScreen, setActualScreen] = useState<'mobile' | 'desktop'>('desktop');

  const [priority, setPriority] = useState<NavigationType>('combined');

  // Handle screen type changes
  const handleScreenTypeChange = (type: ScreenType) => {
    setScreenType(type);
    if (onScreenTypeChange) {
      onScreenTypeChange(type);
    }
  };

  // Handle priority changes
  const handlePriorityChange = (type: NavigationType) => {
    setPriority(type);
    if (onPriorityChange) {
      onPriorityChange(type);
    }
  };

  // Update actual screen type based on screenType selection and device
  useEffect(() => {
    if (screenType === 'automatic') {
      setActualScreen(isMobile ? 'mobile' : 'desktop');
    } else {
      setActualScreen(screenType);
    }
  }, [screenType, isMobile]);

  return {
    onScreenTypeChange,
    onPriorityChange,
    t,
    isMobile,
    screenType,
    setScreenType,
    actualScreen,
    setActualScreen,
    priority,
    setPriority,
    handleScreenTypeChange,
    handlePriorityChange,
  };
}
