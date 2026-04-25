import {
  Facebook,
  Globe,
  Ghost,
  Instagram,
  Linkedin,
  MessageSquare,
  Music2,
  Twitter,
  Youtube,
} from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { ContactLinksSection } from '@/features/shared/ui/contact/ContactLinksSection';
import type { GroupFormData } from '../hooks/useGroupUpdate';

interface SocialMediaSectionProps {
  formData: GroupFormData;
  onChange: (field: keyof GroupFormData, value: string) => void;
}

export function SocialMediaSection({ formData, onChange }: SocialMediaSectionProps) {
  const { t } = useTranslation();

  return (
    <ContactLinksSection
      title={t('features.groups.contact.title')}
      description={t('features.groups.contact.description')}
      primaryFields={[
        {
          id: 'group-website',
          label: t('features.groups.contact.websiteLabel'),
          placeholder: t('features.groups.contact.websitePlaceholder'),
          value: formData.website,
          onChange: value => onChange('website', value),
          icon: <Globe className="h-4 w-4" />,
        },
        {
          id: 'group-youtube',
          label: t('features.groups.contact.youtubeLabel'),
          placeholder: t('features.groups.contact.youtubePlaceholder'),
          value: formData.youtube,
          onChange: value => onChange('youtube', value),
          icon: <Youtube className="h-4 w-4" />,
        },
        {
          id: 'group-linkedin',
          label: t('features.groups.contact.linkedinLabel'),
          placeholder: t('features.groups.contact.linkedinPlaceholder'),
          value: formData.linkedin,
          onChange: value => onChange('linkedin', value),
          icon: <Linkedin className="h-4 w-4" />,
        },
      ]}
      socialTitle={t('features.groups.contact.socialTitle')}
      socialDescription={t('features.groups.contact.socialDescription')}
      socialFields={[
        {
          id: 'group-whatsapp',
          label: t('features.groups.contact.whatsappLabel'),
          placeholder: t('features.groups.contact.whatsappPlaceholder'),
          value: formData.whatsapp,
          onChange: value => onChange('whatsapp', value),
          icon: <MessageSquare className="h-4 w-4" />,
        },
        {
          id: 'group-instagram',
          label: t('features.groups.contact.instagramLabel'),
          placeholder: t('features.groups.contact.instagramPlaceholder'),
          value: formData.instagram,
          onChange: value => onChange('instagram', value),
          icon: <Instagram className="h-4 w-4" />,
        },
        {
          id: 'group-twitter',
          label: t('features.groups.contact.twitterLabel'),
          placeholder: t('features.groups.contact.twitterPlaceholder'),
          value: formData.twitter,
          onChange: value => onChange('twitter', value),
          icon: <Twitter className="h-4 w-4" />,
        },
        {
          id: 'group-facebook',
          label: t('features.groups.contact.facebookLabel'),
          placeholder: t('features.groups.contact.facebookPlaceholder'),
          value: formData.facebook,
          onChange: value => onChange('facebook', value),
          icon: <Facebook className="h-4 w-4" />,
        },
        {
          id: 'group-snapchat',
          label: t('features.groups.contact.snapchatLabel'),
          placeholder: t('features.groups.contact.snapchatPlaceholder'),
          value: formData.snapchat,
          onChange: value => onChange('snapchat', value),
          icon: <Ghost className="h-4 w-4" />,
        },
        {
          id: 'group-tiktok',
          label: t('features.groups.contact.tiktokLabel'),
          placeholder: t('features.groups.contact.tiktokPlaceholder'),
          value: formData.tiktok,
          onChange: value => onChange('tiktok', value),
          icon: <Music2 className="h-4 w-4" />,
        },
      ]}
    />
  );
}
