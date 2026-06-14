import React from 'react';
import { TooltipProvider } from '@/features/shared/ui/ui/tooltip';
import {
  MessageSquare,
  Instagram,
  Facebook,
  Ghost,
  Globe,
  Linkedin,
  Music2,
  Twitter,
  Youtube,
} from 'lucide-react';
import { buildContactLinkHref } from '@/features/shared/logic/contactLinkHelpers';
import { SocialItem } from './SocialItem';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

export interface SocialMediaLinks {
  website?: string;
  youtube?: string;
  linkedin?: string;
  whatsapp?: string;
  instagram?: string;
  twitter?: string;
  facebook?: string;
  snapchat?: string;
  tiktok?: string;
}

interface SocialBarProps {
  socialMedia: SocialMediaLinks;
}

export const SocialBar: React.FC<SocialBarProps> = ({ socialMedia }) => {
  const items = [
    {
      key: 'website',
      href: buildContactLinkHref('website', socialMedia.website),
      label: translateText('generated.inline.0573_website_2e8a57cc'),
      icon: <Globe size={24} />,
      className:
        'text-cyan-600 transition-transform duration-200 hover:scale-110 hover:text-cyan-700',
    },
    {
      key: 'youtube',
      href: buildContactLinkHref('youtube', socialMedia.youtube),
      label: translateText('generated.inline.0512_youtube_558865a1'),
      icon: <Youtube size={24} />,
      className:
        'text-red-600 transition-transform duration-200 hover:scale-110 hover:text-red-700',
    },
    {
      key: 'linkedin',
      href: buildContactLinkHref('linkedin', socialMedia.linkedin),
      label: translateText('generated.inline.0508_linkedin_6b6390a4'),
      icon: <Linkedin size={24} />,
      className:
        'text-sky-700 transition-transform duration-200 hover:scale-110 hover:text-sky-800',
    },
    {
      key: 'whatsapp',
      href: buildContactLinkHref('whatsapp', socialMedia.whatsapp),
      label: translateText('generated.inline.0505_whatsapp_b336fc55'),
      icon: <MessageSquare size={24} />,
      className:
        'text-green-500 transition-transform duration-200 hover:scale-110 hover:text-green-600',
    },
    {
      key: 'instagram',
      href: buildContactLinkHref('instagram', socialMedia.instagram),
      label: translateText('generated.inline.0509_instagram_5721bbef'),
      icon: <Instagram size={24} />,
      className:
        'text-pink-500 transition-transform duration-200 hover:scale-110 hover:text-pink-600',
    },
    {
      key: 'twitter',
      href: buildContactLinkHref('twitter', socialMedia.twitter),
      label: translateText('generated.inline.0506_x_twitter_9ae44c18'),
      icon: <Twitter size={24} />,
      className:
        'text-gray-800 transition-transform duration-200 hover:scale-110 hover:text-gray-600 dark:text-gray-300 dark:hover:text-gray-400',
    },
    {
      key: 'facebook',
      href: buildContactLinkHref('facebook', socialMedia.facebook),
      label: translateText('generated.inline.0507_facebook_82da67b2'),
      icon: <Facebook size={24} />,
      className:
        'text-blue-600 transition-transform duration-200 hover:scale-110 hover:text-blue-700',
    },
    {
      key: 'snapchat',
      href: buildContactLinkHref('snapchat', socialMedia.snapchat),
      label: translateText('generated.inline.0510_snapchat_ba4ed635'),
      icon: <Ghost size={24} />,
      className:
        'text-yellow-400 transition-transform duration-200 hover:scale-110 hover:text-yellow-500',
    },
    {
      key: 'tiktok',
      href: buildContactLinkHref('tiktok', socialMedia.tiktok),
      label: translateText('generated.inline.0511_tiktok_fc49f156'),
      icon: <Music2 size={24} />,
      className:
        'text-zinc-900 transition-transform duration-200 hover:scale-110 hover:text-zinc-700 dark:text-zinc-100 dark:hover:text-zinc-300',
    },
  ].flatMap(item => (item.href ? [{ ...item, href: item.href }] : []));

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="mb-8 flex justify-center py-2">
      <TooltipProvider>
        <div className="bg-background/85 flex flex-wrap items-center justify-center gap-6 rounded-full border px-6 py-3 shadow-sm backdrop-blur-sm">
          {items.map(item => (
            <SocialItem
              key={item.key}
              href={item.href}
              label={item.label}
              icon={item.icon}
              className={item.className}
            />
          ))}
        </div>
      </TooltipProvider>
    </div>
  );
};
