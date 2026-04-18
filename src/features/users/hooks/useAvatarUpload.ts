import { toast } from 'sonner';
import { useUserActions } from '@/zero/users/useUserActions';
import { createClient } from '@/lib/supabase/client';

// Co-located types
export interface UseAvatarUploadOptions {
  userId: string;
  onSuccess?: (avatarUrl: string) => void;
}

export interface UseAvatarUploadReturn {
  uploadAvatar: (file: File) => Promise<string>;
}

export function useAvatarUpload({ userId, onSuccess }: UseAvatarUploadOptions): UseAvatarUploadReturn {
  const userActions = useUserActions();

  const uploadAvatar = async (file: File) => {
    if (!file || !userId) {
      throw new Error('Avatar uploads require a file and userId.');
    }

    try {
      const supabase = createClient();
      const avatarPath = `${userId}/avatar`;
      const { error } = await supabase.storage
        .from('avatars')
        .upload(avatarPath, file, { upsert: true, contentType: file.type });

      if (error) throw error;

      // Get public URL with cache-busting param to avoid stale browser cache
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(avatarPath);
      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      // Update user's avatar URL
      await userActions.updateProfile({
        avatar: avatarUrl,
      });

      onSuccess?.(avatarUrl);
      return avatarUrl;
    } catch (error) {
      toast.error('Failed to upload avatar');
      console.error('Avatar upload error:', error);
      throw error;
    }
  };

  return {
    uploadAvatar,
  };
}
