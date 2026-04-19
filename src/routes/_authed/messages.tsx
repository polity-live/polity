import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import MessagesPage from '@/features/messages/MessagesPage'

const messagesSearchSchema = z.object({
  name: z.string().optional(),
  new: z.string().optional(),
  openAriaKai: z.string().optional(),
  search: z.string().optional(),
  userId: z.string().optional(),
  userSearch: z.string().optional(),
})

export const Route = createFileRoute('/_authed/messages')({
  validateSearch: messagesSearchSchema,
  component: MessagesPage,
})
