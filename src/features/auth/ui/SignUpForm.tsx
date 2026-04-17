'use client';

import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@/features/shared/ui/ui/button';
import { Input } from '@/features/shared/ui/ui/input';
import { Label } from '@/features/shared/ui/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { Alert, AlertDescription } from '@/features/shared/ui/ui/alert';
import { Loader2, UserPlus, ArrowRight } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useAuthStore } from '@/features/auth/auth.ts';
import { useAuthSignUp } from '@/features/auth/hooks/useAuthSignUp';
import { useGoogleAuth } from '@/features/auth/hooks/useGoogleAuth';
import { useDebounce } from '@/features/shared/hooks/use-debounce';
import { cn } from '@/features/shared/utils/utils.ts';
import {
  isValidEmailAddress,
  isValidPassword,
  passwordsMatch,
} from '@/features/auth/logic/authValidation';
import { GoogleIcon } from './GoogleIcon';
import { Link } from '@tanstack/react-router';

export function SignUpForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { error, clearError } = useAuthStore();
  const { isSigningUp, signUp } = useAuthSignUp();
  const { isRedirecting, continueWithGoogle } = useGoogleAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmPasswordTouched, setConfirmPasswordTouched] = useState(false);

  const trimmedEmail = email.trim();
  const debouncedEmail = useDebounce(trimmedEmail);
  const debouncedPassword = useDebounce(password);
  const debouncedConfirmPassword = useDebounce(confirmPassword);

  const emailIsValid = isValidEmailAddress(trimmedEmail);
  const passwordIsValid = isValidPassword(password);
  const passwordsAreMatching = passwordsMatch(password, confirmPassword);
  const isFormValid =
    trimmedEmail.length > 0 &&
    password.length > 0 &&
    confirmPassword.length > 0 &&
    emailIsValid &&
    passwordIsValid &&
    passwordsAreMatching;

  const showEmailError =
    emailTouched && debouncedEmail.length > 0 && !isValidEmailAddress(debouncedEmail);
  const showEmailSuccess =
    emailTouched && debouncedEmail.length > 0 && isValidEmailAddress(debouncedEmail);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();
    setEmailTouched(true);
    setPasswordTouched(true);
    setConfirmPasswordTouched(true);

    if (!trimmedEmail || !password || !confirmPassword) return;

    if (!emailIsValid) {
      setLocalError(t('auth.signUp.emailHint'));
      return;
    }

    if (!passwordIsValid) {
      setLocalError(t('auth.signUp.passwordTooShort'));
      return;
    }

    if (!passwordsAreMatching) {
      setLocalError(t('auth.signUp.passwordMismatch'));
      return;
    }

    const result = await signUp(trimmedEmail, password);

    if (result.success) {
      sessionStorage.setItem('polity_onboarding', 'true');
      navigate({ to: '/' });
    } else {
      setLocalError(result.error ?? null);
    }
  };

  const handleGoogleAuth = async () => {
    setLocalError(null);
    clearError();
    await continueWithGoogle('sign-up');
  };

  const displayError = localError || error;
  const isLoading = isSigningUp || isRedirecting;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4 dark:from-gray-900 dark:to-gray-800">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <UserPlus className="h-12 w-12 text-blue-500" />
          </div>
          <CardTitle className="text-2xl font-bold">{t('auth.signUp.title')}</CardTitle>
          <CardDescription>{t('auth.signUp.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.signUp.emailLabel')}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t('auth.signUp.emailPlaceholder')}
                value={email}
                onChange={e => {
                  setEmail(e.target.value);
                  setEmailTouched(true);
                  setLocalError(null);
                }}
                onBlur={() => setEmailTouched(true)}
                required
                disabled={isLoading}
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

            <div className="space-y-2">
              <Label htmlFor="password">{t('auth.signUp.passwordLabel')}</Label>
              <Input
                id="password"
                type="password"
                placeholder={t('auth.signUp.passwordPlaceholder')}
                value={password}
                onChange={e => {
                  setPassword(e.target.value);
                  setPasswordTouched(true);
                  setLocalError(null);
                }}
                onBlur={() => setPasswordTouched(true)}
                required
                minLength={6}
                disabled={isLoading}
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
              <Label htmlFor="confirm-password">{t('auth.signUp.confirmPasswordLabel')}</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder={t('auth.signUp.confirmPasswordPlaceholder')}
                value={confirmPassword}
                onChange={e => {
                  setConfirmPassword(e.target.value);
                  setConfirmPasswordTouched(true);
                  setLocalError(null);
                }}
                onBlur={() => setConfirmPasswordTouched(true)}
                required
                minLength={6}
                disabled={isLoading}
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

            {displayError && (
              <Alert variant="destructive">
                <AlertDescription>{displayError}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || !isFormValid}
            >
              {isSigningUp ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('auth.signUp.submitting')}
                </>
              ) : (
                <>
                  {t('auth.signUp.submit')}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <Button
            type="button"
            className="mt-4 w-full border border-[#dadce0] bg-white text-[#3c4043] hover:bg-[#f8f9fa] dark:border-[#5f6368] dark:bg-[#202124] dark:text-[#e8eaed] dark:hover:bg-[#303134]"
            onClick={handleGoogleAuth}
            disabled={isLoading}
          >
            {isRedirecting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <GoogleIcon className="mr-2 h-5 w-5" />
            )}
            {isRedirecting ? t('auth.signUp.googleLoading') : t('auth.signUp.googleButton')}
          </Button>

          <div className="text-muted-foreground mt-6 text-center text-sm">
            <p>
              {t('auth.signUp.hasAccount')}{' '}
              <Link
                to="/auth/sign-in"
                className="text-primary font-medium underline-offset-4 hover:underline"
              >
                {t('auth.signUp.signInLink')}
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
