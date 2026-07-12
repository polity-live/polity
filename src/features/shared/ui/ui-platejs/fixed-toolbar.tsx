import { useFixedToolbarController } from '@/features/shared/hooks/useFixedToolbarController';

import { Toolbar } from '@/features/shared/ui/layout';
import { FixedToolbarView } from './FixedToolbarView';
import { cn } from '@/features/shared/utils/utils';
export function FixedToolbar({
  positionMode = 'viewport',
  ...props
}: React.ComponentProps<typeof Toolbar> & {
  positionMode?: 'viewport' | 'container';
}) {
  return positionMode === 'container' ? (
    <ContainedFixedToolbar props={props} />
  ) : (
    <ViewportFixedToolbar props={props} />
  );
}

function ViewportFixedToolbar({ props }: { props: React.ComponentProps<typeof Toolbar> }) {
  const { className } = useFixedToolbarController(props.className);
  return <FixedToolbarView props={props} className={className} />;
}

function ContainedFixedToolbar({ props }: { props: React.ComponentProps<typeof Toolbar> }) {
  return (
    <FixedToolbarView
      props={props}
      className={cn(
        'scrollbar-hide supports-backdrop-blur:bg-background/60 border-b-border bg-background/95 sticky top-0 right-auto left-auto z-50 w-full justify-between overflow-x-auto border-b p-1 backdrop-blur-sm',
        props.className
      )}
    />
  );
}
