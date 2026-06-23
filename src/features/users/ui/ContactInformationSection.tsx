import { Globe, Ghost, Mail, MessageSquare, Music2 } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import {
  isValidOptionalEmailAddress,
  isValidOptionalSocialInput,
  isValidOptionalUrlLike,
} from '@/features/shared/logic/inputValidation';
import { ContactLinksSection } from '@/features/shared/ui/contact/ContactLinksSection';
import {
  FacebookIcon as Facebook,
  InstagramIcon as Instagram,
  LinkedinIcon as Linkedin,
  TwitterIcon as Twitter,
  YoutubeIcon as Youtube,
} from '@/features/shared/ui/icons';

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
          helpText: t('common.validation.emailHint'),
          validator: isValidOptionalEmailAddress,
          autoComplete: 'email',
        },
        {
          id: 'website',
          label: t('pages.user.settingsForm.contact.websiteLabel'),
          placeholder: t('pages.user.settingsForm.contact.websitePlaceholder'),
          value: website,
          onChange: onWebsiteChange,
          icon: <Globe className="h-4 w-4" />,
          helpText: t('common.validation.urlHint'),
          validator: isValidOptionalUrlLike,
          autoComplete: 'url',
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
          helpText: t('common.validation.whatsappHint'),
          validator: value => isValidOptionalSocialInput('whatsapp', value),
        },
        {
          id: 'instagram',
          label: t('pages.user.settingsForm.contact.instagramLabel'),
          placeholder: t('pages.user.settingsForm.contact.instagramPlaceholder'),
          value: instagram,
          onChange: onInstagramChange,
          icon: <Instagram className="h-4 w-4" />,
          helpText: t('common.validation.socialHandleOrUrlHint'),
          validator: value => isValidOptionalSocialInput('instagram', value),
        },
        {
          id: 'twitter',
          label: t('pages.user.settingsForm.contact.twitterLabel'),
          placeholder: t('pages.user.settingsForm.contact.twitterPlaceholder'),
          value: twitter,
          onChange: onTwitterChange,
          icon: <Twitter className="h-4 w-4" />,
          helpText: t('common.validation.socialHandleOrUrlHint'),
          validator: value => isValidOptionalSocialInput('twitter', value),
        },
        {
          id: 'facebook',
          label: t('pages.user.settingsForm.contact.facebookLabel'),
          placeholder: t('pages.user.settingsForm.contact.facebookPlaceholder'),
          value: facebook,
          onChange: onFacebookChange,
          icon: <Facebook className="h-4 w-4" />,
          helpText: t('common.validation.socialHandleOrUrlHint'),
          validator: value => isValidOptionalSocialInput('facebook', value),
        },
        {
          id: 'snapchat',
          label: t('pages.user.settingsForm.contact.snapchatLabel'),
          placeholder: t('pages.user.settingsForm.contact.snapchatPlaceholder'),
          value: snapchat,
          onChange: onSnapchatChange,
          icon: <Ghost className="h-4 w-4" />,
          helpText: t('common.validation.socialHandleOrUrlHint'),
          validator: value => isValidOptionalSocialInput('snapchat', value),
        },
        {
          id: 'tiktok',
          label: t('pages.user.settingsForm.contact.tiktokLabel'),
          placeholder: t('pages.user.settingsForm.contact.tiktokPlaceholder'),
          value: tiktok,
          onChange: onTiktokChange,
          icon: <Music2 className="h-4 w-4" />,
          helpText: t('common.validation.socialHandleOrUrlHint'),
          validator: value => isValidOptionalSocialInput('tiktok', value),
        },
        {
          id: 'youtube',
          label: t('pages.user.settingsForm.contact.youtubeLabel'),
          placeholder: t('pages.user.settingsForm.contact.youtubePlaceholder'),
          value: youtube,
          onChange: onYoutubeChange,
          icon: <Youtube className="h-4 w-4" />,
          helpText: t('common.validation.socialHandleOrUrlHint'),
          validator: value => isValidOptionalSocialInput('youtube', value),
        },
        {
          id: 'linkedin',
          label: t('pages.user.settingsForm.contact.linkedinLabel'),
          placeholder: t('pages.user.settingsForm.contact.linkedinPlaceholder'),
          value: linkedin,
          onChange: onLinkedinChange,
          icon: <Linkedin className="h-4 w-4" />,
          helpText: t('common.validation.socialHandleOrUrlHint'),
          validator: value => isValidOptionalSocialInput('linkedin', value),
        },
      ]}
    />
  );
}
