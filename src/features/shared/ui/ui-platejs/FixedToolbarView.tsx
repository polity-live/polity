import { Toolbar } from '@/features/shared/ui/layout';
import { cn } from '@/features/shared/utils/utils';
import { getPlateSurfaceClasses } from '@/features/shared/theme';
export interface FixedToolbarViewProps {
  props: any;
  className: any;
}

export function FixedToolbarView({ props, className }: FixedToolbarViewProps) {
  return <Toolbar {...props} className={cn(getPlateSurfaceClasses('toolbar'), className)} />;
}
