import { executeZeroRead } from '@/server/zero-mutate';
import { zql } from '@/zero/schema';
import {
  applyEventQueryAccess,
  applyAmendmentQueryAccess,
  applyStatementQueryAccess,
} from '@/zero/rbac/query-access';
import { StudioError } from './db';
function plain(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(plain).join(' ');
  if (value && typeof value === 'object') {
    const r = value as Record<string, unknown>;
    return plain(r.text ?? r.children ?? '');
  }
  return '';
}
export async function studioSource(
  userId: string,
  type: 'event' | 'amendment' | 'statement',
  id?: string
) {
  return executeZeroRead(async tx => {
    if (type === 'event') {
      let q = applyEventQueryAccess(zql.event, userId);
      if (id) q = q.where('id', id);
      const rows = await tx.run(q.orderBy('updated_at', 'desc').limit(id ? 1 : 30));
      return rows.map(r => ({
        type,
        id: r.id,
        title: r.title || '',
        text: [
          plain(r.description),
          r.start_date
            ? new Intl.DateTimeFormat('de-DE', {
                dateStyle: 'full',
                timeStyle: 'short',
                timeZone: r.timezone || 'Europe/Berlin',
              }).format(r.start_date)
            : '',
          [r.location_name, r.street, r.house_number, r.post_code, r.city]
            .filter(Boolean)
            .join(' '),
          r.location_url || '',
        ]
          .filter(Boolean)
          .join('\n'),
        updatedAt: r.updated_at,
      }));
    }
    if (type === 'amendment') {
      let q = applyAmendmentQueryAccess(zql.amendment, userId);
      if (id) q = q.where('id', id);
      const rows = await tx.run(q.orderBy('updated_at', 'desc').limit(id ? 1 : 30));
      return rows.map(r => ({
        type,
        id: r.id,
        title: r.title || '',
        text: [r.preamble, r.reason].filter(Boolean).join('\n'),
        updatedAt: r.updated_at,
      }));
    }
    let q = applyStatementQueryAccess(zql.statement, userId, Date.now());
    if (id) q = q.where('id', id);
    const rows = await tx.run(q.orderBy('updated_at', 'desc').limit(id ? 1 : 30));
    if (id && !rows.length) throw new StudioError('Source not available', 404);
    return rows.map(r => ({
      type,
      id: r.id,
      title: r.title || '',
      text: r.text || '',
      updatedAt: r.updated_at,
    }));
  });
}
