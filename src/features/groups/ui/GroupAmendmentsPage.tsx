interface GroupAmendmentsPageProps {
  groupId: string;
}
import { useGroupAmendmentsPageController } from './useGroupAmendmentsPageController';
import { GroupAmendmentsPageView } from './GroupAmendmentsPageView';
export function GroupAmendmentsPage({ groupId }: GroupAmendmentsPageProps) {
  const viewProps = useGroupAmendmentsPageController({ groupId });

  return <GroupAmendmentsPageView {...viewProps} />;
}
