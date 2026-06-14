'use client';

import { FormControlInput, FormControlLabel } from '@/features/shared/ui/form';
import { ScrollableDialogContent } from '@/features/shared/ui/dialog';
import { Loader2 } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/features/shared/ui/ui/dialog';

interface CurrentPasswordConfirmationDialogProps {
  open: boolean;
  isSubmitting: boolean;
  password: string;
  error?: string | null;
  onOpenChange: (open: boolean) => void;
  onPasswordChange: (value: string) => void;
  onConfirm: () => Promise<void> | void;
}

export function CurrentPasswordConfirmationDialog({
  open,
  isSubmitting,
  password,
  error,
  onOpenChange,
  onPasswordChange,
  onConfirm,
}: CurrentPasswordConfirmationDialogProps) {
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ScrollableDialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t('pages.user.securityConfirmation.title')}</DialogTitle>
            <DialogDescription>
              {t('pages.user.securityConfirmation.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <FormControlLabel htmlFor="current-account-password">
              {t('pages.user.securityConfirmation.currentPassword')}
            </FormControlLabel>
            <FormControlInput
              id="current-account-password"
              type="password"
              autoComplete="current-password"
              placeholder={t('pages.user.securityConfirmation.currentPasswordPlaceholder')}
              value={password}
              onChange={e => onPasswordChange(e.target.value)}
              autoFocus
            />
          </div>

          {error ? <p className="text-destructive text-sm">{error}</p> : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {t('common.actions.cancel')}
            </Button>
            <Button type="submit" disabled={password.length === 0 || isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isSubmitting
                ? t('pages.user.securityConfirmation.confirming')
                : t('pages.user.securityConfirmation.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </ScrollableDialogContent>
    </Dialog>
  );
}
