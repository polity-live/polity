import { useThemeToggleController } from '@/features/navigation/hooks/useThemeToggleController';
import type { Size } from '@/features/navigation/types/navigation.types.tsx';
import { ThemeToggleView } from './ThemeToggleView';

export function ThemeToggle({ size = 'default', className }: { size?: Size; className?: string }) {
  const viewProps = useThemeToggleController();
  return <ThemeToggleView {...viewProps} size={size} className={className} />;
}
