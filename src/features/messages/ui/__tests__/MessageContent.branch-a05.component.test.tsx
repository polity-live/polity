// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { MessageContent } from '../MessageContent';

const mocks = vi.hoisted(() => ({
  hrefs: ['/group/one', 'https://external.test', '', 'cred://bad'] as string[],
}));

vi.mock('react-markdown', () => ({
  default: ({ components, urlTransform }: any) => (
    <div>
      {mocks.hrefs.map((href, index) => (
        <span key={index}>{components.a({ href, children: `link-${index}` })}</span>
      ))}
      {components.img({ alt: undefined })}
      {components.ol({ children: <li>ordered</li> })}
      {components.pre({ children: <code>block</code> })}
      <i>{urlTransform('cred://bad')}</i>
      <i>{urlTransform('/safe')}</i>
      <i>{urlTransform('mailto:user@example.test')}</i>
      <i>{urlTransform('unsafe:thing')}</i>
    </div>
  ),
  defaultUrlTransform: (url: string) => `safe:${url}`,
}));
vi.mock('remark-gfm', () => ({ default: () => undefined }));
vi.mock('@/features/messages/utils/url-utils.ts', () => ({
  hasHttpUrlCredentials: (value: string) => value.startsWith('cred:'),
  isPolityLink: (value: string) => value.startsWith('/') || value.startsWith('polity'),
  parseMessageWithLinks: () => [],
}));
vi.mock('@/features/shared/ui/navigation/SmartLink', () => ({
  SmartLink: ({ children, href }: any) => <a href={href}>{children}</a>,
}));
vi.mock('../LinkPreview.tsx', () => ({ LinkPreview: () => null }));
vi.mock('@/features/shared/utils/utils', () => ({
  cn: (...v: unknown[]) => v.filter(Boolean).join(' '),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  mocks.hrefs = ['/group/one', 'https://external.test', '', 'cred://bad'];
});

it('executes markdown URL, image-alt and internal URL failure fallbacks', () => {
  const rendered = render(<MessageContent renderMarkdown content="content" />);
  expect(rendered.container.textContent).toContain('link-0');
  expect(rendered.container.textContent).toContain('safe:/safe');
  expect(rendered.container.textContent).toContain('safe:mailto:user@example.test');

  function ThrowingURL() {
    throw new Error('invalid');
  }
  vi.stubGlobal('URL', ThrowingURL);
  mocks.hrefs = ['/still-internal', 'polity-invalid'];
  rendered.rerender(<MessageContent renderMarkdown content="next" />);
  const links = rendered.container.querySelectorAll('a');
  expect(links[0].getAttribute('href')).toBe('/still-internal');
  expect(links[1].getAttribute('href')).toBe('/polity-invalid');
});
