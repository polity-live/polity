import type { ComponentType, ReactNode } from 'react';

import { X } from 'lucide-react';

import { Button } from '@/features/shared/ui/ui/button';
import { getMotionPreset } from '@/features/shared/theme';
import { cn } from '@/features/shared/utils/utils';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

type NavigationButtonSize = 'default' | 'small';

export function NavigationIconToggleButton<TValue extends string>({
  'data-action-id': actionId,
  value,
  currentValue,
  onClick,
  icon: Icon,
  title,
  size = 'default',
}: {
  'data-action-id'?: string;
  value: TValue;
  currentValue: TValue;
  onClick: () => void;
  icon: ComponentType<{ className?: string }>;
  title: string;
  size?: NavigationButtonSize;
}) {
  const isActive = currentValue === value;

  return (
    <Button
      variant={isActive ? 'default' : 'ghost'}
      size="icon"
      className={cn('h-8 w-8', getMotionPreset('press'), size === 'small' && 'h-6 w-6')}
      onClick={onClick}
      title={title}
      aria-label={title}
      data-action-id={actionId}
    >
      <Icon className={cn('h-4 w-4', size === 'small' && 'h-3 w-3')} />
    </Button>
  );
}

export function FloatingNavigationButton({
  'data-action-id': actionId,
  side,
  isExpanded,
  onExpand,
  onToggleExpanded,
  icon,
}: {
  'data-action-id'?: string;
  side: 'left' | 'right';
  isExpanded: boolean;
  onExpand: () => void;
  onToggleExpanded: () => void;
  icon: ReactNode;
}) {
  return (
    <Button
      variant="default"
      size="icon"
      className={cn(
        'fixed bottom-6 z-50 h-14 w-14 rounded-lg shadow-[var(--shadow-floating)]',
        getMotionPreset('hoverLift'),
        side === 'left' ? 'left-6' : 'right-6'
      )}
      onMouseEnter={onExpand}
      onClick={onToggleExpanded}
      aria-expanded={isExpanded}
      aria-label={translateText('navigation.toggles.state.toggleNavigation')}
      data-action-id={actionId}
    >
      {icon}
    </Button>
  );
}

export function NavigationCloseButton({
  'data-action-id': actionId,
  side,
  onClose,
  className,
}: {
  'data-action-id'?: string;
  side: 'left' | 'right';
  onClose: () => void;
  className?: string;
}) {
  return (
    <Button
      variant="outline"
      size="icon"
      className={cn(
        'absolute top-6 z-50 h-10 w-10 rounded-md shadow-[var(--shadow-card)]',
        getMotionPreset('press'),
        side === 'left' ? 'left-6' : 'right-6',
        className
      )}
      onClick={onClose}
      aria-label={translateText('navigation.toggles.state.closeNavigation')}
      data-action-id={actionId}
    >
      <X className="h-4 w-4" />
    </Button>
  );
}
