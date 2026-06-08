'use client';

import { useState } from 'react';
import { Badge } from '@/features/shared/ui/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/features/shared/ui/ui/collapsible';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { AmendmentTimelineCard } from '@/features/timeline/ui/cards/AmendmentTimelineCard';
import { extractHashtags } from '@/zero/common/hashtagHelpers';

interface AmendmentItem {
  id: string;
  amendment_id?: string | null;
  title?: string | null;
  subtitle?: string | null;
  decision_status?: string | null;
  editing_mode?: string | null;
  amendment_hashtags?: readonly { hashtag?: { id: string; tag: string } | null }[];
}

interface AmendmentGroupsProps {
  groupedAmendments: {
    supported: AmendmentItem[];
    accepted: AmendmentItem[];
    rejected: AmendmentItem[];
    withdrawn: AmendmentItem[];
  };
  groupName?: string;
  groupId?: string;
}

function mapDecisionStatusToTimelineStatus(status?: string | null) {
  switch (status) {
    case 'accepted':
      return 'passed';
    case 'rejected':
      return 'rejected';
    case 'supported':
      return 'vote_internal';
    case 'withdrawn':
    default:
      return 'view';
  }
}

export function AmendmentGroups({ groupedAmendments, groupName, groupId }: AmendmentGroupsProps) {
  const { t } = useTranslation();
  const [openSections, setOpenSections] = useState({
    supported: true,
    accepted: true,
    rejected: true,
    withdrawn: true,
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <div className="space-y-6">
      {/* Supported Section */}
      {groupedAmendments.supported.length > 0 && (
        <Collapsible open={openSections.supported} onOpenChange={() => toggleSection('supported')}>
          <div className="bg-card rounded-lg border">
            <CollapsibleTrigger className="hover:bg-accent flex w-full items-center justify-between p-4">
              <div className="flex items-center gap-2">
                {openSections.supported ? (
                  <ChevronDown className="h-5 w-5" />
                ) : (
                  <ChevronRight className="h-5 w-5" />
                )}
                <h2 className="text-xl font-semibold">
                  {t('features.groups.common.status.supported', 'Supported')}
                </h2>
                <Badge variant="secondary">{groupedAmendments.supported.length}</Badge>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="grid gap-4 p-4 md:grid-cols-2">
                {groupedAmendments.supported.map(amendment => (
                  <AmendmentTimelineCard
                    key={amendment.id}
                    amendment={{
                      id: String(amendment.amendment_id ?? amendment.id),
                      title: amendment.title ?? '',
                      subtitle: groupName,
                      description: amendment.subtitle ?? undefined,
                      status: mapDecisionStatusToTimelineStatus(amendment.decision_status),
                      groupName,
                      groupId,
                      hashtags: extractHashtags(amendment.amendment_hashtags),
                    }}
                  />
                ))}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}

      {/* Accepted Section */}
      {groupedAmendments.accepted.length > 0 && (
        <Collapsible open={openSections.accepted} onOpenChange={() => toggleSection('accepted')}>
          <div className="bg-card rounded-lg border">
            <CollapsibleTrigger className="hover:bg-accent flex w-full items-center justify-between p-4">
              <div className="flex items-center gap-2">
                {openSections.accepted ? (
                  <ChevronDown className="h-5 w-5" />
                ) : (
                  <ChevronRight className="h-5 w-5" />
                )}
                <h2 className="text-xl font-semibold">
                  {t('features.groups.common.status.accepted', 'Accepted')}
                </h2>
                <Badge variant="secondary">{groupedAmendments.accepted.length}</Badge>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="grid gap-4 p-4 md:grid-cols-2">
                {groupedAmendments.accepted.map(amendment => (
                  <AmendmentTimelineCard
                    key={amendment.id}
                    amendment={{
                      id: String(amendment.amendment_id ?? amendment.id),
                      title: amendment.title ?? '',
                      subtitle: groupName,
                      description: amendment.subtitle ?? undefined,
                      status: mapDecisionStatusToTimelineStatus(amendment.decision_status),
                      groupName,
                      groupId,
                      hashtags: extractHashtags(amendment.amendment_hashtags),
                    }}
                  />
                ))}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}

      {/* Rejected Section */}
      {groupedAmendments.rejected.length > 0 && (
        <Collapsible open={openSections.rejected} onOpenChange={() => toggleSection('rejected')}>
          <div className="bg-card rounded-lg border">
            <CollapsibleTrigger className="hover:bg-accent flex w-full items-center justify-between p-4">
              <div className="flex items-center gap-2">
                {openSections.rejected ? (
                  <ChevronDown className="h-5 w-5" />
                ) : (
                  <ChevronRight className="h-5 w-5" />
                )}
                <h2 className="text-xl font-semibold">
                  {t('features.groups.common.status.rejected', 'Rejected')}
                </h2>
                <Badge variant="secondary">{groupedAmendments.rejected.length}</Badge>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="grid gap-4 p-4 md:grid-cols-2">
                {groupedAmendments.rejected.map(amendment => (
                  <AmendmentTimelineCard
                    key={amendment.id}
                    amendment={{
                      id: String(amendment.amendment_id ?? amendment.id),
                      title: amendment.title ?? '',
                      subtitle: groupName,
                      description: amendment.subtitle ?? undefined,
                      status: mapDecisionStatusToTimelineStatus(amendment.decision_status),
                      groupName,
                      groupId,
                      hashtags: extractHashtags(amendment.amendment_hashtags),
                    }}
                  />
                ))}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}

      {/* Withdrawn Section */}
      {groupedAmendments.withdrawn.length > 0 && (
        <Collapsible open={openSections.withdrawn} onOpenChange={() => toggleSection('withdrawn')}>
          <div className="bg-card rounded-lg border">
            <CollapsibleTrigger className="hover:bg-accent flex w-full items-center justify-between p-4">
              <div className="flex items-center gap-2">
                {openSections.withdrawn ? (
                  <ChevronDown className="h-5 w-5" />
                ) : (
                  <ChevronRight className="h-5 w-5" />
                )}
                <h2 className="text-xl font-semibold">
                  {t('features.groups.common.status.withdrawn', 'Withdrawn')}
                </h2>
                <Badge variant="secondary">{groupedAmendments.withdrawn.length}</Badge>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="grid gap-4 p-4 md:grid-cols-2">
                {groupedAmendments.withdrawn.map(amendment => (
                  <AmendmentTimelineCard
                    key={amendment.id}
                    amendment={{
                      id: String(amendment.amendment_id ?? amendment.id),
                      title: amendment.title ?? '',
                      subtitle: groupName,
                      description: amendment.subtitle ?? undefined,
                      status: mapDecisionStatusToTimelineStatus(amendment.decision_status),
                      groupName,
                      groupId,
                      hashtags: extractHashtags(amendment.amendment_hashtags),
                    }}
                  />
                ))}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}
    </div>
  );
}
