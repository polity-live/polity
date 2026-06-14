import React from 'react';
import { Users } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';

export const GroupsHeader: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="mb-8">
      <div className="mb-4 flex items-center gap-3">
        <div className="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-lg">
          <Users className="text-primary h-6 w-6" />
        </div>
        <div>
          <h1 className="text-foreground text-3xl font-bold">{t('features.groups.title')}</h1>
          <p className="text-muted-foreground">{t('features.groups.headerDescription')}</p>
        </div>
      </div>
    </div>
  );
};
