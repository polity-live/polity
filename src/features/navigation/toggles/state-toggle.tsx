import { AlignLeft, Circle, Menu } from 'lucide-react';
import { NavigationIconToggleButton } from '@/features/shared/ui/navigation';
import { cn } from '@/features/shared/utils/utils.ts';
import { useTranslation } from '@/features/shared/hooks/use-translation.ts';
import type { NavigationView, Size } from '@/features/navigation/types/navigation.types.tsx';

export function StateToggle({
  currentState,
  onStateChange,
  size = 'default',
  className,
}: {
  currentState: NavigationView;
  onStateChange: (state: NavigationView) => void;
  size?: Size;
  className?: string;
}) {
  const { t } = useTranslation();
  const stateIcons = {
    asButton: Circle,
    asButtonList: Menu,
    asLabeledButtonList: AlignLeft,
  };

  return (
    <div className={cn('flex gap-1', className)}>
      <NavigationIconToggleButton
        value="asButton"
        currentValue={currentState}
        onClick={() => onStateChange('asButton')}
        icon={stateIcons.asButton}
        title={t('navigation.toggles.state.asButton')}
        size={size}
      />
      <NavigationIconToggleButton
        value="asButtonList"
        currentValue={currentState}
        onClick={() => onStateChange('asButtonList')}
        icon={stateIcons.asButtonList}
        title={t('navigation.toggles.state.asButtonList')}
        size={size}
      />
      <NavigationIconToggleButton
        value="asLabeledButtonList"
        currentValue={currentState}
        onClick={() => onStateChange('asLabeledButtonList')}
        icon={stateIcons.asLabeledButtonList}
        title={t('navigation.toggles.state.asLabeledButtonList')}
        size={size}
      />
    </div>
  );
}
