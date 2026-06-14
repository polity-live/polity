'use client';

import { useAuthCallbackPageController } from '@/features/auth/hooks/useAuthCallbackPageController';
import { AuthCallbackPageView } from './AuthCallbackPageView';

export function AuthCallbackPage() {
  useAuthCallbackPageController();
  return <AuthCallbackPageView />;
}
