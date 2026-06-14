import { useLanguageToggleController } from '@/features/navigation/hooks/useLanguageToggleController';
import type { Size } from '@/features/navigation/types/navigation.types.tsx';
import { LanguageToggleView } from './LanguageToggleView';

export function LanguageToggle({
  size = 'default',
  className,
  side = 'top',
  sideOffset = 8,
  variant = 'popover',
}: {
  size?: Size;
  className?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  sideOffset?: number;
  variant?: 'popover' | 'dropdown';
}) {
  return (
    <LanguageToggleView
      size={size}
      className={className}
      side={side}
      sideOffset={sideOffset}
      variant={variant}
      {...useLanguageToggleController()}
    />
  );
}
