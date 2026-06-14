import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/group/$id/blog/')({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>{translateText('generated.inline.1265_hello_authed_group_id_blog_7f01bdfb')}</div>;
}
