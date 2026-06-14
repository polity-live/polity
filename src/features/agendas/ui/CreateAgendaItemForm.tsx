'use client';

import { useCreateAgendaItemFormController } from '../hooks/useCreateAgendaItemFormController';
import { CreateAgendaItemFormView } from './CreateAgendaItemFormView';

export function CreateAgendaItemForm() {
  const controller = useCreateAgendaItemFormController();

  return <CreateAgendaItemFormView controller={controller} />;
}
