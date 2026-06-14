/**
 * Blog Edit Component
 *
 * Complete blog editing UI with authorization checks,
 * loading states, and form management.
 */

import { useNavigate } from '@tanstack/react-router';
import { useBlogEditPage } from '../hooks/useBlogEditPage';
import { useAuth } from '@/providers/auth-provider';
import { useTranslation } from '@/features/shared/hooks/use-translation';

interface BlogEditProps {
  blogId: string;
}
import { BlogEditView } from './BlogEditView';
export function BlogEdit({ blogId }: BlogEditProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const {
    formData,
    setFormData,
    updateField,
    removeImage,
    handleSubmit,
    isSubmitting,
    blog,
    isLoading,
  } = useBlogEditPage(blogId, user?.id);
  return (
    <BlogEditView
      blogId={blogId}
      navigate={navigate}
      user={user}
      t={t}
      formData={formData}
      setFormData={setFormData}
      updateField={updateField}
      removeImage={removeImage}
      handleSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      blog={blog}
      isLoading={isLoading}
    />
  );
}
