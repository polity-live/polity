'use client';
import { useAmendmentState } from '@/zero/amendments/useAmendmentState';
interface AmendmentEditContentProps {
  amendmentId: string;
  amendment: ReturnType<typeof useAmendmentState>['amendment'];
  amendmentProcess?: ReturnType<typeof useAmendmentState>['amendmentProcess'];
  currentUserId: string;
  isLoading: boolean;
  mode?: 'create' | 'edit';
  agendaItemId?: string;
  activeTab?: 'general' | 'workflow' | 'location';
  onTabChange?: (tab: 'general' | 'workflow' | 'location') => void;
}

import { useAmendmentEditContentController } from './useAmendmentEditContentController';
import { AmendmentEditContentView } from './AmendmentEditContentView';

export function AmendmentEditContent({
  amendmentId,
  amendment,
  amendmentProcess,
  currentUserId,
  isLoading,
  mode,
  agendaItemId,
  activeTab,
  onTabChange,
}: AmendmentEditContentProps) {
  const viewProps = useAmendmentEditContentController({
    amendmentId,
    amendment,
    amendmentProcess,
    currentUserId,
    isLoading,
    mode,
    agendaItemId,
    activeTab,
    onTabChange,
  });

  return <AmendmentEditContentView {...viewProps} />;
}
