'use client';

import { useState } from 'react';
import { Button } from '@/features/shared/ui/ui/button';
import { Input } from '@/features/shared/ui/ui/input';
import { Label } from '@/features/shared/ui/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/features/shared/ui/ui/card';
import { Loader2, Mail } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useAuth } from '@/providers/auth-provider';
import { useAccountActions } from '@/features/auth/hooks/useAccountActions';
import { CurrentPasswordConfirmationDialog } from './CurrentPasswordConfirmationDialog';
import { useDebounce } from '@/features/shared/hooks/use-debounce';
import { cn } from '@/features/shared/utils/utils.ts';
import { isValidEmailAddress } from '@/features/auth/logic/authValidation';

export function AccountEmailSection() {
  const { t } = useTranslation();
  const { user, authStateLoading } = useAuth();
  const { isUpdating, updateAccountEmail } = useAccountActions();

  const [newEmail, setNewEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const requiresInitialPassword = user?.hasPassword === false;
  const trimmedNewEmail = newEmail.trim();
  const debouncedNewEmail = useDebounce(trimmedNewEmail);
  const emailIsValid = isValidEmailAddress(trimmedNewEmail);

  const isValid =
    trimmedNewEmail.length > 0 &&
    trimmedNewEmail !== user?.email &&
    emailIsValid;
  const showEmailError =
    emailTouched && debouncedNewEmail.length > 0 && !isValidEmailAddress(debouncedNewEmail);
  const showEmailSuccess =
    emailTouched &&
    debouncedNewEmail.length > 0 &&
    isValidEmailAddress(debouncedNewEmail) &&
    debouncedNewEmail !== (user?.email ?? '');

  const resetForm = () => {
    setNewEmail('');
    setError(null);
    setEmailTouched(false);
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (isUpdating) {
      return;
    }

    setIsDialogOpen(open);

    if (!open) {
      setCurrentPassword('');
      setDialogError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setEmailTouched(true);

    if (!trimmedNewEmail) return;

    if (!emailIsValid) {
      setError(t('auth.signUp.emailHint'));
      return;
    }

    setCurrentPassword('');
    setDialogError(null);
    setIsDialogOpen(true);
  };

  const handleConfirm = async () => {
    const result = await updateAccountEmail(trimmedNewEmail, currentPassword);
    if (result.success) {
      resetForm();
      handleDialogOpenChange(false);
      return;
    }

    setDialogError(result.error ?? null);
  };

  return (
    <>
      <Card className="border-destructive ring-[3px] ring-destructive/20 dark:ring-destructive/40">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            <CardTitle>{t('pages.user.accountEmail.title')}</CardTitle>
          </div>
          <CardDescription>{t('pages.user.accountEmail.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('pages.user.accountEmail.currentEmail')}</Label>
              <Input value={user?.email ?? ''} disabled className="bg-muted" />
            </div>

            {requiresInitialPassword ? (
              <p className="text-sm text-muted-foreground">
                {t('pages.user.accountEmail.initialPasswordRequired')}
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-email">{t('pages.user.accountEmail.newEmail')}</Label>
                  <Input
                    id="new-email"
                    type="email"
                    placeholder={t('pages.user.accountEmail.newEmailPlaceholder')}
                    value={newEmail}
                    onChange={e => {
                      setNewEmail(e.target.value);
                      setEmailTouched(true);
                      setError(null);
                    }}
                    onBlur={() => setEmailTouched(true)}
                    required
                    disabled={isUpdating || authStateLoading}
                    autoComplete="email"
                    aria-invalid={showEmailError}
                    data-valid={showEmailSuccess ? 'true' : undefined}
                  />
                  <p
                    className={cn(
                      'text-xs text-muted-foreground',
                      showEmailError && 'text-destructive',
                      showEmailSuccess && 'text-emerald-600 dark:text-emerald-400'
                    )}
                  >
                    {t('auth.signUp.emailHint')}
                  </p>
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <Button type="submit" disabled={!isValid || isUpdating || authStateLoading}>
                  {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isUpdating
                    ? t('pages.user.accountEmail.updating')
                    : t('pages.user.accountEmail.update')}
                </Button>
              </form>
            )}
          </div>
        </CardContent>
      </Card>

      {requiresInitialPassword ? null : (
        <CurrentPasswordConfirmationDialog
          open={isDialogOpen}
          isSubmitting={isUpdating}
          password={currentPassword}
          error={dialogError}
          onOpenChange={handleDialogOpenChange}
          onPasswordChange={value => {
            setCurrentPassword(value);
            setDialogError(null);
          }}
          onConfirm={handleConfirm}
        />
      )}
    </>
  );
}
