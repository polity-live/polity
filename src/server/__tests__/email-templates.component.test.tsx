import { describe, expect, it } from 'vitest';

import {
  getPolityTemplateDefinition,
  polityTemplateLocales,
  polityTemplateSlugs,
  renderPolityTemplate,
  type PolityTemplateEnvironment,
} from '../../../emails/_registry';

describe('Polity email templates', () => {
  it.each(
    polityTemplateSlugs.flatMap(slug => polityTemplateLocales.map(locale => ({ locale, slug })))
  )('renders $slug/$locale as HTML and plain text', async ({ locale, slug }) => {
    const definition = getPolityTemplateDefinition(slug, 'development', locale);
    const rendered = await renderPolityTemplate(definition);

    expect(rendered.html).toContain('<!DOCTYPE');
    expect(rendered.html).toContain(definition.previewText);
    expect(rendered.html).toContain('{{{RESEND_UNSUBSCRIBE_URL}}}');
    expect(rendered.html).toContain('https://www.polity.live/imprint');
    expect(rendered.html).toContain('https://www.polity.live/privacy-policy');
    expect(rendered.html).toContain(`lang="${locale}"`);
    expect(rendered.text).toContain(
      locale === 'de' ? 'Newsletter abbestellen' : 'Unsubscribe from newsletter'
    );
    expect(rendered.text).not.toContain('<table');
  });

  it('builds unique, environment-specific aliases and names', () => {
    const environments: PolityTemplateEnvironment[] = ['development', 'production'];
    const definitions = environments.flatMap(environment =>
      polityTemplateSlugs.flatMap(slug =>
        polityTemplateLocales.map(locale => getPolityTemplateDefinition(slug, environment, locale))
      )
    );

    expect(new Set(definitions.map(({ alias }) => alias)).size).toBe(definitions.length);
    expect(definitions.map(({ alias }) => alias)).toEqual([
      'polity-newsletter-de-development',
      'polity-newsletter-en-development',
      'polity-product-update-de-development',
      'polity-product-update-en-development',
      'polity-newsletter-de-production',
      'polity-newsletter-en-production',
      'polity-product-update-de-production',
      'polity-product-update-en-production',
    ]);
    expect(definitions.map(({ name }) => name)).toEqual([
      'Polity Newsletter DE [Development]',
      'Polity Newsletter EN [Development]',
      'Polity Produktupdate DE [Development]',
      'Polity Produktupdate EN [Development]',
      'Polity Newsletter DE [Production]',
      'Polity Newsletter EN [Production]',
      'Polity Produktupdate DE [Production]',
      'Polity Produktupdate EN [Production]',
    ]);
  });
});
