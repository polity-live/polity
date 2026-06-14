interface GroupBlogsAndStatementsPageProps {
  groupId: string;
}
import { useGroupBlogsAndStatementsPageController } from './useGroupBlogsAndStatementsPageController';
import { GroupBlogsAndStatementsPageView } from './GroupBlogsAndStatementsPageView';

export function GroupBlogsAndStatementsPage({ groupId }: GroupBlogsAndStatementsPageProps) {
  const viewProps = useGroupBlogsAndStatementsPageController({ groupId });

  return <GroupBlogsAndStatementsPageView {...viewProps} />;
}
