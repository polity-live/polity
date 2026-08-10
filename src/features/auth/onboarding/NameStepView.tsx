import { ArrowRight, CheckCircle2, User } from 'lucide-react';

import { featureThemeClassName } from '@/features/shared/theme';
import { FormControlInput, FormControlLabel } from '@/features/shared/ui/form';
import { BadgeControl } from '@/features/shared/ui/status';
import { Button } from '@/features/shared/ui/ui/button.tsx';
import { cn } from '@/features/shared/utils/utils.ts';
import { OnboardingStepShell } from './OnboardingStepShell';

interface NameStepViewProps {
  firstName: string;
  lastName: string;
  isLoading?: boolean;
  firstNameRequirementText: string;
  firstNameShowError: boolean;
  firstNameShowSuccess: boolean;
  isFormValid: boolean;
  labels: {
    continue: string;
    description: string;
    firstName: string;
    firstNamePlaceholder: string;
    lastName: string;
    lastNamePlaceholder: string;
    title: string;
  };
  lastNameRequirementText: string;
  lastNameShowError: boolean;
  lastNameShowSuccess: boolean;
  onFirstNameBlur: () => void;
  onFirstNameInputChange: (value: string) => void;
  onLastNameBlur: () => void;
  onLastNameInputChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}

export function NameStepView({
  firstName,
  lastName,
  isLoading,
  firstNameRequirementText,
  firstNameShowError,
  firstNameShowSuccess,
  isFormValid,
  labels,
  lastNameRequirementText,
  lastNameShowError,
  lastNameShowSuccess,
  onFirstNameBlur,
  onFirstNameInputChange,
  onLastNameBlur,
  onLastNameInputChange,
  onSubmit,
}: NameStepViewProps) {
  const previewName =
    [firstName.trim(), lastName.trim()].filter(Boolean).join(' ') ||
    `${labels.firstName} ${labels.lastName}`;
  const previewInitials =
    `${firstName.trim().charAt(0)}${lastName.trim().charAt(0)}`.toUpperCase() || 'P';

  return (
    <OnboardingStepShell
      contentClassName="flex items-start lg:items-center"
      actions={
        <div className="flex flex-col sm:flex-row sm:justify-end">
          <Button
            form="onboarding-name-form"
            data-action-id="auth.onboarding.name.continue"
            type="submit"
            size="lg"
            className="w-full sm:w-auto"
            disabled={isLoading || !isFormValid}
          >
            {labels.continue}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      }
    >
      <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-6">
          <div>
            <div className="mb-4 flex">
              <div className={featureThemeClassName('authNameStepInfoAccentGradientSurface')}>
                <User className={featureThemeClassName('authGroupSearchStepContrastIcon')} />
              </div>
            </div>
            <h2 className="text-3xl leading-tight font-bold tracking-tight">{labels.title}</h2>
            <p className="text-muted-foreground mt-3 max-w-xl leading-7">{labels.description}</p>
          </div>

          <form
            id="onboarding-name-form"
            data-action-id="auth.onboarding.name.form.submit"
            onSubmit={onSubmit}
            className="space-y-5"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <FormControlLabel htmlFor="firstName">{labels.firstName}</FormControlLabel>
                <FormControlInput
                  id="firstName"
                  type="text"
                  placeholder={labels.firstNamePlaceholder}
                  value={firstName}
                  onChange={event => onFirstNameInputChange(event.target.value)}
                  onBlur={onFirstNameBlur}
                  disabled={isLoading}
                  autoComplete="given-name"
                  aria-invalid={firstNameShowError}
                  data-valid={firstNameShowSuccess ? 'true' : undefined}
                  autoFocus
                />
                <p
                  className={cn(
                    'text-muted-foreground text-xs',
                    firstNameShowError && 'text-destructive',
                    firstNameShowSuccess && featureThemeClassName('authNameStepSuccessText')
                  )}
                >
                  {firstNameRequirementText}
                </p>
              </div>

              <div className="space-y-2">
                <FormControlLabel htmlFor="lastName">{labels.lastName}</FormControlLabel>
                <FormControlInput
                  id="lastName"
                  type="text"
                  placeholder={labels.lastNamePlaceholder}
                  value={lastName}
                  onChange={event => onLastNameInputChange(event.target.value)}
                  onBlur={onLastNameBlur}
                  disabled={isLoading}
                  autoComplete="family-name"
                  aria-invalid={lastNameShowError}
                  data-valid={lastNameShowSuccess ? 'true' : undefined}
                />
                <p
                  className={cn(
                    'text-muted-foreground text-xs',
                    lastNameShowError && 'text-destructive',
                    lastNameShowSuccess && featureThemeClassName('authNameStepSuccessText')
                  )}
                >
                  {lastNameRequirementText}
                </p>
              </div>
            </div>
          </form>
        </div>

        <aside className="bg-card rounded-lg border p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <BadgeControl variant="secondary">Polity</BadgeControl>
            {isFormValid && <CheckCircle2 className="text-success h-5 w-5" />}
          </div>
          <div className="mt-8 flex items-center gap-4">
            <div className="bg-primary text-primary-foreground flex h-14 w-14 items-center justify-center rounded-lg text-lg font-bold">
              {previewInitials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">{previewName}</p>
              <p className="text-muted-foreground text-sm">
                @{previewName.toLowerCase().replace(/\s+/g, '-')}
              </p>
            </div>
          </div>
          <div className="mt-6 space-y-3 border-t pt-5">
            <div className="bg-muted h-2 w-2/3 rounded-full" />
            <div className="bg-muted h-2 w-full rounded-full" />
            <div className="bg-muted h-2 w-4/5 rounded-full" />
          </div>
        </aside>
      </div>
    </OnboardingStepShell>
  );
}
