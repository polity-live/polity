import { useContactDialogController } from '@/features/shared/hooks/useContactDialogController';
import { ContactDialogView } from './ContactDialogView';

interface ContactDialogProps {
  children: React.ReactNode;
}

export function ContactDialog({ children }: ContactDialogProps) {
  return <ContactDialogView {...useContactDialogController()}>{children}</ContactDialogView>;
}
