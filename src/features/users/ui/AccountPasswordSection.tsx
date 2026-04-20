'use client';

import { useState } from 'react';
import { Button } from '@/features/shared/ui/ui/button';
import { Input } from '@/features/shared/ui/ui/input';
import { Label } from '@/features/shared/ui/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/features/shared/ui/ui/card';
import { Loader2, KeyRound } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useAccountActions } from '@/features/auth/hooks/useAccountActions';
import { CurrentPasswordConfirmationDialog } from './CurrentPasswordConfirmationDialog';
import { useAuth } from '@/providers/auth-provider';
import { useDebounce } from '@/features/shared/hooks/use-debounce';
import { cn } from '@/features/shared/utils/utils.ts';
import { isValidPassword, passwordsMatch } from '@/features/auth/logic/authValidation';

export function AccountPasswordSection() {
  const { t } = useTranslation();
  const { user, authStateLoading } = useAuth();
  const { isUpdating, updateAccountPassword } = useAccountActions();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmPasswordTouched, setConfirmPasswordTouched] = useState(false);
  const requiresInitialPassword = user?.hasPassword === false;
  const debouncedPassword = useDebounce(password);
  const debouncedConfirmPassword = useDebounce(confirmPassword);
  const passwordIsValid = isValidPassword(password);
  const passwordsAreMatching = passwordsMatch(password, confirmPassword);

  const isValid =
    password.length > 0 &&
    confirmPassword.length > 0 &&
    passwordIsValid &&
    passwordsAreMatching;
  const showPasswordError =
    passwordTouched && debouncedPassword.length > 0 && !isValidPassword(debouncedPassword);
  const showPasswordSuccess =
    passwordTouched && debouncedPassword.length > 0 && isValidPassword(debouncedPassword);
  const showConfirmPasswordError =
    confirmPasswordTouched &&
    debouncedConfirmPassword.length > 0 &&
    !passwordsMatch(debouncedPassword, debouncedConfirmPassword);
  const showConfirmPasswordSuccess =
    confirmPasswordTouched && passwordsMatch(debouncedPassword, debouncedConfirmPassword);

  const resetForm = () => {
    setPassword('');
    setConfirmPassword('');
    setError(null);
    setPasswordTouched(false);
    setConfirmPasswordTouched(false);
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
    setPasswordTouched(true);
    setConfirmPasswordTouched(true);

    if (!passwordIsValid) {
      setError(t('pages.user.accountPassword.tooShort'));
      return;
    }

    if (!passwordsAreMatching) {
      setError(t('pages.user.accountPassword.mismatch'));
      return;
    }

    if (requiresInitialPassword) {
      const result = await updateAccountPassword(password);
      if (result.success) {
        resetForm();
        return;
      }

      setError(result.error ?? null);
      return;
    }

    setCurrentPassword('');
    setDialogError(null);
    setIsDialogOpen(true);
  };

  const handleConfirm = async () => {
    const result = await updateAccountPassword(password, currentPassword);
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
            <KeyRound className="h-5 w-5" />
            <CardTitle>{t('pages.user.accountPassword.title')}</CardTitle>
          </div>
          <CardDescription>
            {requiresInitialPassword
              ? t('pages.user.accountPassword.initialDescription')
              : t('pages.user.accountPassword.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="account-password">{t('pages.user.accountPassword.newPassword')}</Label>
              <Input
                id="account-password"
                type="password"
                placeholder={t('pages.user.accountPassword.newPasswordPlaceholder')}
                value={password}
                onChange={e => {
                  setPassword(e.target.value);
                  setPasswordTouched(true);
                  setError(null);
                }}
                onBlur={() => setPasswordTouched(true)}
                minLength={6}
                required
                disabled={isUpdating || authStateLoading}
                autoComplete="new-password"
                aria-invalid={showPasswordError}
                data-valid={showPasswordSuccess ? 'true' : undefined}
              />
              <p
                className={cn(
                  'text-xs text-muted-foreground',
                  showPasswordError && 'text-destructive',
                  showPasswordSuccess && 'text-emerald-600 dark:text-emerald-400'
                )}
              >
                {t('auth.signUp.passwordHint')}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-password-confirm">
                {t('pages.user.accountPassword.confirmPassword')}
              </Label>
              <Input
                id="account-password-confirm"
                type="password"
                placeholder={t('pages.user.accountPassword.confirmPasswordPlaceholder')}
                value={confirmPassword}
                onChange={e => {
                  setConfirmPassword(e.target.value);
                  setConfirmPasswordTouched(true);
                  setError(null);
                }}
                onBlur={() => setConfirmPasswordTouched(true)}
                minLength={6}
                required
                disabled={isUpdating || authStateLoading}
                autoComplete="new-password"
                aria-invalid={showConfirmPasswordError}
                data-valid={showConfirmPasswordSuccess ? 'true' : undefined}
              />
              <p
                className={cn(
                  'text-xs text-muted-foreground',
                  showConfirmPasswordError && 'text-destructive',
                  showConfirmPasswordSuccess && 'text-emerald-600 dark:text-emerald-400'
                )}
              >
                {t('auth.signUp.confirmPasswordHint')}
              </p>
            </div>

            {requiresInitialPassword ? (
              <p className="text-sm text-muted-foreground">
                {t('pages.user.accountPassword.initialHelp')}
              </p>
            ) : null}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" disabled={!isValid || isUpdating || authStateLoading}>
              {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isUpdating ? t('pages.user.accountPassword.updating') : requiresInitialPassword
                ? t('pages.user.accountPassword.setInitialPassword')
                : t('pages.user.accountPassword.update')}
            </Button>
          </form>
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
