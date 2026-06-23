import { forwardRef, type ReactNode } from 'react';
import type { LucideIcon, LucideProps } from 'lucide-react';

function createBrandIcon(displayName: string, children: ReactNode): LucideIcon {
  const Icon = forwardRef<SVGSVGElement, Omit<LucideProps, 'ref'>>(
    (
      { color = 'currentColor', size = 24, strokeWidth = 2, absoluteStrokeWidth, ...props },
      ref
    ) => {
      const effectiveStrokeWidth =
        absoluteStrokeWidth && typeof size === 'number'
          ? (Number(strokeWidth) * 24) / size
          : strokeWidth;

      return (
        <svg
          ref={ref}
          xmlns="http://www.w3.org/2000/svg"
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth={effectiveStrokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          {...props}
        >
          {children}
        </svg>
      );
    }
  );

  Icon.displayName = displayName;
  return Icon;
}

export const FacebookIcon = createBrandIcon(
  'FacebookIcon',
  <path d="M14 8h2V4h-3a5 5 0 0 0-5 5v3H5v4h3v4h4v-4h3l1-4h-4V9a1 1 0 0 1 1-1h1z" />
);

export const InstagramIcon = createBrandIcon(
  'InstagramIcon',
  <>
    <rect width="17" height="17" x="3.5" y="3.5" rx="5" />
    <circle cx="12" cy="12" r="3.5" />
    <circle cx="17" cy="7" r="0.75" fill="currentColor" stroke="none" />
  </>
);

export const LinkedinIcon = createBrandIcon(
  'LinkedinIcon',
  <>
    <path d="M6.5 10v8" />
    <path d="M6.5 6.5v.01" />
    <path d="M10.5 18v-8" />
    <path d="M10.5 13.5a3.5 3.5 0 0 1 7 0V18" />
  </>
);

export const TwitterIcon = createBrandIcon(
  'TwitterIcon',
  <>
    <path d="M4 4l16 16" />
    <path d="M20 4 4 20" />
  </>
);

export const YoutubeIcon = createBrandIcon(
  'YoutubeIcon',
  <>
    <path d="M21.5 8.5a3 3 0 0 0-2.1-2.1C17.6 6 12 6 12 6s-5.6 0-7.4.4a3 3 0 0 0-2.1 2.1A31 31 0 0 0 2 12a31 31 0 0 0 .5 3.5 3 3 0 0 0 2.1 2.1c1.8.4 7.4.4 7.4.4s5.6 0 7.4-.4a3 3 0 0 0 2.1-2.1A31 31 0 0 0 22 12a31 31 0 0 0-.5-3.5z" />
    <path d="m10 9 5 3-5 3z" />
  </>
);
