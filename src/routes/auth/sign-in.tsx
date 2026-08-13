import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { SignInForm } from '@/features/auth/ui/SignInForm';

const signInSearchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute('/auth/sign-in')({
  validateSearch: signInSearchSchema,
  component: SignInPage,
});

function SignInPage() {
  return <SignInForm />;
}
