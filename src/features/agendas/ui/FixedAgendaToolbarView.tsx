import { Toolbar } from '@/features/shared/ui/layout';

export function FixedAgendaToolbarView({
  children,
  ...props
}: React.ComponentProps<typeof Toolbar>) {
  return <Toolbar {...props}>{children}</Toolbar>;
}
