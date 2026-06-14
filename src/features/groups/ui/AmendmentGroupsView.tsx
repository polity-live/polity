import { ChevronDown, ChevronRight } from 'lucide-react';

import { CountBadge } from '@/features/shared/ui/status';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/features/shared/ui/ui/collapsible';
import { AmendmentTimelineCard } from '@/features/timeline/ui/cards/AmendmentTimelineCard';

import type { GroupAmendmentDisplayStatus } from '../logic/groupAmendmentStatus';

interface AmendmentGroupsViewProps {
  openSections: Record<GroupAmendmentDisplayStatus, boolean>;
  sectionOrder: {
    key: GroupAmendmentDisplayStatus;
    label: string;
    items: {
      id: string;
      cardAmendment: React.ComponentProps<typeof AmendmentTimelineCard>['amendment'];
    }[];
  }[];
  onToggleSection: (section: GroupAmendmentDisplayStatus) => void;
}

export function AmendmentGroupsView({
  openSections,
  sectionOrder,
  onToggleSection,
}: AmendmentGroupsViewProps) {
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
            onOpenChange={() => onToggleSection(section.key)}
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
                  <CountBadge count={section.items.length} />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="grid gap-4 p-4 md:grid-cols-2">
                  {section.items.map(amendment => (
                    <AmendmentTimelineCard key={amendment.id} amendment={amendment.cardAmendment} />
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
