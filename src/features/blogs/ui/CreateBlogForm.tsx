'use client';

import { useCreateBlogFormController } from './useCreateBlogFormController';
import { CreateBlogFormView } from './CreateBlogFormView';

export function CreateBlogForm() {
  const viewProps = useCreateBlogFormController();

  return <CreateBlogFormView {...viewProps} />;
}
