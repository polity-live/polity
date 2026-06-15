import { ImageUpload } from '@/features/file-upload/ui/ImageUpload.tsx';
import { HashtagEditor } from '@/features/shared/ui/hashtags';
import { VisibilityInput } from './VisibilityInput';

type Visibility = 'public' | 'authenticated' | 'private';

interface GroupMediaSettingsInputProps {
  imageURL: string;
  groupId: string;
  imageLabel: string;
  imageDescription: string;
  visibility: Visibility;
  hashtags: string[];
  hashtagPlaceholder: string;
  preferredHashtagSuggestions?: string[];
  onImageChange: (value: string) => void;
  onVisibilityChange: (value: Visibility) => void;
  onHashtagsChange: (value: string[]) => void;
}

export function GroupMediaSettingsInput({
  imageURL,
  groupId,
  imageLabel,
  imageDescription,
  visibility,
  hashtags,
  hashtagPlaceholder,
  preferredHashtagSuggestions,
  onImageChange,
  onVisibilityChange,
  onHashtagsChange,
}: GroupMediaSettingsInputProps) {
  return (
    <div className="space-y-4">
      <ImageUpload
        currentImage={imageURL}
        onImageChange={onImageChange}
        cleanupOnRemove
        entityType="groups"
        entityId={groupId}
        label={imageLabel}
        description={imageDescription}
      />
      <VisibilityInput value={visibility} onChange={onVisibilityChange} />
      <HashtagEditor
        value={hashtags}
        onChange={onHashtagsChange}
        placeholder={hashtagPlaceholder}
        preferredSuggestions={preferredHashtagSuggestions}
      />
    </div>
  );
}
