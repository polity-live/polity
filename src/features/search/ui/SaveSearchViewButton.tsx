import { useRouterState } from '@tanstack/react-router';
import { FavoriteButton } from '@/features/shared/ui/navigation/FavoriteButton';
import { useTranslation } from '@/features/shared/hooks/use-translation';

export function SaveSearchViewButton() {
  const { t } = useTranslation();
  const location = useRouterState({ select: state => state.location });
  const query = location.search.q;
  return (
    <FavoriteButton
      favorite={{
        kind: 'view',
        href: `/search${location.searchStr}`,
        title: `${t('features.search.title')}${query ? ` · ${String(query)}` : ''}`,
      }}
    />
  );
}
