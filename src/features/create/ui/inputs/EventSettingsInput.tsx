import { HashtagEditor } from '@/features/shared/ui/hashtags';
import type { Visibility } from '@/features/auth/logic/checkEntityAccess';
import { SwitchField } from '@/features/shared/ui/form';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { VisibilityInput } from './VisibilityInput';

interface EventSettingsInputProps {
  showVisibility: boolean;
  visibility: Visibility;
  genderQuotaEnabled?: boolean;
  hashtags: string[];
  hashtagPlaceholder: string;
  preferredHashtagSuggestions?: string[];
  onVisibilityChange: (value: Visibility) => void;
  onGenderQuotaEnabledChange?: (checked: boolean) => void;
  onHashtagsChange: (value: string[]) => void;
}

export function EventSettingsInput({
  showVisibility,
  visibility,
  genderQuotaEnabled = false,
  hashtags,
  hashtagPlaceholder,
  preferredHashtagSuggestions,
  onVisibilityChange,
  onGenderQuotaEnabledChange,
  onHashtagsChange,
}: EventSettingsInputProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      {showVisibility ? <VisibilityInput value={visibility} onChange={onVisibilityChange} /> : null}
      {onGenderQuotaEnabledChange ? (
        <SwitchField
          id="genderQuotaEnabled"
          label={t('features.events.agenda.genderQuota.settingsLabel', 'Genderquotierte Redeliste')}
          description={t(
            'features.events.agenda.genderQuota.settingsDescription',
            'Wenn aktiv, muessen sich maennliche und weibliche Redebeitraege abwechseln.'
          )}
          checked={genderQuotaEnabled}
          onCheckedChange={onGenderQuotaEnabledChange}
        />
      ) : null}
      <HashtagEditor
        value={hashtags}
        onChange={onHashtagsChange}
        placeholder={hashtagPlaceholder}
        preferredSuggestions={preferredHashtagSuggestions}
      />
    </div>
  );
}
