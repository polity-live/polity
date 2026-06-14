import { featureThemeClassName } from '@/features/shared/theme';
import { Circle, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { TodoStatus } from '../types/todo.types';

interface TodoStatusIconProps {
  status: TodoStatus;
}

export function TodoStatusIcon({ status }: TodoStatusIconProps) {
  switch (status) {
    case 'pending':
      return <Circle className="text-muted-foreground h-4 w-4" />;
    case 'in_progress':
      return <Clock className={featureThemeClassName('eventCancelEventDialogInfoIcon')} />;
    case 'completed':
      return (
        <CheckCircle2 className={featureThemeClassName('agendaAgendaElectionSectionSuccessIcon')} />
      );
    case 'cancelled':
      return <XCircle className={featureThemeClassName('paymentSubscriptionStatusDangerIcon')} />;
  }
}
