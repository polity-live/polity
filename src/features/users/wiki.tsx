import { useUserWikiPage } from './hooks/useUserWikiPage';
import { UserWikiView } from './ui/UserWikiView';
import type { TabSearchState } from './types/user.types';

interface UserWikiProps {
  userId?: string;
  searchFilters?: Partial<TabSearchState>;
}

export function UserWiki(props: UserWikiProps) {
  const page = useUserWikiPage(props);

  return <UserWikiView page={page} />;
}
