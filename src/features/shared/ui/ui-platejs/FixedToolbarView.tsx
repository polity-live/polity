import { Toolbar } from '@/features/shared/ui/layout';
export interface FixedToolbarViewProps {
  props: any;
  className: any;
}

export function FixedToolbarView({ props, className }: FixedToolbarViewProps) {
  return <Toolbar {...props} className={className} />;
}
