import { createElement, type ReactElement } from 'react';
import { render, toPlainText } from 'react-email';

import NewsletterEmail, { newsletterPreviewText } from './newsletter';
import ProductUpdateEmail, { productUpdatePreviewText } from './product-update';

export const polityTemplateSlugs = ['newsletter', 'product-update'] as const;
export type PolityTemplateSlug = (typeof polityTemplateSlugs)[number];
export type PolityTemplateEnvironment = 'development' | 'production';

export type PolityTemplateVariable =
  | { fallbackValue?: string | null; key: string; type: 'string' }
  | { fallbackValue?: number | null; key: string; type: 'number' };

export interface PolityTemplateDefinition {
  alias: string;
  component: ReactElement;
  environment: PolityTemplateEnvironment;
  from: string;
  name: string;
  previewText: string;
  replyTo: string;
  slug: PolityTemplateSlug;
  subject: string;
  variables: PolityTemplateVariable[];
}

type TemplateSource = Omit<
  PolityTemplateDefinition,
  'alias' | 'component' | 'environment' | 'name'
> & {
  aliasBase: string;
  component: () => ReactElement;
  nameBase: string;
};

const templateSources: Record<PolityTemplateSlug, TemplateSource> = {
  newsletter: {
    aliasBase: 'polity-newsletter-de',
    component: () => createElement(NewsletterEmail),
    from: 'Polity <team@polity.live>',
    nameBase: 'Polity Newsletter',
    previewText: newsletterPreviewText,
    replyTo: 'team@polity.live',
    slug: 'newsletter',
    subject: 'Neues aus der Polity-Community',
    variables: [],
  },
  'product-update': {
    aliasBase: 'polity-product-update-de',
    component: () => createElement(ProductUpdateEmail),
    from: 'Polity <team@polity.live>',
    nameBase: 'Polity Produktupdate',
    previewText: productUpdatePreviewText,
    replyTo: 'team@polity.live',
    slug: 'product-update',
    subject: 'Produktupdate: Neues bei Polity',
    variables: [],
  },
};

export function isPolityTemplateSlug(value: string): value is PolityTemplateSlug {
  return polityTemplateSlugs.includes(value as PolityTemplateSlug);
}

export function getPolityTemplateDefinition(
  slug: PolityTemplateSlug,
  environment: PolityTemplateEnvironment
): PolityTemplateDefinition {
  const source = templateSources[slug];
  const environmentLabel = environment === 'production' ? 'Production' : 'Development';

  return {
    alias: `${source.aliasBase}-${environment}`,
    component: source.component(),
    environment,
    from: source.from,
    name: `${source.nameBase} [${environmentLabel}]`,
    previewText: source.previewText,
    replyTo: source.replyTo,
    slug: source.slug,
    subject: source.subject,
    variables: source.variables,
  };
}

export async function renderPolityTemplate(definition: PolityTemplateDefinition) {
  const html = await render(definition.component);
  return {
    html,
    text: toPlainText(html),
  };
}
