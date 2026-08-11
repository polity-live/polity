import type { ErrorResponse, Resend, UpdateTemplateOptions } from 'resend';

import type { PolityTemplateDefinition, PolityTemplateEnvironment } from '../../emails/_registry';

export type ResendTemplateClient = Pick<
  Resend['templates'],
  'create' | 'get' | 'publish' | 'update'
>;

export interface RenderedPolityTemplate {
  html: string;
  text: string;
}

export interface TemplateDeploymentResult {
  action: 'created' | 'dry-run' | 'updated';
  alias: string;
  id: string | null;
  published: boolean;
}

interface DeployPolityTemplateOptions {
  client: ResendTemplateClient;
  definition: PolityTemplateDefinition;
  dryRun?: boolean;
  rendered: RenderedPolityTemplate;
}

export class ResendTemplateDeploymentError extends Error {
  constructor(
    action: string,
    public readonly resendError: ErrorResponse
  ) {
    super(`${action} failed: ${JSON.stringify(resendError)}`);
    this.name = 'ResendTemplateDeploymentError';
  }
}

export function assertTemplateEnvironment(
  requested: PolityTemplateEnvironment,
  configured: string | undefined
) {
  if (configured && configured !== requested) {
    throw new Error(`NEWSLETTER_ENVIRONMENT must be ${requested}; received ${configured}`);
  }
}

export async function deployPolityTemplate({
  client,
  definition,
  dryRun = false,
  rendered,
}: DeployPolityTemplateOptions): Promise<TemplateDeploymentResult> {
  if (dryRun) {
    return {
      action: 'dry-run',
      alias: definition.alias,
      id: null,
      published: false,
    };
  }

  const existing = await client.get(definition.alias);
  if (existing.error && !isNotFound(existing.error)) {
    throw new ResendTemplateDeploymentError('Template lookup', existing.error);
  }

  const payload: UpdateTemplateOptions = {
    alias: definition.alias,
    from: definition.from,
    html: rendered.html,
    name: definition.name,
    replyTo: definition.replyTo,
    subject: definition.subject,
    text: rendered.text,
    variables: definition.variables,
  };

  let action: TemplateDeploymentResult['action'];
  let templateId: string;

  if (existing.data) {
    const updated = await client.update(existing.data.id, payload);
    if (updated.error) {
      throw new ResendTemplateDeploymentError('Template update', updated.error);
    }
    if (!updated.data) {
      throw new Error('Template update returned no data');
    }
    action = 'updated';
    templateId = updated.data.id;
  } else {
    const created = await client.create({
      alias: definition.alias,
      from: definition.from,
      html: rendered.html,
      name: definition.name,
      replyTo: definition.replyTo,
      subject: definition.subject,
      text: rendered.text,
      variables: definition.variables,
    });
    if (created.error) {
      throw new ResendTemplateDeploymentError('Template creation', created.error);
    }
    if (!created.data) {
      throw new Error('Template creation returned no data');
    }
    action = 'created';
    templateId = created.data.id;
  }

  const published = await client.publish(templateId);
  if (published.error) {
    throw new ResendTemplateDeploymentError('Template publish', published.error);
  }
  if (!published.data) {
    throw new Error('Template publish returned no data');
  }

  return {
    action,
    alias: definition.alias,
    id: templateId,
    published: true,
  };
}

function isNotFound(error: ErrorResponse) {
  return error.statusCode === 404 || error.name === 'not_found';
}
