import { useFixedToolbarController } from '@/features/shared/hooks/useFixedToolbarController';

import { Toolbar } from '@/features/shared/ui/layout';

export function FixedToolbar(props: React.ComponentProps<typeof Toolbar>) {
  const { className } = useFixedToolbarController(props.className);

  return <Toolbar {...props} className={className} />;
}
