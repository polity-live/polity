import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));

import { createNotification, setNotificationDispatch } from '../notification-helpers';

describe('notification helper server environment', () => {
  afterEach(() => {
    setNotificationDispatch(null);
  });

  it('requires both server-side Supabase credentials', async () => {
    const previousUrl = process.env.SUPABASE_URL;
    const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    await expect(
      createNotification({
        senderId: 'sender-user',
        type: 'direct_message',
        title: 'Missing environment',
        message: 'Missing environment',
      })
    ).rejects.toThrow('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.env.SUPABASE_URL = previousUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
  });
});
