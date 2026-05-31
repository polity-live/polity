import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { CreateFormShell } from '@/features/create/ui/CreateFormShell';
import { useCreateBlogForm } from '@/features/create/hooks/useCreateBlogForm';

const createBlogSearchSchema = z.object({
  groupId: z.string().optional(),
});

export const Route = createFileRoute('/_authed/create/blog-entry')({
  validateSearch: createBlogSearchSchema,
  component: CreateBlogEntryPage,
});

function CreateBlogEntryPage() {
  const config = useCreateBlogForm();
  return <CreateFormShell config={config} />;
}
