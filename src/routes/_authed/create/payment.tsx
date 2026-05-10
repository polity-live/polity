import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { CreateFormShell } from '@/features/create/ui/CreateFormShell';
import { useCreatePaymentForm } from '@/features/create/hooks/useCreatePaymentForm';

const createPaymentSearchSchema = z.object({
  groupId: z.string().optional(),
  direction: z.enum(['income', 'expense']).optional(),
  returnGroupId: z.string().optional(),
  returnSection: z.literal('payments').optional(),
});

export const Route = createFileRoute('/_authed/create/payment')({
  validateSearch: createPaymentSearchSchema,
  component: CreatePaymentPage,
});

function CreatePaymentPage() {
  const config = useCreatePaymentForm();
  return <CreateFormShell config={config} />;
}
