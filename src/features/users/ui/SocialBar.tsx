import { featureThemeClassName } from '@/features/shared/theme';
import React from 'react';
import { TooltipProvider } from '@/features/shared/ui/ui/tooltip';
import { MessageSquare, Ghost, Globe, Music2 } from 'lucide-react';
import { buildContactLinkHref } from '@/features/shared/logic/contactLinkHelpers';
import { SocialItem } from './SocialItem';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import {
  FacebookIcon as Facebook,
  InstagramIcon as Instagram,
  LinkedinIcon as Linkedin,
  TwitterIcon as Twitter,
  YoutubeIcon as Youtube,
} from '@/features/shared/ui/icons';

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
      className: featureThemeClassName('userSocialBarInfoText'),
    },
    {
      key: 'youtube',
      href: buildContactLinkHref('youtube', socialMedia.youtube),
      label: translateText('generated.inline.0512_youtube_558865a1'),
      icon: <Youtube size={24} />,
      className: featureThemeClassName('userSocialBarDangerText'),
    },
    {
      key: 'linkedin',
      href: buildContactLinkHref('linkedin', socialMedia.linkedin),
      label: translateText('generated.inline.0508_linkedin_6b6390a4'),
      icon: <Linkedin size={24} />,
      className: featureThemeClassName('userSocialBarInfoTextAlpha'),
    },
    {
      key: 'whatsapp',
      href: buildContactLinkHref('whatsapp', socialMedia.whatsapp),
      label: translateText('generated.inline.0505_whatsapp_b336fc55'),
      icon: <MessageSquare size={24} />,
      className: featureThemeClassName('userSocialBarSuccessText'),
    },
    {
      key: 'instagram',
      href: buildContactLinkHref('instagram', socialMedia.instagram),
      label: translateText('generated.inline.0509_instagram_5721bbef'),
      icon: <Instagram size={24} />,
      className: featureThemeClassName('userSocialBarAccentText'),
    },
    {
      key: 'twitter',
      href: buildContactLinkHref('twitter', socialMedia.twitter),
      label: translateText('generated.inline.0506_x_twitter_9ae44c18'),
      icon: <Twitter size={24} />,
      className: featureThemeClassName('userSocialBarNeutralText'),
    },
    {
      key: 'facebook',
      href: buildContactLinkHref('facebook', socialMedia.facebook),
      label: translateText('generated.inline.0507_facebook_82da67b2'),
      icon: <Facebook size={24} />,
      className: featureThemeClassName('userSocialBarInfoTextBeta'),
    },
    {
      key: 'snapchat',
      href: buildContactLinkHref('snapchat', socialMedia.snapchat),
      label: translateText('generated.inline.0510_snapchat_ba4ed635'),
      icon: <Ghost size={24} />,
      className: featureThemeClassName('userSocialBarWarningText'),
    },
    {
      key: 'tiktok',
      href: buildContactLinkHref('tiktok', socialMedia.tiktok),
      label: translateText('generated.inline.0511_tiktok_fc49f156'),
      icon: <Music2 size={24} />,
      className: featureThemeClassName('userSocialBarNeutralTextAlpha'),
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
