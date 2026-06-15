'use client';

import { isPolityLink, parseMessageWithLinks } from '@/features/messages/utils/url-utils.ts';
import { SmartLink } from '@/features/shared/ui/navigation/SmartLink';
import { LinkPreview } from './LinkPreview.tsx';

interface MessageContentProps {
  content: string;
  className?: string;
  hidePolityLinkPreviews?: boolean;
}

export function MessageContent({
  content,
  className = '',
  hidePolityLinkPreviews = false,
}: MessageContentProps) {
  const parts = parseMessageWithLinks(content);
  const urls = parts.filter(p => p.type === 'url').map(p => p.content);
  const previewUrls = hidePolityLinkPreviews ? urls.filter(url => !isPolityLink(url)) : urls;

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Render text with inline links */}
      <div className="whitespace-pre-wrap">
        {parts.map((part, index) => {
          if (part.type === 'text') {
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
