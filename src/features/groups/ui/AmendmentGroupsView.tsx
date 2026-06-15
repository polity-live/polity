import type { ComponentProps, CSSProperties } from 'react';
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
      cardAmendment: ComponentProps<typeof AmendmentTimelineCard>['amendment'];
    }[];
  }[];
  onToggleSection: (section: GroupAmendmentDisplayStatus) => void;
}

export function AmendmentGroupsView({
  openSections,
  sectionOrder,
  onToggleSection,
}: AmendmentGroupsViewProps) {
  let nextMotionIndex = 0;

  return (
    <div className="space-y-6">
      {sectionOrder.map((section: AmendmentGroupsViewProps['sectionOrder'][number]) => {
        if (section.items.length === 0) {
          return null;
        }

        const isSectionOpen = openSections[section.key];
        const sectionMotionStartIndex = nextMotionIndex;
        if (isSectionOpen) {
          nextMotionIndex += section.items.length;
        }

        return (
          <Collapsible
            key={section.key}
            open={isSectionOpen}
            onOpenChange={() => onToggleSection(section.key)}
          >
            <div className="bg-card rounded-lg border">
              <CollapsibleTrigger className="hover:bg-accent flex w-full items-center justify-between p-4">
                <div className="flex items-center gap-2">
                  {isSectionOpen ? (
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
                  {section.items.map(
                    (
                      amendment: AmendmentGroupsViewProps['sectionOrder'][number]['items'][number],
                      index: number
                    ) => (
                      <div
                        key={amendment.id}
                        className={isSectionOpen ? 'civic-load-card-reveal' : undefined}
                        style={
                          isSectionOpen
                            ? ({
                                '--civic-load-index': Math.min(sectionMotionStartIndex + index, 11),
                              } as CSSProperties)
                            : undefined
                        }
                      >
                        <AmendmentTimelineCard amendment={amendment.cardAmendment} />
                      </div>
                    )
                  )}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      })}
    </div>
  );
}
