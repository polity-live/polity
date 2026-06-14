import { useFixedToolbarController } from '@/features/shared/hooks/useFixedToolbarController';

import { Toolbar } from '@/features/shared/ui/layout';
import { FixedToolbarView } from './FixedToolbarView';
export function FixedToolbar(props: React.ComponentProps<typeof Toolbar>) {
  const { className } = useFixedToolbarController(props.className);
  return <FixedToolbarView props={props} className={className} />;
}
