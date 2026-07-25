import { createElement, type ReactElement } from 'react';
import { render, toPlainText } from 'react-email';

import NewsletterEmail, { newsletterContent } from './newsletter';
import ProductUpdateEmail, { productUpdateContent } from './product-update';

export const polityTemplateSlugs = ['newsletter', 'product-update'] as const;
export type PolityTemplateSlug = (typeof polityTemplateSlugs)[number];
export type PolityTemplateEnvironment = 'development' | 'production';
export type PolityTemplateLocale = 'de' | 'en';
export const polityTemplateLocales: PolityTemplateLocale[] = ['de', 'en'];

export type PolityTemplateVariable =
  | { fallbackValue?: string | null; key: string; type: 'string' }
  | { fallbackValue?: number | null; key: string; type: 'number' };

export interface PolityTemplateDefinition {
  alias: string;
  component: ReactElement;
  environment: PolityTemplateEnvironment;
  locale: PolityTemplateLocale;
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
  'alias' | 'component' | 'environment' | 'locale' | 'name' | 'previewText' | 'subject'
> & {
  aliasBase: string;
  component: (locale: PolityTemplateLocale) => ReactElement;
  content: Record<PolityTemplateLocale, { preview: string; subject: string }>;
  nameBase: string;
};

const templateSources: Record<PolityTemplateSlug, TemplateSource> = {
  newsletter: {
    aliasBase: 'polity-newsletter',
    component: locale => createElement(NewsletterEmail, { language: locale }),
    content: newsletterContent,
    from: 'Polity <team@polity.live>',
    nameBase: 'Polity Newsletter',
    replyTo: 'team@polity.live',
    slug: 'newsletter',
    variables: [],
  },
  'product-update': {
    aliasBase: 'polity-product-update',
    component: locale => createElement(ProductUpdateEmail, { language: locale }),
    content: productUpdateContent,
    from: 'Polity <team@polity.live>',
    nameBase: 'Polity Produktupdate',
    replyTo: 'team@polity.live',
    slug: 'product-update',
    variables: [],
  },
};

export function isPolityTemplateSlug(value: string): value is PolityTemplateSlug {
  return polityTemplateSlugs.includes(value as PolityTemplateSlug);
}

export function getPolityTemplateDefinition(
  slug: PolityTemplateSlug,
  environment: PolityTemplateEnvironment,
  locale: PolityTemplateLocale = 'de'
): PolityTemplateDefinition {
  const source = templateSources[slug];
  const environmentLabel = environment === 'production' ? 'Production' : 'Development';

  return {
    alias: `${source.aliasBase}-${locale}-${environment}`,
    component: source.component(locale),
    environment,
    from: source.from,
    locale,
    name: `${source.nameBase} ${locale.toUpperCase()} [${environmentLabel}]`,
    previewText: source.content[locale].preview,
    replyTo: source.replyTo,
    slug: source.slug,
    subject: source.content[locale].subject,
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
