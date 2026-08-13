import type { ComponentType, PropsWithChildren, ReactElement } from 'react';
import { render, type RenderOptions } from '@testing-library/react';

export type ComponentFlowProvider = ComponentType<PropsWithChildren>;

export interface ComponentFlowProviders {
  router?: ComponentFlowProvider;
  i18n?: ComponentFlowProvider;
  auth?: ComponentFlowProvider;
  query?: ComponentFlowProvider;
  additional?: readonly ComponentFlowProvider[];
}

export interface ComponentFlowRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialUrl?: string;
  providers?: ComponentFlowProviders;
}

function composeProviders(providers: readonly ComponentFlowProvider[]): ComponentFlowProvider {
  return function ComponentFlowProviders({ children }) {
    return providers.reduceRight((content, Provider) => <Provider>{content}</Provider>, children);
  };
}

/**
 * Renders a user-flow boundary with an explicit provider order. Real auth,
 * router and data providers stay opt-in so a component-flow test cannot open a
 * live service accidentally. i18n is initialized once by vitest.setup.ts.
 */
export function renderComponentFlow(
  ui: ReactElement,
  { initialUrl = '/', providers = {}, ...options }: ComponentFlowRenderOptions = {}
) {
  window.history.replaceState({}, '', initialUrl);
  const orderedProviders = [
    providers.router,
    providers.i18n,
    providers.auth,
    providers.query,
    ...(providers.additional ?? []),
  ].filter((provider): provider is ComponentFlowProvider => provider !== undefined);

  return render(ui, {
    ...options,
    wrapper: composeProviders(orderedProviders),
  });
}
