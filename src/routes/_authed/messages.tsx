import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import MessagesPage from '@/features/messages/MessagesPage';
import { useMessagesPreloads } from '@/zero/preloads';

const messagesSearchSchema = z.object({
  conversationId: z.string().optional(),
  name: z.string().optional(),
  new: z.string().optional(),
  openAriaKai: z.string().optional(),
  search: z.string().optional(),
  userId: z.string().optional(),
  userSearch: z.string().optional(),
});

export const Route = createFileRoute('/_authed/messages')({
  validateSearch: messagesSearchSchema,
  component: MessagesRoute,
});

function MessagesRoute() {
  const search = Route.useSearch();
  useMessagesPreloads(search.conversationId);

  return <MessagesPage />;
}
