import { describe, expect, it, vi } from 'vitest';

import { getPolityTemplateDefinition } from '../../../emails/_registry';
import {
  assertTemplateEnvironment,
  deployPolityTemplate,
  ResendTemplateDeploymentError,
  type ResendTemplateClient,
} from '../resend-template-deployment';

const definition = getPolityTemplateDefinition('newsletter', 'development');
const rendered = { html: '<html>Newsletter</html>', text: 'Newsletter' };

describe('deployPolityTemplate', () => {
  it('returns a dry run without calling Resend', async () => {
    const client = createClient();

    await expect(
      deployPolityTemplate({ client, definition, dryRun: true, rendered })
    ).resolves.toEqual({
      action: 'dry-run',
      alias: definition.alias,
      id: null,
      published: false,
    });
    expect(client.get).not.toHaveBeenCalled();
    expect(client.create).not.toHaveBeenCalled();
    expect(client.publish).not.toHaveBeenCalled();
  });

  it('creates and publishes a missing template', async () => {
    const client = createClient({
      get: response(null, { message: 'Not found', name: 'not_found', statusCode: 404 }),
      create: response({ id: 'template-created', object: 'template' }, null),
      publish: response({ id: 'template-created', object: 'template' }, null),
    });

    await expect(deployPolityTemplate({ client, definition, rendered })).resolves.toEqual({
      action: 'created',
      alias: definition.alias,
      id: 'template-created',
      published: true,
    });
    expect(client.create).toHaveBeenCalledWith(
      expect.objectContaining({
        alias: definition.alias,
        html: rendered.html,
        name: definition.name,
        text: rendered.text,
      })
    );
    expect(client.update).not.toHaveBeenCalled();
    expect(client.publish).toHaveBeenCalledWith('template-created');
  });

  it('updates and publishes an existing template', async () => {
    const client = createClient({
      get: response(
        {
          alias: definition.alias,
          created_at: '2026-07-21T00:00:00.000Z',
          current_version_id: 'version-old',
          from: definition.from,
          has_unpublished_versions: false,
          html: '<html>Old</html>',
          id: 'template-existing',
          name: definition.name,
          object: 'template',
          published_at: '2026-07-21T00:00:00.000Z',
          reply_to: [definition.replyTo],
          status: 'published',
          subject: definition.subject,
          text: 'Old',
          updated_at: '2026-07-21T00:00:00.000Z',
          variables: null,
        },
        null
      ),
      update: response({ id: 'template-existing', object: 'template' }, null),
      publish: response({ id: 'template-existing', object: 'template' }, null),
    });

    await expect(deployPolityTemplate({ client, definition, rendered })).resolves.toEqual({
      action: 'updated',
      alias: definition.alias,
      id: 'template-existing',
      published: true,
    });
    expect(client.update).toHaveBeenCalledWith(
      'template-existing',
      expect.objectContaining({ html: rendered.html, text: rendered.text })
    );
    expect(client.create).not.toHaveBeenCalled();
    expect(client.publish).toHaveBeenCalledWith('template-existing');
  });

  it('reports the complete Resend lookup error', async () => {
    const client = createClient({
      get: response(null, {
        message: 'Rate limited',
        name: 'rate_limit_exceeded',
        statusCode: 429,
      }),
    });

    await expect(deployPolityTemplate({ client, definition, rendered })).rejects.toMatchObject({
      message:
        'Template lookup failed: {"message":"Rate limited","name":"rate_limit_exceeded","statusCode":429}',
      name: 'ResendTemplateDeploymentError',
      resendError: {
        message: 'Rate limited',
        name: 'rate_limit_exceeded',
        statusCode: 429,
      },
    } satisfies Partial<ResendTemplateDeploymentError>);
    expect(client.create).not.toHaveBeenCalled();
  });

  it('accepts a not-found name without a 404 status', async () => {
    const client = createClient({
      get: response(null, { message: 'Missing', name: 'not_found', statusCode: 400 }),
    });
    await expect(deployPolityTemplate({ client, definition, rendered })).resolves.toMatchObject({
      action: 'created',
    });
  });

  it.each([
    ['update error', { get: response({ id: 'existing' }, null), update: response(null, error()) }],
    [
      'update without data',
      { get: response({ id: 'existing' }, null), update: response(null, null) },
    ],
    ['creation error', { get: response(null, null), create: response(null, error()) }],
    ['creation without data', { get: response(null, null), create: response(null, null) }],
    ['publish error', { get: response(null, null), publish: response(null, error()) }],
    ['publish without data', { get: response(null, null), publish: response(null, null) }],
  ])('rejects a %s response', async (_label, overrides) => {
    await expect(
      deployPolityTemplate({ client: createClient(overrides), definition, rendered })
    ).rejects.toThrow();
  });
});

describe('assertTemplateEnvironment', () => {
  it('accepts the requested environment', () => {
    expect(() => assertTemplateEnvironment('production', 'production')).not.toThrow();
  });

  it('accepts an environment-specific file without the optional marker', () => {
    expect(() => assertTemplateEnvironment('production', undefined)).not.toThrow();
  });

  it('rejects a mismatched environment', () => {
    expect(() => assertTemplateEnvironment('production', 'development')).toThrow(
      'NEWSLETTER_ENVIRONMENT must be production; received development'
    );
  });
});

function response(data: unknown, error: unknown) {
  return { data, error, headers: null };
}

function error() {
  return { message: 'Resend failed', name: 'application_error', statusCode: 500 };
}

function createClient(overrides: Record<string, unknown> = {}) {
  return {
    create: vi
      .fn()
      .mockResolvedValue(
        overrides.create ?? response({ id: 'template-created', object: 'template' }, null)
      ),
    get: vi.fn().mockResolvedValue(overrides.get ?? response(null, null)),
    publish: vi
      .fn()
      .mockResolvedValue(
        overrides.publish ?? response({ id: 'template-created', object: 'template' }, null)
      ),
    update: vi
      .fn()
      .mockResolvedValue(
        overrides.update ?? response({ id: 'template-existing', object: 'template' }, null)
      ),
  } as unknown as ResendTemplateClient & {
    create: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    publish: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
}
