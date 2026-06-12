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
import type {
  GroupAmendmentBadgeStatus,
  GroupAmendmentDisplayStatus,
} from '@/features/groups/logic/groupAmendmentStatus';
import { AmendmentTimelineCard } from '@/features/timeline/ui/cards/AmendmentTimelineCard';
import { extractHashtags } from '@/zero/common/hashtagHelpers';

interface AmendmentItem {
  id: string;
  amendment_id?: string | null;
  title?: string | null;
  subtitle?: string | null;
  decision_status?: GroupAmendmentDisplayStatus | null;
  group_status?: GroupAmendmentBadgeStatus | null;
  editing_mode?: string | null;
  amendment_hashtags?: readonly { hashtag?: { id: string; tag: string } | null }[];
}

type AmendmentSectionKey = GroupAmendmentDisplayStatus;

interface AmendmentGroupsProps {
  groupedAmendments: {
    accepted: AmendmentItem[];
    pending: AmendmentItem[];
    rejected: AmendmentItem[];
    withdrawn: AmendmentItem[];
  };
  groupName?: string;
  groupId?: string;
}

export function AmendmentGroups({ groupedAmendments, groupName, groupId }: AmendmentGroupsProps) {
  const { t } = useTranslation();
  const [openSections, setOpenSections] = useState({
    accepted: true,
    pending: true,
    rejected: true,
    withdrawn: true,
  });

  const sectionOrder: {
    key: AmendmentSectionKey;
    items: AmendmentItem[];
    label: string;
  }[] = [
    {
      key: 'accepted',
      items: groupedAmendments.accepted,
      label: t('features.groups.common.status.acceptedApproved', 'Accepted / Approved'),
    },
    {
      key: 'pending',
      items: groupedAmendments.pending,
      label: t('features.groups.common.status.pending', 'Pending'),
    },
    {
      key: 'rejected',
      items: groupedAmendments.rejected,
      label: t('features.groups.common.status.rejected', 'Rejected'),
    },
    {
      key: 'withdrawn',
      items: groupedAmendments.withdrawn,
      label: t('features.groups.common.status.withdrawn', 'Withdrawn'),
    },
  ];

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <div className="space-y-6">
      {sectionOrder.map(section => {
        if (section.items.length === 0) {
          return null;
        }

        return (
          <Collapsible
            key={section.key}
            open={openSections[section.key]}
            onOpenChange={() => toggleSection(section.key)}
          >
            <div className="bg-card rounded-lg border">
              <CollapsibleTrigger className="hover:bg-accent flex w-full items-center justify-between p-4">
                <div className="flex items-center gap-2">
                  {openSections[section.key] ? (
                    <ChevronDown className="h-5 w-5" />
                  ) : (
                    <ChevronRight className="h-5 w-5" />
                  )}
                  <h2 className="text-xl font-semibold">{section.label}</h2>
                  <Badge variant="secondary">{section.items.length}</Badge>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="grid gap-4 p-4 md:grid-cols-2">
                  {section.items.map(amendment => (
                    <AmendmentTimelineCard
                      key={amendment.id}
                      amendment={{
                        id: String(amendment.amendment_id ?? amendment.id),
                        title: amendment.title ?? '',
                        subtitle: groupName,
                        description: amendment.subtitle ?? undefined,
                        status: amendment.group_status ?? amendment.decision_status ?? 'pending',
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
        );
      })}
    </div>
  );
}
