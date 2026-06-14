'use client';

import { useBlogDetailController } from '../hooks/useBlogDetailController';
import { BlogDetailView } from './BlogDetailView';

interface BlogDetailProps {
  blogId: string;
}

export function BlogDetail({ blogId }: BlogDetailProps) {
  return <BlogDetailView {...useBlogDetailController({ blogId })} />;
}
