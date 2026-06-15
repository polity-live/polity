import { HashtagEditor } from '@/features/shared/ui/hashtags';
import type { Visibility } from '@/features/auth/logic/checkEntityAccess';
import { VisibilityInput } from './VisibilityInput';

interface EventSettingsInputProps {
  showVisibility: boolean;
  visibility: Visibility;
  hashtags: string[];
  hashtagPlaceholder: string;
  preferredHashtagSuggestions?: string[];
  onVisibilityChange: (value: Visibility) => void;
  onHashtagsChange: (value: string[]) => void;
}

export function EventSettingsInput({
  showVisibility,
  visibility,
  hashtags,
  hashtagPlaceholder,
  preferredHashtagSuggestions,
  onVisibilityChange,
  onHashtagsChange,
}: EventSettingsInputProps) {
  return (
    <div className="space-y-4">
      {showVisibility ? <VisibilityInput value={visibility} onChange={onVisibilityChange} /> : null}
      <HashtagEditor
        value={hashtags}
        onChange={onHashtagsChange}
        placeholder={hashtagPlaceholder}
        preferredSuggestions={preferredHashtagSuggestions}
      />
    </div>
  );
}
