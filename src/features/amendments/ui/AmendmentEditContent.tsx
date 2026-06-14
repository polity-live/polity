'use client';
import { useAmendmentState } from '@/zero/amendments/useAmendmentState';
interface AmendmentEditContentProps {
  amendmentId: string;
  amendment: ReturnType<typeof useAmendmentState>['amendment'];
  currentUserId: string;
  isLoading: boolean;
  mode?: 'create' | 'edit';
  agendaItemId?: string;
}

import { useAmendmentEditContentController } from './useAmendmentEditContentController';
import { AmendmentEditContentView } from './AmendmentEditContentView';

export function AmendmentEditContent({
  amendmentId,
  amendment,
  currentUserId,
  isLoading,
  mode,
  agendaItemId,
}: AmendmentEditContentProps) {
  const viewProps = useAmendmentEditContentController({
    amendmentId,
    amendment,
    currentUserId,
    isLoading,
    mode,
    agendaItemId,
  });

  return <AmendmentEditContentView {...viewProps} />;
}
