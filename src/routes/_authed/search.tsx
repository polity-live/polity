import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { SearchPage } from '@/features/search/SearchPage';

const searchSchema = z.object({
  q: z.string().optional().catch(undefined),
  types: z.string().optional().catch(undefined),
  range: z.enum(['all', 'today', 'week', 'month', 'year']).optional().catch(undefined),
  topics: z.string().optional().catch(undefined),
  hashtag: z.string().optional().catch(undefined),
  engagement: z.enum(['all', 'popular', 'rising', 'discussed']).optional().catch(undefined),
  sort: z.enum(['recent', 'engagement', 'trending']).optional().catch(undefined),
  view: z.enum(['list', 'spatial']).optional().catch(undefined),
  result: z.string().optional().catch(undefined),
});

export const Route = createFileRoute('/_authed/search')({
  validateSearch: search => searchSchema.parse(search),
  component: SearchPage,
});
