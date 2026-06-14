'use client';

import { useBlogEditorController } from '../hooks/useBlogEditorController';
import { BlogEditorView } from './BlogEditorView';

interface BlogEditorProps {
  blogId: string;
}

export function BlogEditor({ blogId }: BlogEditorProps) {
  return <BlogEditorView {...useBlogEditorController({ blogId })} />;
}
