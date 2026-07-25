import {
  getSupabaseAuthTemplateDefinition,
  renderSupabaseAuthTemplate,
  supabaseAuthTemplateSlugs,
} from '../../emails/auth/_registry';

export type SupabaseAuthTemplatePayload = Record<string, string>;

interface DeploySupabaseAuthTemplatesOptions {
  accessToken: string;
  dryRun?: boolean;
  fetchImpl?: typeof fetch;
  projectRef: string;
}

export interface SupabaseAuthTemplateDeploymentResult {
  changedFields: string[];
  deployed: boolean;
}

export async function buildSupabaseAuthTemplatePayload() {
  const payload: SupabaseAuthTemplatePayload = {};
  for (const slug of supabaseAuthTemplateSlugs) {
    const definition = getSupabaseAuthTemplateDefinition(slug);
    payload[definition.subjectField] = definition.subject;
    payload[definition.contentField] = await renderSupabaseAuthTemplate(slug);
  }
  return payload;
}

export async function deploySupabaseAuthTemplates({
  accessToken,
  dryRun = false,
  fetchImpl = fetch,
  projectRef,
}: DeploySupabaseAuthTemplatesOptions): Promise<SupabaseAuthTemplateDeploymentResult> {
  const endpoint = `https://api.supabase.com/v1/projects/${projectRef}/config/auth`;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
  const desired = await buildSupabaseAuthTemplatePayload();
  const current = await requestJson(fetchImpl, endpoint, { headers });
  const changedFields = Object.keys(desired).filter(field => current[field] !== desired[field]);

  if (dryRun || changedFields.length === 0) {
    return { changedFields, deployed: false };
  }

  const patchPayload = Object.fromEntries(changedFields.map(field => [field, desired[field]]));
  await requestJson(fetchImpl, endpoint, {
    body: JSON.stringify(patchPayload),
    headers,
    method: 'PATCH',
  });

  const verified = await requestJson(fetchImpl, endpoint, { headers });
  const failedFields = changedFields.filter(field => verified[field] !== desired[field]);
  if (failedFields.length > 0) {
    throw new Error(`Supabase template verification failed for: ${failedFields.join(', ')}`);
  }

  return { changedFields, deployed: true };
}

async function requestJson(
  fetchImpl: typeof fetch,
  endpoint: string,
  init: RequestInit
): Promise<Record<string, unknown>> {
  const response = await fetchImpl(endpoint, init);
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase Management API ${response.status}: ${body}`);
  }
  return body ? (JSON.parse(body) as Record<string, unknown>) : {};
}
