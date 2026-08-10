import { describe, expect, it, vi } from 'vitest';

import {
  getSupabaseAuthTemplateDefinition,
  renderSupabaseAuthTemplate,
  supabaseAuthTemplateSlugs,
} from '../../../emails/auth/_registry';
import {
  buildSupabaseAuthTemplatePayload,
  deploySupabaseAuthTemplates,
} from '@/server/supabase-auth-template-deployment';

describe('Supabase auth email templates', () => {
  it.each(supabaseAuthTemplateSlugs)('renders bilingual %s mail safely', async slug => {
    const definition = getSupabaseAuthTemplateDefinition(slug);
    const html = await renderSupabaseAuthTemplate(slug);

    expect(definition.subject).toContain('{{ if eq .Data.language `de` }}');
    expect(definition.subject).toContain('{{ else }}');
    expect(html).toContain('{{ if eq .Data.language `de` }}');
    expect(html).toContain('{{ else }}');
    expect(html).toContain('{{ end }}');
    expect(html).toContain('{{ .SiteURL }}/android-chrome-192x192.png');
    expect(html).toContain('team@polity.live');
  });

  it('builds only the expected subject and content fields', async () => {
    const payload = await buildSupabaseAuthTemplatePayload();
    expect(Object.keys(payload)).toHaveLength(16);
    expect(Object.keys(payload).every(field => field.startsWith('mailer_'))).toBe(true);
  });
});

describe('Supabase auth template deployment', () => {
  it('reports a dry-run diff without patching', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({}), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        })
    );

    const result = await deploySupabaseAuthTemplates({
      accessToken: 'token',
      dryRun: true,
      fetchImpl: fetchImpl as typeof fetch,
      projectRef: 'project',
    });

    expect(result).toMatchObject({ deployed: false });
    expect(result.changedFields).toHaveLength(16);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('patches changed fields and verifies the result', async () => {
    const desired = await buildSupabaseAuthTemplatePayload();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(desired), { status: 200 }));

    const result = await deploySupabaseAuthTemplates({
      accessToken: 'token',
      fetchImpl: fetchImpl as typeof fetch,
      projectRef: 'project',
    });

    expect(result).toMatchObject({ deployed: true });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(fetchImpl.mock.calls[1][1]).toMatchObject({ method: 'PATCH' });
  });

  it('does not patch an already current configuration', async () => {
    const desired = await buildSupabaseAuthTemplatePayload();
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(desired), { status: 200 }));
    await expect(
      deploySupabaseAuthTemplates({
        accessToken: 'token',
        fetchImpl: fetchImpl as typeof fetch,
        projectRef: 'project',
      })
    ).resolves.toEqual({ changedFields: [], deployed: false });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('surfaces Management API errors and verification mismatches', async () => {
    const failedFetch = vi.fn().mockResolvedValue(new Response('denied', { status: 403 }));
    await expect(
      deploySupabaseAuthTemplates({
        accessToken: 'token',
        fetchImpl: failedFetch as typeof fetch,
        projectRef: 'project',
      })
    ).rejects.toThrow('Supabase Management API 403: denied');

    const mismatchFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
      .mockResolvedValueOnce(new Response('', { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));
    await expect(
      deploySupabaseAuthTemplates({
        accessToken: 'token',
        fetchImpl: mismatchFetch as typeof fetch,
        projectRef: 'project',
      })
    ).rejects.toThrow('Supabase template verification failed for:');
  });

  it('uses the global fetch implementation by default', async () => {
    const desired = await buildSupabaseAuthTemplatePayload();
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(desired), { status: 200 }));
    vi.stubGlobal('fetch', fetchImpl);
    try {
      await expect(
        deploySupabaseAuthTemplates({ accessToken: 'token', projectRef: 'project' })
      ).resolves.toEqual({ changedFields: [], deployed: false });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
