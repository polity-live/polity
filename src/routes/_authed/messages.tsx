import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import MessagesPage from '@/features/messages/MessagesPage';
import { useMessagesPreloads } from '@/zero/preloads';

const optionalSearchString = z.preprocess(
  value => (typeof value === 'boolean' || typeof value === 'number' ? String(value) : value),
  z.string().optional()
);

const messagesSearchSchema = z.object({
  conversationId: optionalSearchString,
  name: optionalSearchString,
  new: optionalSearchString,
  openAriaKai: optionalSearchString,
  search: optionalSearchString,
  userId: optionalSearchString,
  userSearch: optionalSearchString,
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
