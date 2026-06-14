import { useFixedAgendaToolbarController } from '@/features/agendas/hooks/useFixedAgendaToolbarController';
import { Toolbar } from '@/features/shared/ui/layout';
import { FixedAgendaToolbarView } from './FixedAgendaToolbarView';

/**
 * Fixed-position toolbar for agenda pages.
 * Mirrors the PlateJS FixedToolbar — positioned between left/right sidebars,
 * horizontally scrollable when content overflows.
 */
export function FixedAgendaToolbar({
  children,
  className,
  ...props
}: React.ComponentProps<typeof Toolbar>) {
  const viewProps = useFixedAgendaToolbarController(className);

  return (
    <FixedAgendaToolbarView {...props} className={viewProps.className}>
      {children}
    </FixedAgendaToolbarView>
  );
}
