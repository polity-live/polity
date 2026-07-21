import { describe, expect, it } from 'vitest';

import {
  getPolityTemplateDefinition,
  polityTemplateSlugs,
  renderPolityTemplate,
  type PolityTemplateEnvironment,
} from '../../../emails/_registry';

describe('Polity email templates', () => {
  it.each(polityTemplateSlugs)('renders %s as HTML and plain text', async slug => {
    const definition = getPolityTemplateDefinition(slug, 'development');
    const rendered = await renderPolityTemplate(definition);

    expect(rendered.html).toContain('<!DOCTYPE');
    expect(rendered.html).toContain(definition.previewText);
    expect(rendered.html).toContain('{{{RESEND_UNSUBSCRIBE_URL}}}');
    expect(rendered.html).toContain('https://www.polity.live/imprint');
    expect(rendered.html).toContain('https://www.polity.live/privacy-policy');
    expect(rendered.text).toContain('Newsletter abbestellen');
    expect(rendered.text).not.toContain('<table');
  });

  it('builds unique, environment-specific aliases and names', () => {
    const environments: PolityTemplateEnvironment[] = ['development', 'production'];
    const definitions = environments.flatMap(environment =>
      polityTemplateSlugs.map(slug => getPolityTemplateDefinition(slug, environment))
    );

    expect(new Set(definitions.map(({ alias }) => alias)).size).toBe(definitions.length);
    expect(definitions.map(({ alias }) => alias)).toEqual([
      'polity-newsletter-de-development',
      'polity-product-update-de-development',
      'polity-newsletter-de-production',
      'polity-product-update-de-production',
    ]);
    expect(definitions.map(({ name }) => name)).toEqual([
      'Polity Newsletter [Development]',
      'Polity Produktupdate [Development]',
      'Polity Newsletter [Production]',
      'Polity Produktupdate [Production]',
    ]);
  });
});
