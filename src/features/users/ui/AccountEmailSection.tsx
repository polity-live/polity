'use client';

import { useState } from 'react';

import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useAuth } from '@/providers/auth-provider';
import { useAccountActions } from '@/features/auth/hooks/useAccountActions';
import { CurrentPasswordConfirmationDialog } from './CurrentPasswordConfirmationDialog';
import { useDebounce } from '@/features/shared/hooks/use-debounce';
import { isValidEmailAddress } from '@/features/auth/logic/authValidation';
import { AccountEmailSectionView, type AccountEmailSectionCopy } from './AccountEmailSectionView';

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

  return (
    <>
      <AccountEmailSectionView
        copy={copy}
        currentEmailValue={user?.email ?? ''}
        newEmail={newEmail}
        requiresInitialPassword={requiresInitialPassword}
        isBusy={isUpdating || authStateLoading}
        isValid={isValid}
        error={error}
        showEmailError={showEmailError}
        showEmailSuccess={showEmailSuccess}
        onSubmit={handleSubmit}
        onNewEmailChange={value => {
          setNewEmail(value);
          setEmailTouched(true);
          setError(null);
        }}
        onNewEmailBlur={() => setEmailTouched(true)}
      />

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
