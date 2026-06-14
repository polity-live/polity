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
        <div className="flex flex-col gap-3 pt-2">
          <Button variant="outline" className="w-full justify-start gap-3" asChild>
            <a href={`mailto:${SUPPORT_EMAIL}`}>
              <Mail className="h-4 w-4 shrink-0" />
              <div className="text-left">
                <div className="text-sm font-medium">{t('common.contactDialog.email')}</div>
                <div className="text-muted-foreground text-xs">{SUPPORT_EMAIL}</div>
              </div>
            </a>
          </Button>
          <Button variant="outline" className="w-full justify-start gap-3" asChild>
            <a href={GITHUB_ISSUES_URL} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 shrink-0" />
              <div className="text-left">
                <div className="text-sm font-medium">{t('common.contactDialog.github')}</div>
                <div className="text-muted-foreground text-xs">
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
