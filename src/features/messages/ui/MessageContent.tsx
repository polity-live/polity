'use client';

import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  hasHttpUrlCredentials,
  isPolityLink,
  parseMessageWithLinks,
} from '@/features/messages/utils/url-utils.ts';
import { SmartLink } from '@/features/shared/ui/navigation/SmartLink';
import { cn } from '@/features/shared/utils/utils';
import { LinkPreview } from './LinkPreview.tsx';

interface MessageContentProps {
  content: string;
  className?: string;
  hidePolityLinkPreviews?: boolean;
  renderMarkdown?: boolean;
}

export function MessageContent({
  content,
  className = '',
  hidePolityLinkPreviews = false,
  renderMarkdown = false,
}: MessageContentProps) {
  const parts = parseMessageWithLinks(content);
  const urls = parts.filter(p => p.type === 'url').map(p => p.content);
  const safePreviewUrls = urls.filter(url => !hasHttpUrlCredentials(url));
  const previewUrls = hidePolityLinkPreviews
    ? safePreviewUrls.filter(url => !isPolityLink(url))
    : safePreviewUrls;

  return (
    <div className={cn('space-y-2', className)}>
      {/* Render text with inline links */}
      {renderMarkdown ? (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          skipHtml
          urlTransform={safeMarkdownUrlTransform}
          components={{
            p: ({ children }) => <p className="mb-3 leading-relaxed last:mb-0">{children}</p>,
            strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
            ul: ({ children }) => (
              <ul className="mb-3 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className="mb-3 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>
            ),
            li: ({ children }) => <li className="pl-0.5">{children}</li>,
            code: ({ className: codeClassName, children }) => (
              <code
                className={cn('bg-muted rounded px-1 py-0.5 font-mono text-[0.9em]', codeClassName)}
              >
                {children}
              </code>
            ),
            pre: ({ children }) => (
              <pre className="bg-muted mb-3 max-w-full overflow-x-auto rounded-xl p-3 text-sm last:mb-0 [&_code]:bg-transparent [&_code]:p-0">
                {children}
              </pre>
            ),
            table: ({ children }) => (
              <div className="mb-3 max-w-full overflow-x-auto rounded-xl border last:mb-0">
                <table className="w-full min-w-[32rem] border-collapse text-sm">{children}</table>
              </div>
            ),
            th: ({ children }) => (
              <th className="bg-muted/60 border-b px-3 py-2 text-left font-semibold">{children}</th>
            ),
            td: ({ children }) => (
              <td className="border-b px-3 py-2 align-top last:border-b-0">{children}</td>
            ),
            a: ({ href = '', children }) => {
              if (!href || hasHttpUrlCredentials(href)) {
                return <span>{children}</span>;
              }
              if (isInternalPolityHref(href)) {
                return (
                  <SmartLink
                    href={toInternalPolityHref(href)}
                    className="text-primary underline underline-offset-2"
                  >
                    {children}
                  </SmartLink>
                );
              }
              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2"
                >
                  {children}
                </a>
              );
            },
            img: ({ alt }) => <span>{alt ?? ''}</span>,
          }}
        >
          {content}
        </ReactMarkdown>
      ) : (
        <div className="whitespace-pre-wrap">
          {parts.map((part, index) => {
            if (part.type === 'text') {
              return <span key={index}>{part.content}</span>;
            }

            if (hasHttpUrlCredentials(part.content)) {
              return <span key={index}>{part.content}</span>;
            }

            if (isPolityLink(part.content)) {
              const href = toInternalPolityHref(part.content);
              return (
                <SmartLink
                  key={index}
                  href={href}
                  className="text-primary hover:text-primary/80 underline"
                >
                  {part.content}
                </SmartLink>
              );
            }

            return (
              <a
                key={index}
                href={part.content}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80 underline"
              >
                {part.content}
              </a>
            );
          })}
        </div>
      )}

      {/* Render link previews below */}
      {previewUrls.length > 0 && (
        <div className="mt-2 space-y-2">
          {previewUrls.map((url, index) => (
            <LinkPreview key={index} url={url} />
          ))}
        </div>
      )}
    </div>
  );
}

function isInternalPolityHref(href: string): boolean {
  return /^\/(?!\/)/.test(href) || isPolityLink(href);
}

function safeMarkdownUrlTransform(url: string): string {
  if (hasHttpUrlCredentials(url)) {
    return '';
  }

  if (/^\/(?!\/)/.test(url) || /^(https?:|mailto:)/i.test(url)) {
    return defaultUrlTransform(url);
  }
  return '';
}

function toInternalPolityHref(href: string): string {
  try {
    const baseOrigin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'https://polity.local';
    const url = new URL(href, baseOrigin);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return href.startsWith('/') ? href : `/${href}`;
  }
}
