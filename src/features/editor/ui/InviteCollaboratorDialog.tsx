'use client';

import {
  useInviteCollaboratorModel,
  type InviteCollaboratorDialogProps,
} from '../hooks/useInviteCollaboratorModel';
import { InviteCollaboratorDialogView } from './InviteCollaboratorDialogView';

export function InviteCollaboratorDialog(props: InviteCollaboratorDialogProps) {
  const model = useInviteCollaboratorModel(props);

  return <InviteCollaboratorDialogView model={model} />;
}
