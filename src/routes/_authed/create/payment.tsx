import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { CreateFormShell } from '@/features/create/ui/CreateFormShell';
import { useCreatePaymentForm } from '@/features/create/hooks/useCreatePaymentForm';
import { useCreatePreloads } from '@/zero/preloads';

const createPaymentSearchSchema = z.object({
  groupId: z.string().optional(),
  direction: z.enum(['income', 'expense']).optional(),
  returnSection: z.literal('payments').optional(),
});

export const Route = createFileRoute('/_authed/create/payment')({
  validateSearch: createPaymentSearchSchema,
  component: CreatePaymentPage,
});

function CreatePaymentPage() {
  useCreatePreloads();
  const config = useCreatePaymentForm();
  return <CreateFormShell config={config} />;
}
