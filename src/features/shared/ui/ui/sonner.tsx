import { useThemeStore } from '@/features/shared/global-state/theme.store.tsx';
import { Toaster as Sonner } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ toastOptions, ...props }: ToasterProps) => {
  const theme = useThemeStore(state => state.theme);

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      closeButton
      toastOptions={{
        ...toastOptions,
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          content: 'group-[.toast]:min-w-0 group-[.toast]:flex-1',
          actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
          closeButton:
            '!static !order-last !ml-3 !h-5 !w-5 !shrink-0 !self-start !transform-none group-[.toast]:border-border/60 group-[.toast]:bg-background/80 group-[.toast]:text-muted-foreground hover:text-foreground',
          ...toastOptions?.classNames,
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
