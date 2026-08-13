// @vitest-environment node

import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';

import { MessageContent } from '../MessageContent';

vi.mock('react-markdown', () => ({
  default: ({ components }: any) => (
    <>
      {components.a({ href: 'https://www.polity.live/group/one?tab=x#hash', children: 'Polity' })}
    </>
  ),
  defaultUrlTransform: (url: string) => url,
}));
vi.mock('remark-gfm', () => ({ default: () => undefined }));
vi.mock('@/features/messages/utils/url-utils.ts', () => ({
  hasHttpUrlCredentials: () => false,
  isPolityLink: () => true,
  parseMessageWithLinks: () => [],
}));
vi.mock('@/features/shared/ui/navigation/SmartLink', () => ({
  SmartLink: ({ children, href }: any) => <a href={href}>{children}</a>,
}));
vi.mock('../LinkPreview.tsx', () => ({ LinkPreview: () => null }));

it('normalizes absolute Polity links with the SSR base-origin fallback', () => {
  expect(renderToStaticMarkup(<MessageContent renderMarkdown content="content" />)).toContain(
    'href="/group/one?tab=x#hash"'
  );
});
