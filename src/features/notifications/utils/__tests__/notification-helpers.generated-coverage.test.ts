import { afterEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => {
  function query() {
    const chain: Record<string, any> = {};
    for (const method of ['select', 'eq', 'in', 'is', 'neq', 'gte', 'or', 'order', 'limit']) {
      chain[method] = vi.fn(() => chain);
    }
    chain.insert = vi.fn(async () => ({ data: null, error: null }));
    chain.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
    chain.single = vi.fn(async () => ({ data: null, error: null }));
    chain.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve, reject);
    return chain;
  }

  return {
    createClient: vi.fn(() => ({ from: vi.fn(() => query()) })),
  };
});

vi.mock('@supabase/supabase-js', () => ({ createClient: supabaseMock.createClient }));

import * as notificationHelpers from '../notification-helpers';

function generatedParams(mode: 'truthy' | 'empty' | 'same') {
  return new Proxy<Record<string, unknown>>(
    {},
    {
      get: (_target, property) => {
        const key = String(property);
        if (key === 'recipientUserIds') {
          return mode === 'empty' ? [] : ['recipient-1', 'recipient-2'];
        }
        if (mode === 'empty') return null;
        if (mode === 'same') return 'same-value';
        if (key.endsWith('Count') || key.endsWith('Votes') || key === 'amount') return 2;
        if (key.startsWith('is') || key.startsWith('has')) return true;
        return `${key}-value`;
      },
    }
  );
}

afterEach(() => {
  notificationHelpers.setNotificationDispatch(null);
  vi.restoreAllMocks();
});

describe('generated notification helper coverage', () => {
  it('executes every exported notification builder through the injectable dispatch', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
    const dispatched: unknown[] = [];
    notificationHelpers.setNotificationDispatch(async input => {
      dispatched.push(input);
    });

    const failures: string[] = [];
    const entries = Object.entries(notificationHelpers).filter(
      ([name, value]) => name.startsWith('notify') && typeof value === 'function'
    );

    for (const mode of ['truthy', 'empty', 'same'] as const) {
      for (const [name, helper] of entries) {
        try {
          await (helper as (params: Record<string, unknown>) => Promise<unknown>)(
            generatedParams(mode)
          );
        } catch (error) {
          failures.push(
            `${mode}/${name}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    }

    expect(failures).toEqual([]);
    expect(dispatched.length).toBeGreaterThan(entries.length * 2);
  });
});
