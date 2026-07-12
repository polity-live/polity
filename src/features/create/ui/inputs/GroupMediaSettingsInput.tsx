import { MediaUpload } from '@/features/file-upload/ui/MediaUpload';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { HashtagEditor } from '@/features/shared/ui/hashtags';
import { VisibilityInput } from './VisibilityInput';

type Visibility = 'public' | 'authenticated' | 'private';

interface GroupMediaSettingsInputProps {
  imageURL: string;
  videoURL: string;
  groupId: string;
  imageLabel: string;
  imageDescription: string;
  visibility: Visibility;
  hashtags: string[];
  hashtagPlaceholder: string;
  preferredHashtagSuggestions?: string[];
  onImageChange: (value: string) => void;
  onVideoChange: (value: string) => void;
  onVisibilityChange: (value: Visibility) => void;
  onHashtagsChange: (value: string[]) => void;
}

export function GroupMediaSettingsInput({
  imageURL,
  videoURL,
  groupId,
  imageLabel,
  imageDescription,
  visibility,
  hashtags,
  hashtagPlaceholder,
  preferredHashtagSuggestions,
  onImageChange,
  onVideoChange,
  onVisibilityChange,
  onHashtagsChange,
}: GroupMediaSettingsInputProps) {
  return (
    <div className="space-y-4">
      <MediaUpload
        currentImage={imageURL}
        onImageChange={onImageChange}
        currentVideo={videoURL}
        onVideoChange={onVideoChange}
        cleanupOnRemove
        exclusiveMedia
        entityType="groups"
        entityId={groupId}
        imageLabel={imageLabel}
        imageDescription={imageDescription}
        videoLabel={translateText('common.actions.uploadVideo')}
        videoDescription={translateText('common.media.videoDescription')}
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
