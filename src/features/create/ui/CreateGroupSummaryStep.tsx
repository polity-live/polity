import { CreateSummaryStep } from './CreateSummaryStep';
import { GroupRelationshipRightSentenceList } from '@/features/network/ui/GroupRelationshipFields';
import { getCanonicalMembershipModeLabel } from '@/features/network/logic/groupConnectionDerived';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface CreateGroupSummaryStepProps {
  badge: string;
  secondaryBadge: string;
  title: string;
  subtitle?: string;
  media?: { imageUrl: string; imageAlt: string };
  hashtags?: string[];
  sections: any[];
  groupLinksTitle: string;
  linkedGroupReviewData: any[];
  currentGroupName: string;
  currentGroupId: string;
}

export function CreateGroupSummaryStep({
  badge,
  secondaryBadge,
  title,
  subtitle,
  media,
  hashtags,
  sections,
  groupLinksTitle,
  linkedGroupReviewData,
  currentGroupName,
  currentGroupId,
}: CreateGroupSummaryStepProps) {
  return (
    <CreateSummaryStep
      entityType="group"
      badge={badge}
      secondaryBadge={secondaryBadge}
      title={title}
      subtitle={subtitle}
      media={media}
      hashtags={hashtags}
      sections={[
        ...sections,
        {
          title: groupLinksTitle,
          content:
            linkedGroupReviewData.length > 0 ? (
              <div className="space-y-3">
                {linkedGroupReviewData.map(linkedGroup => (
                  <div
                    key={linkedGroup.id}
                    className="border-border/70 bg-card/70 rounded-xl border p-3"
                  >
                    <p className="text-sm font-semibold">{linkedGroup.groupName}</p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {linkedGroup.relationshipLabel}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {translateText('generated.inline.0338_mitgliedschaftsmodus_f28df59b')}{' '}
                      {getCanonicalMembershipModeLabel(linkedGroup.membershipMode)}
                    </p>
                    {linkedGroup.rights.length > 0 ? (
                      <GroupRelationshipRightSentenceList
                        className="mt-3"
                        rights={linkedGroup.rights}
                        rightDirections={linkedGroup.rightDirections}
                        currentGroupName={currentGroupName}
                        selectedGroupName={linkedGroup.groupName}
                        currentGroupId={currentGroupId}
                        selectedGroupId={linkedGroup.id}
                      />
                    ) : null}
                  </div>
                ))}
              </div>
            ) : undefined,
        },
      ].filter(section => section.title || section.fields?.length || section.content)}
    />
  );
}
