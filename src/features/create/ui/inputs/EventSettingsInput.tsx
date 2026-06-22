import { HashtagEditor } from '@/features/shared/ui/hashtags';
import type { Visibility } from '@/features/auth/logic/checkEntityAccess';
import { SwitchField } from '@/features/shared/ui/form';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { VisibilityInput } from './VisibilityInput';
import { ChangeRequestVoteOrderInput } from './ChangeRequestVoteOrderInput';
import type { ChangeRequestVoteOrder } from '@/features/change-requests/logic/changeRequestVoteOrder';

interface EventSettingsInputProps {
  showVisibility: boolean;
  visibility: Visibility;
  genderQuotaEnabled?: boolean;
  changeRequestVoteOrder?: ChangeRequestVoteOrder | null;
  hashtags: string[];
  hashtagPlaceholder: string;
  preferredHashtagSuggestions?: string[];
  onVisibilityChange: (value: Visibility) => void;
  onGenderQuotaEnabledChange?: (checked: boolean) => void;
  onChangeRequestVoteOrderChange?: (value: ChangeRequestVoteOrder) => void;
  onHashtagsChange: (value: string[]) => void;
}

export function EventSettingsInput({
  showVisibility,
  visibility,
  genderQuotaEnabled = false,
  changeRequestVoteOrder,
  hashtags,
  hashtagPlaceholder,
  preferredHashtagSuggestions,
  onVisibilityChange,
  onGenderQuotaEnabledChange,
  onChangeRequestVoteOrderChange,
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
      {onChangeRequestVoteOrderChange ? (
        <ChangeRequestVoteOrderInput
          value={changeRequestVoteOrder}
          onChange={onChangeRequestVoteOrderChange}
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
