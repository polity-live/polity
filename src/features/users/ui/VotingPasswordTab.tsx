'use client';

import { useState } from 'react';
import { Button } from '@/features/shared/ui/ui/button';
import { Input } from '@/features/shared/ui/ui/input';
import { Label } from '@/features/shared/ui/ui/label';
import { Badge } from '@/features/shared/ui/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { CheckCircle2, AlertCircle, Loader2, KeyRound } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useVotingPasswordActions } from '@/zero/voting-password/useVotingPasswordActions';
import { useVotingPasswordState } from '@/zero/voting-password/useVotingPasswordState';
import { useAccountActions } from '@/features/auth/hooks/useAccountActions';
import { CurrentPasswordConfirmationDialog } from './CurrentPasswordConfirmationDialog';
import { useAuth } from '@/providers/auth-provider';
import { useDebounce } from '@/features/shared/hooks/use-debounce';
import { cn } from '@/features/shared/utils/utils.ts';

interface VotingPasswordTabProps {
  userId: string;
}

export function VotingPasswordTab({ userId }: VotingPasswordTabProps) {
  const { t } = useTranslation();
  const { user, authStateLoading } = useAuth();
  const { setVotingPassword } = useVotingPasswordActions();
  const { verifyCurrentPassword } = useAccountActions();
  const { hasVotingPassword, isLoading: stateLoading } = useVotingPasswordState({ userId });

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmPasswordTouched, setConfirmPasswordTouched] = useState(false);
  const requiresInitialPassword = user?.hasPassword === false;
  const debouncedPassword = useDebounce(password);
  const debouncedConfirmPassword = useDebounce(confirmPassword);
  const passwordIsValid = /^\d{4}$/.test(password);
  const passwordsAreMatching =
    password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;

  const isValid = password.length === 4 && passwordIsValid && passwordsAreMatching;
  const showPasswordError =
    passwordTouched && debouncedPassword.length > 0 && !/^\d{4}$/.test(debouncedPassword);
  const showPasswordSuccess =
    passwordTouched && debouncedPassword.length > 0 && /^\d{4}$/.test(debouncedPassword);
  const showConfirmPasswordError =
    confirmPasswordTouched &&
    debouncedConfirmPassword.length > 0 &&
    !(
      debouncedPassword.length > 0 &&
      debouncedConfirmPassword.length > 0 &&
      debouncedPassword === debouncedConfirmPassword
    );
  const showConfirmPasswordSuccess =
    confirmPasswordTouched &&
    debouncedPassword.length > 0 &&
    debouncedConfirmPassword.length > 0 &&
    debouncedPassword === debouncedConfirmPassword;

  const resetForm = () => {
    setPassword('');
    setConfirmPassword('');
    setError(null);
    setPasswordTouched(false);
    setConfirmPasswordTouched(false);
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (isSubmitting) {
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

    if (!passwordsAreMatching) {
      setError(t('pages.user.votingPassword.mismatch'));
      return;
    }

    if (!passwordIsValid) {
      setError(t('pages.user.votingPassword.invalidFormat'));
      return;
    }

    setCurrentPassword('');
    setDialogError(null);
    setIsDialogOpen(true);
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      const verificationResult = await verifyCurrentPassword(currentPassword);
      if (!verificationResult.success) {
        setDialogError(verificationResult.error ?? null);
        return;
      }

      await setVotingPassword(password);
      resetForm();
      handleDialogOpenChange(false);
    } catch (submitError) {
      setDialogError(
        submitError instanceof Error
          ? submitError.message
          : t('pages.user.votingPassword.saveFailed')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-destructive ring-destructive/20 dark:ring-destructive/40 ring-[3px]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              <CardTitle>{t('pages.user.votingPassword.title')}</CardTitle>
            </div>
            {!stateLoading && (
              <Badge variant={hasVotingPassword ? 'default' : 'secondary'}>
                {hasVotingPassword ? (
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    {t('pages.user.votingPassword.set')}
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {t('pages.user.votingPassword.notSet')}
                  </span>
                )}
              </Badge>
            )}
          </div>
          <CardDescription>{t('pages.user.votingPassword.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          {requiresInitialPassword ? (
            <p className="text-muted-foreground text-sm">
              {t('pages.user.votingPassword.initialPasswordRequired')}
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="voting-password">
                  {hasVotingPassword
                    ? t('pages.user.votingPassword.newPassword')
                    : t('pages.user.votingPassword.setPassword')}
                </Label>
                <Input
                  id="voting-password"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  pattern="\d{4}"
                  placeholder="••••"
                  value={password}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setPassword(val);
                    setPasswordTouched(true);
                    setError(null);
                  }}
                  onBlur={() => setPasswordTouched(true)}
                  required
                  disabled={isSubmitting || authStateLoading}
                  aria-invalid={showPasswordError}
                  data-valid={showPasswordSuccess ? 'true' : undefined}
                />
                <p
                  className={cn(
                    'text-muted-foreground text-xs',
                    showPasswordError && 'text-destructive',
                    showPasswordSuccess && 'text-emerald-600 dark:text-emerald-400'
                  )}
                >
                  {t('pages.user.votingPassword.passwordHint')}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-voting-password">
                  {t('pages.user.votingPassword.confirmPassword')}
                </Label>
                <Input
                  id="confirm-voting-password"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  pattern="\d{4}"
                  placeholder="••••"
                  value={confirmPassword}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setConfirmPassword(val);
                    setConfirmPasswordTouched(true);
                    setError(null);
                  }}
                  onBlur={() => setConfirmPasswordTouched(true)}
                  required
                  disabled={isSubmitting || authStateLoading}
                  aria-invalid={showConfirmPasswordError}
                  data-valid={showConfirmPasswordSuccess ? 'true' : undefined}
                />
                <p
                  className={cn(
                    'text-muted-foreground text-xs',
                    showConfirmPasswordError && 'text-destructive',
                    showConfirmPasswordSuccess && 'text-emerald-600 dark:text-emerald-400'
                  )}
                >
                  {t('pages.user.votingPassword.confirmPasswordHint')}
                </p>
              </div>

              {error && <p className="text-destructive text-sm">{error}</p>}

              <Button type="submit" disabled={!isValid || isSubmitting || authStateLoading}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {hasVotingPassword
                  ? t('pages.user.votingPassword.update')
                  : t('pages.user.votingPassword.save')}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {requiresInitialPassword ? null : (
        <CurrentPasswordConfirmationDialog
          open={isDialogOpen}
          isSubmitting={isSubmitting}
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
    </div>
  );
}
