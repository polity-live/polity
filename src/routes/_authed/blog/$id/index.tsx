import { createFileRoute } from '@tanstack/react-router';
import { ResolvedBlogRedirect } from '@/features/blogs/ui/ResolvedBlogRedirect';

export const Route = createFileRoute('/_authed/blog/$id/')({
  component: BlogCanonicalPage,
});

function BlogCanonicalPage() {
  const { id } = Route.useParams();

  return <ResolvedBlogRedirect blogId={id} target="detail" />;
}
