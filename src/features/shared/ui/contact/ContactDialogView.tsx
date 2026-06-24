import type { ReactNode } from 'react';
import { ExternalLink, Mail } from 'lucide-react';

import {
  GITHUB_ISSUES_URL,
  GITHUB_REPOSITORY_PATH,
  SUPPORT_EMAIL,
} from '@/features/shared/constants.ts';
import { useTranslation } from '@/features/shared/hooks/use-translation.ts';
import { Button } from '@/features/shared/ui/ui/button.tsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/features/shared/ui/ui/dialog.tsx';

interface ContactDialogViewProps {
  children: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContactDialogView({ children, open, onOpenChange }: ContactDialogViewProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('common.contactDialog.title')}</DialogTitle>
          <DialogDescription>{t('common.contactDialog.description')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 px-2 pt-2 sm:px-3">
          <Button
            variant="outline"
            className="h-auto min-h-16 w-full justify-start gap-4 px-5 py-4 text-left whitespace-normal has-[>svg]:px-5 sm:px-6 sm:has-[>svg]:px-6"
            asChild
          >
            <a href={`mailto:${SUPPORT_EMAIL}`}>
              <Mail className="h-4 w-4 shrink-0" />
              <div className="min-w-0 text-left">
                <div className="text-sm leading-snug font-medium">
                  {t('common.contactDialog.email')}
                </div>
                <div className="text-muted-foreground mt-0.5 text-xs leading-snug break-words">
                  {SUPPORT_EMAIL}
                </div>
              </div>
            </a>
          </Button>
          <Button
            variant="outline"
            className="h-auto min-h-16 w-full justify-start gap-4 px-5 py-4 text-left whitespace-normal has-[>svg]:px-5 sm:px-6 sm:has-[>svg]:px-6"
            asChild
          >
            <a href={GITHUB_ISSUES_URL} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 shrink-0" />
              <div className="min-w-0 text-left">
                <div className="text-sm leading-snug font-medium">
                  {t('common.contactDialog.github')}
                </div>
                <div className="text-muted-foreground mt-0.5 text-xs leading-snug break-words">
                  github.com/{GITHUB_REPOSITORY_PATH}
                </div>
              </div>
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
