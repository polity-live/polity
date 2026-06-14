import { featureThemeClassName } from '@/features/shared/theme';
import type { ClipboardEvent, KeyboardEvent } from 'react';
import { ArrowLeft, RotateCcw, Shield } from 'lucide-react';

import {
  FormButton,
  FormCard,
  FormControlInput,
  FormControlLabel,
} from '@/features/shared/ui/form';
import { InlineNotice, Spinner } from '@/features/shared/ui/feedback';

interface VerifyFormCopy {
  title: string;
  description: string;
  codeLabel: string;
  verifying: string;
  submit: string;
  back: string;
  resend: string;
  checkSpam: string;
  devNote: string;
}

interface VerifyFormViewProps {
  copy: VerifyFormCopy;
  email: string;
  code: string[];
  displayError: string | null;
  isVerifying: boolean;
  isResending: boolean;
  setInputRef: (index: number, element: HTMLInputElement | null) => void;
  onCodeChange: (index: number, value: string) => void;
  onCodeKeyDown: (index: number, event: KeyboardEvent<HTMLInputElement>) => void;
  onCodePaste: (event: ClipboardEvent<HTMLInputElement>) => void;
  onVerify: () => void;
  onResendCode: () => void;
  onBackToEmail: () => void;
}

export function VerifyFormView({
  copy,
  email,
  code,
  displayError,
  isVerifying,
  isResending,
  setInputRef,
  onCodeChange,
  onCodeKeyDown,
  onCodePaste,
  onVerify,
  onResendCode,
  onBackToEmail,
}: VerifyFormViewProps) {
  return (
    <FormCard
      title={copy.title}
      description={
        <>
          {copy.description} <strong>{email}</strong>
        </>
      }
      icon={<Shield className={featureThemeClassName('authForgotPasswordFormInfoIcon')} />}
      contentClassName="space-y-6"
    >
      <div className="space-y-2">
        <FormControlLabel>{copy.codeLabel}</FormControlLabel>
        <div className="flex justify-center gap-2">
          {code.map((digit, index) => (
            <FormControlInput
              key={index}
              ref={element => setInputRef(index, element)}
              type="text"
              inputMode="numeric"
              maxLength={1}
              className="h-12 w-12 text-center text-lg font-semibold"
              value={digit}
              onChange={event => onCodeChange(index, event.target.value)}
              onKeyDown={event => onCodeKeyDown(index, event)}
              onPaste={index === 0 ? onCodePaste : undefined}
              disabled={isVerifying}
            />
          ))}
        </div>
      </div>

      {displayError ? <InlineNotice variant="destructive">{displayError}</InlineNotice> : null}

      <div className="space-y-3">
        <FormButton
          type="button"
          onClick={onVerify}
          className="w-full"
          disabled={isVerifying || code.some(digit => digit === '')}
        >
          {isVerifying ? (
            <>
              <Spinner className="mr-2" />
              {copy.verifying}
            </>
          ) : (
            copy.submit
          )}
        </FormButton>

        <div className="flex gap-2">
          <FormButton
            type="button"
            variant="outline"
            onClick={onBackToEmail}
            className="flex-1"
            disabled={isVerifying}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {copy.back}
          </FormButton>

          <FormButton
            type="button"
            variant="outline"
            onClick={onResendCode}
            disabled={isVerifying || isResending}
            className="flex-1"
          >
            {isResending ? <Spinner className="mr-2" /> : <RotateCcw className="mr-2 h-4 w-4" />}
            {copy.resend}
          </FormButton>
        </div>
      </div>

      <div className="text-muted-foreground text-center text-sm">
        <p>{copy.checkSpam}</p>
        <p className="mt-1">
          {copy.devNote} <code className="bg-muted rounded px-1">123456</code>
        </p>
      </div>
    </FormCard>
  );
}

export type { VerifyFormCopy };
