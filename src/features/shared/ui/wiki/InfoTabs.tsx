'use client';

import React from 'react';
import { Tabs, TabsContent, TabsTrigger } from '@/features/shared/ui/ui/tabs.tsx';
import { ScrollableTabsList } from '@/features/shared/ui/ui/scrollable-tabs.tsx';
import { Card, CardContent } from '@/features/shared/ui/ui/card.tsx';
import { Badge } from '@/features/shared/ui/ui/badge.tsx';
import {
  Calendar,
  Facebook,
  Globe,
  Ghost,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  MessageSquare,
  Music2,
  Twitter,
  Youtube,
} from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation.ts';
import { formatLocation } from '@/features/shared/logic/locationHelpers';
import { buildContactLinkHref } from '@/features/shared/logic/contactLinkHelpers';

interface ContactInfo {
  email?: string;
  website?: string;
  youtube?: string;
  linkedin?: string;
  whatsapp?: string;
  instagram?: string;
  twitter?: string;
  facebook?: string;
  snapchat?: string;
  tiktok?: string;
  location?: string;
  region?: string;
  country?: string;
  post_code?: string;
  city?: string;
  street?: string;
  house_number?: string;
}

interface EventDetails {
  startDate?: string | number;
  endDate?: string | number;
  location?: string;
  tags?: string[];
}

interface InfoTabsProps {
  about?: string;
  contact?: ContactInfo;
  eventDetails?: EventDetails;
  className?: string;
}

interface ContactCardItem {
  key: string;
  label: string;
  value?: string;
  href?: string | null;
  icon: React.ReactNode;
  accentClass: string;
}

export const InfoTabs: React.FC<InfoTabsProps> = ({ about, contact, eventDetails, className }) => {
  const { t } = useTranslation();
  const contactLocation = contact?.location || formatLocation(contact);
  const primaryContactItems: ContactCardItem[] = [
    {
      key: 'email',
      label: t('components.infoTabs.labels.email'),
      value: contact?.email,
      href: contact?.email ? `mailto:${contact.email}` : null,
      icon: <Mail className="h-4 w-4" />,
      accentClass: 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300',
    },
    {
      key: 'website',
      label: t('components.infoTabs.labels.website'),
      value: contact?.website,
      href: buildContactLinkHref('website', contact?.website),
      icon: <Globe className="h-4 w-4" />,
      accentClass: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300',
    },
    {
      key: 'youtube',
      label: t('components.infoTabs.labels.youtube'),
      value: contact?.youtube,
      href: buildContactLinkHref('youtube', contact?.youtube),
      icon: <Youtube className="h-4 w-4" />,
      accentClass: 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300',
    },
    {
      key: 'linkedin',
      label: t('components.infoTabs.labels.linkedin'),
      value: contact?.linkedin,
      href: buildContactLinkHref('linkedin', contact?.linkedin),
      icon: <Linkedin className="h-4 w-4" />,
      accentClass: 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',
    },
  ].filter(item => item.value);
  const socialItems: ContactCardItem[] = [
    {
      key: 'whatsapp',
      label: t('components.infoTabs.labels.whatsapp'),
      value: contact?.whatsapp,
      href: buildContactLinkHref('whatsapp', contact?.whatsapp),
      icon: <MessageSquare className="h-4 w-4" />,
      accentClass: 'bg-green-50 text-green-600 dark:bg-green-950/50 dark:text-green-300',
    },
    {
      key: 'instagram',
      label: t('components.infoTabs.labels.instagram'),
      value: contact?.instagram,
      href: buildContactLinkHref('instagram', contact?.instagram),
      icon: <Instagram className="h-4 w-4" />,
      accentClass: 'bg-pink-50 text-pink-600 dark:bg-pink-950/50 dark:text-pink-300',
    },
    {
      key: 'twitter',
      label: t('components.infoTabs.labels.twitter'),
      value: contact?.twitter,
      href: buildContactLinkHref('twitter', contact?.twitter),
      icon: <Twitter className="h-4 w-4" />,
      accentClass: 'bg-slate-100 text-slate-700 dark:bg-slate-900/70 dark:text-slate-200',
    },
    {
      key: 'facebook',
      label: t('components.infoTabs.labels.facebook'),
      value: contact?.facebook,
      href: buildContactLinkHref('facebook', contact?.facebook),
      icon: <Facebook className="h-4 w-4" />,
      accentClass: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
    },
    {
      key: 'snapchat',
      label: t('components.infoTabs.labels.snapchat'),
      value: contact?.snapchat,
      href: buildContactLinkHref('snapchat', contact?.snapchat),
      icon: <Ghost className="h-4 w-4" />,
      accentClass: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-300',
    },
    {
      key: 'tiktok',
      label: t('components.infoTabs.labels.tiktok'),
      value: contact?.tiktok,
      href: buildContactLinkHref('tiktok', contact?.tiktok),
      icon: <Music2 className="h-4 w-4" />,
      accentClass: 'bg-zinc-100 text-zinc-900 dark:bg-zinc-900/70 dark:text-zinc-100',
    },
  ].filter(item => item.value);

  const renderContactCard = (item: ContactCardItem) => {
    const cardContent = (
      <>
        <div className={`rounded-lg p-2 ${item.accentClass}`}>{item.icon}</div>
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-xs font-semibold tracking-[0.16em] uppercase">
            {item.label}
          </p>
          <p className="mt-1 text-sm font-medium break-words">{item.value}</p>
        </div>
      </>
    );

    if (item.href) {
      return (
        <a
          key={item.key}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-background/70 hover:bg-muted/30 flex items-start gap-3 rounded-xl border p-4 transition-colors"
        >
          {cardContent}
        </a>
      );
    }

    return (
      <div key={item.key} className="bg-background/70 flex items-start gap-3 rounded-xl border p-4">
        {cardContent}
      </div>
    );
  };

  // Helper functions for event details
  const formatDate = (date: string | number) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (date: string | number) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Don't render if there's no content
  if (!about && !contact && !eventDetails) {
    return null;
  }

  return (
    <Tabs defaultValue="about" className={className}>
      <ScrollableTabsList>
        <TabsTrigger value="about">{t('components.infoTabs.about')}</TabsTrigger>
        {eventDetails && (
          <TabsTrigger value="locationAndDate">
            {t('components.infoTabs.locationAndDate')}
          </TabsTrigger>
        )}
        <TabsTrigger value="contact">{t('components.infoTabs.contact')}</TabsTrigger>
      </ScrollableTabsList>

      <TabsContent value="about" className="mt-4">
        <Card>
          <CardContent className="pt-6">
            {about ? (
              <p>{about}</p>
            ) : (
              <p className="text-muted-foreground">{t('components.infoTabs.noInformation')}</p>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {eventDetails && (
        <TabsContent value="locationAndDate" className="mt-4">
          <Card>
            <CardContent className="space-y-4 pt-6">
              {/* Time and Location side by side */}
              <div className="grid gap-4 md:grid-cols-2">
                {eventDetails.startDate && (
                  <div className="flex items-start gap-3">
                    <Calendar className="text-muted-foreground mt-1 h-5 w-5" />
                    <div>
                      <p className="font-medium">{formatDate(eventDetails.startDate)}</p>
                      <p className="text-muted-foreground text-sm">
                        {formatTime(eventDetails.startDate)}
                        {eventDetails.endDate && ` - ${formatTime(eventDetails.endDate)}`}
                      </p>
                    </div>
                  </div>
                )}

                {eventDetails.location && (
                  <div className="flex items-start gap-3">
                    <MapPin className="text-muted-foreground mt-1 h-5 w-5" />
                    <div>
                      <p className="font-medium">{t('components.infoTabs.labels.location')}</p>
                      <p className="text-muted-foreground text-sm">{eventDetails.location}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Tags */}
              {eventDetails.tags &&
                Array.isArray(eventDetails.tags) &&
                eventDetails.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {eventDetails.tags.map((tag: string, index: number) => (
                      <Badge key={index} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
            </CardContent>
          </Card>
        </TabsContent>
      )}

      <TabsContent value="contact" className="mt-4">
        <Card>
          <CardContent className="space-y-6 pt-6">
            {primaryContactItems.length > 0 && (
              <div className="grid gap-3 md:grid-cols-2">
                {primaryContactItems.map(item => renderContactCard(item))}
              </div>
            )}

            {socialItems.length > 0 && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">{t('components.infoTabs.socialTitle')}</p>
                  <p className="text-muted-foreground text-sm">
                    {t('components.infoTabs.socialDescription')}
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {socialItems.map(item => renderContactCard(item))}
                </div>
              </div>
            )}

            {contactLocation &&
              renderContactCard({
                key: 'location',
                label: t('components.infoTabs.labels.location'),
                value: contactLocation,
                icon: <MapPin className="h-4 w-4" />,
                accentClass:
                  'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
              })}

            {primaryContactItems.length === 0 && socialItems.length === 0 && !contactLocation && (
              <p className="text-muted-foreground">{t('components.infoTabs.noContact')}</p>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};
