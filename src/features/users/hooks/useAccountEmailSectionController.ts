import type { FormEvent } from 'react';
import { useState } from 'react';

import { useAccountActions } from '@/features/auth/hooks/useAccountActions';
import { isValidEmailAddress } from '@/features/auth/logic/authValidation';
import { useDebounce } from '@/features/shared/hooks/use-debounce';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useAuth } from '@/providers/auth-provider';
import type { AccountEmailSectionCopy } from '../ui/AccountEmailSectionView';

export function useAccountEmailSectionController() {
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

  const isValid = trimmedNewEmail.length > 0 && trimmedNewEmail !== user?.email && emailIsValid;
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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

  const copy: AccountEmailSectionCopy = {
    title: t('pages.user.accountEmail.title'),
    description: t('pages.user.accountEmail.description'),
    currentEmail: t('pages.user.accountEmail.currentEmail'),
    newEmail: t('pages.user.accountEmail.newEmail'),
    newEmailPlaceholder: t('pages.user.accountEmail.newEmailPlaceholder'),
    emailHint: t('auth.signUp.emailHint'),
    initialPasswordRequired: t('pages.user.accountEmail.initialPasswordRequired'),
    update: t('pages.user.accountEmail.update'),
    updating: t('pages.user.accountEmail.updating'),
  };

  return {
    accountEmailProps: {
      copy,
      currentEmailValue: user?.email ?? '',
      newEmail,
      requiresInitialPassword,
      isBusy: isUpdating || authStateLoading,
      isValid,
      error,
      showEmailError,
      showEmailSuccess,
      onSubmit: handleSubmit,
      onNewEmailChange: (value: string) => {
        setNewEmail(value);
        setEmailTouched(true);
        setError(null);
      },
      onNewEmailBlur: () => setEmailTouched(true),
    },
    confirmationDialogProps: {
      open: isDialogOpen,
      isSubmitting: isUpdating,
      password: currentPassword,
      error: dialogError,
      onOpenChange: handleDialogOpenChange,
      onPasswordChange: (value: string) => {
        setCurrentPassword(value);
        setDialogError(null);
      },
      onConfirm: handleConfirm,
    },
    requiresInitialPassword,
  };
}
