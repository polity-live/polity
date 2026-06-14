import { Toaster as Sonner, toast } from 'sonner';
import { useToasterController } from '@/features/shared/hooks/useToasterController';
import { ToasterView } from './ToasterView';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ toastOptions, ...props }: ToasterProps) => {
  const { theme } = useToasterController();
  return (
    <ToasterView theme={theme as ToasterProps['theme']} toastOptions={toastOptions} {...props} />
  );
};

export { Toaster, toast };
export type { ExternalToast } from 'sonner';
