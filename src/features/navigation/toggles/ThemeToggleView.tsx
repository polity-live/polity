import { Laptop, Moon, Sun } from 'lucide-react';

import { NavigationIconToggleButton } from '@/features/shared/ui/navigation';
import { cn } from '@/features/shared/utils/utils.ts';
import type { Size } from '@/features/navigation/types/navigation.types.tsx';

interface ThemeToggleViewProps {
  size?: Size;
  className?: string;
  currentTheme: string;
  labels: {
    light: string;
    dark: string;
    system: string;
  };
  onLight: () => void;
  onDark: () => void;
  onSystem: () => void;
}

export function ThemeToggleView({
  size = 'default',
  className,
  currentTheme,
  labels,
  onLight,
  onDark,
  onSystem,
}: ThemeToggleViewProps) {
  return (
    <div className={cn('flex gap-1', className)}>
      <NavigationIconToggleButton
        data-action-id="navigation.theme.light.select"
        value="light"
        currentValue={currentTheme}
        onClick={onLight}
        icon={Sun}
        title={labels.light}
        size={size}
      />
      <NavigationIconToggleButton
        data-action-id="navigation.theme.dark.select"
        value="dark"
        currentValue={currentTheme}
        onClick={onDark}
        icon={Moon}
        title={labels.dark}
        size={size}
      />
      <NavigationIconToggleButton
        data-action-id="navigation.theme.system.select"
        value="system"
        currentValue={currentTheme}
        onClick={onSystem}
        icon={Laptop}
        title={labels.system}
        size={size}
      />
    </div>
  );
}
