import { useRouter } from '@tanstack/react-router';
import { useTranslation } from '@/features/shared/hooks/use-translation.ts';
import { NotFoundView } from './NotFoundView';
export function NotFound() {
  const { t } = useTranslation();
  const router = useRouter();
  return <NotFoundView t={t} router={router} />;
}
