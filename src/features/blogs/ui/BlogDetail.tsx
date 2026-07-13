'use client';

import { useBlogDetailController } from '../hooks/useBlogDetailController';
import { CreateRecoveryState } from '@/features/create/ui/CreateRecoveryState';
import { PageWrapper } from '@/layout/page-wrapper';
import { BlogDetailView } from './BlogDetailView';

interface BlogDetailProps {
  blogId: string;
}

export function BlogDetail({ blogId }: BlogDetailProps) {
  const controller = useBlogDetailController({ blogId });

  if (!controller.isLoaded && controller.recoveryDraft) {
    return (
      <PageWrapper>
        <CreateRecoveryState draft={controller.recoveryDraft} />
      </PageWrapper>
    );
  }

  return <BlogDetailView {...controller} virtualizeParticipationDirectory />;
}
