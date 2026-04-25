import {
  Facebook,
  Globe,
  Ghost,
  Instagram,
  Linkedin,
  Mail,
  MessageSquare,
  Music2,
  Twitter,
  Youtube,
} from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { ContactLinksSection } from '@/features/shared/ui/contact/ContactLinksSection';

interface ContactInformationSectionProps {
  email: string;
  website: string;
  youtube: string;
  linkedin: string;
  whatsapp: string;
  instagram: string;
  twitter: string;
  facebook: string;
  snapchat: string;
  tiktok: string;
  onEmailChange: (value: string) => void;
  onWebsiteChange: (value: string) => void;
  onYoutubeChange: (value: string) => void;
  onLinkedinChange: (value: string) => void;
  onWhatsappChange: (value: string) => void;
  onInstagramChange: (value: string) => void;
  onTwitterChange: (value: string) => void;
  onFacebookChange: (value: string) => void;
  onSnapchatChange: (value: string) => void;
  onTiktokChange: (value: string) => void;
}

export function ContactInformationSection({
  email,
  website,
  youtube,
  linkedin,
  whatsapp,
  instagram,
  twitter,
  facebook,
  snapchat,
  tiktok,
  onEmailChange,
  onWebsiteChange,
  onYoutubeChange,
  onLinkedinChange,
  onWhatsappChange,
  onInstagramChange,
  onTwitterChange,
  onFacebookChange,
  onSnapchatChange,
  onTiktokChange,
}: ContactInformationSectionProps) {
  const { t } = useTranslation();

  return (
    <ContactLinksSection
      title={t('pages.user.settingsForm.contact.title')}
      description={t('pages.user.settingsForm.contact.description')}
      primaryFields={[
        {
          id: 'email',
          label: t('pages.user.settingsForm.contact.emailLabel'),
          placeholder: t('pages.user.settingsForm.contact.emailPlaceholder'),
          value: email,
          onChange: onEmailChange,
          icon: <Mail className="h-4 w-4" />,
          type: 'email',
        },
        {
          id: 'website',
          label: t('pages.user.settingsForm.contact.websiteLabel'),
          placeholder: t('pages.user.settingsForm.contact.websitePlaceholder'),
          value: website,
          onChange: onWebsiteChange,
          icon: <Globe className="h-4 w-4" />,
          helpText: t('pages.user.settingsForm.contact.websiteHint'),
        },
      ]}
      socialTitle={t('pages.user.settingsForm.contact.socialTitle')}
      socialDescription={t('pages.user.settingsForm.contact.socialDescription')}
      socialFields={[
        {
          id: 'whatsapp',
          label: t('pages.user.settingsForm.contact.whatsappLabel'),
          placeholder: t('pages.user.settingsForm.contact.whatsappPlaceholder'),
          value: whatsapp,
          onChange: onWhatsappChange,
          icon: <MessageSquare className="h-4 w-4" />,
        },
        {
          id: 'instagram',
          label: t('pages.user.settingsForm.contact.instagramLabel'),
          placeholder: t('pages.user.settingsForm.contact.instagramPlaceholder'),
          value: instagram,
          onChange: onInstagramChange,
          icon: <Instagram className="h-4 w-4" />,
        },
        {
          id: 'twitter',
          label: t('pages.user.settingsForm.contact.twitterLabel'),
          placeholder: t('pages.user.settingsForm.contact.twitterPlaceholder'),
          value: twitter,
          onChange: onTwitterChange,
          icon: <Twitter className="h-4 w-4" />,
        },
        {
          id: 'facebook',
          label: t('pages.user.settingsForm.contact.facebookLabel'),
          placeholder: t('pages.user.settingsForm.contact.facebookPlaceholder'),
          value: facebook,
          onChange: onFacebookChange,
          icon: <Facebook className="h-4 w-4" />,
        },
        {
          id: 'snapchat',
          label: t('pages.user.settingsForm.contact.snapchatLabel'),
          placeholder: t('pages.user.settingsForm.contact.snapchatPlaceholder'),
          value: snapchat,
          onChange: onSnapchatChange,
          icon: <Ghost className="h-4 w-4" />,
        },
        {
          id: 'tiktok',
          label: t('pages.user.settingsForm.contact.tiktokLabel'),
          placeholder: t('pages.user.settingsForm.contact.tiktokPlaceholder'),
          value: tiktok,
          onChange: onTiktokChange,
          icon: <Music2 className="h-4 w-4" />,
        },
        {
          id: 'youtube',
          label: t('pages.user.settingsForm.contact.youtubeLabel'),
          placeholder: t('pages.user.settingsForm.contact.youtubePlaceholder'),
          value: youtube,
          onChange: onYoutubeChange,
          icon: <Youtube className="h-4 w-4" />,
        },
        {
          id: 'linkedin',
          label: t('pages.user.settingsForm.contact.linkedinLabel'),
          placeholder: t('pages.user.settingsForm.contact.linkedinPlaceholder'),
          value: linkedin,
          onChange: onLinkedinChange,
          icon: <Linkedin className="h-4 w-4" />,
        },
      ]}
    />
  );
}
