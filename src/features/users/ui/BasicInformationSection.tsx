import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { hasMinLength, isOptionalMinLength } from '@/features/shared/logic/inputValidation';
import { SelectField } from '@/features/shared/ui/form/SelectField';
import { ValidatedInputField } from '@/features/shared/ui/form/ValidatedInputField';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { UserGenderFormValue } from '../hooks/useUserProfileForm';

interface BasicInformationSectionProps {
  firstName: string;
  lastName: string;
  gender: UserGenderFormValue;
  subtitle: string;
  onFirstNameChange: (value: string) => void;
  onLastNameChange: (value: string) => void;
  onGenderChange: (value: UserGenderFormValue) => void;
  onSubtitleChange: (value: string) => void;
}

export function BasicInformationSection({
  firstName,
  lastName,
  gender,
  subtitle,
  onFirstNameChange,
  onLastNameChange,
  onGenderChange,
  onSubtitleChange,
}: BasicInformationSectionProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('pages.user.settingsForm.basicInfo.title')}</CardTitle>
        <CardDescription>{t('pages.user.settingsForm.basicInfo.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <ValidatedInputField
            id="firstName"
            label={t('pages.user.settingsForm.basicInfo.firstNameLabel')}
            value={firstName}
            onChange={onFirstNameChange}
            placeholder={t('pages.user.settingsForm.basicInfo.firstNamePlaceholder')}
            validator={value => hasMinLength(value, 2)}
            hint={t('common.validation.firstNameHint')}
            autoComplete="given-name"
            required
          />
          <ValidatedInputField
            id="lastName"
            label={t('pages.user.settingsForm.basicInfo.lastNameLabel')}
            value={lastName}
            onChange={onLastNameChange}
            placeholder={t('pages.user.settingsForm.basicInfo.lastNamePlaceholder')}
            validator={value => isOptionalMinLength(value, 2)}
            hint={t('common.validation.lastNameHint')}
            autoComplete="family-name"
          />
        </div>
        <SelectField
          label={t('pages.user.settingsForm.basicInfo.genderLabel', 'Gender')}
          description={t(
            'pages.user.settingsForm.basicInfo.genderDescription',
            'Wird fuer genderquotierte Redelisten verwendet.'
          )}
          value={gender}
          onValueChange={value => onGenderChange(value as UserGenderFormValue)}
          options={[
            {
              value: 'unspecified',
              label: t('pages.user.settingsForm.basicInfo.genderUnspecified', 'Keine Angabe'),
            },
            {
              value: 'female',
              label: t('pages.user.settingsForm.basicInfo.genderFemale', 'Weiblich'),
            },
            {
              value: 'male',
              label: t('pages.user.settingsForm.basicInfo.genderMale', 'Maennlich'),
            },
            {
              value: 'diverse',
              label: t('pages.user.settingsForm.basicInfo.genderDiverse', 'Divers'),
            },
          ]}
        />
        <ValidatedInputField
          id="subtitle"
          label={t('pages.user.settingsForm.basicInfo.subtitleLabel')}
          value={subtitle}
          onChange={onSubtitleChange}
          placeholder={t('pages.user.settingsForm.basicInfo.subtitlePlaceholder')}
          validator={value => isOptionalMinLength(value, 3)}
          hint={t('common.validation.subtitleHint')}
        />
      </CardContent>
    </Card>
  );
}
