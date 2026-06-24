export const privacyPageTranslations = {
  title: 'Privacy Policy',
  subtitle:
    'This policy explains which personal data we process for the public preview of Polity, how we use it, and which choices you have.',
  lastUpdated: 'Last updated: June 24, 2026',
  sections: {
    overview: {
      title: 'Overview',
      paragraphs: [
        'Polity processes personal data only to the extent that you provide it to us through active actions. This includes, for example, creating a user account, creating groups, or creating motions.',
        'There is no hidden tracking of user data or user behavior.',
      ],
    },
    dataCollection: {
      title: 'Data we collect',
      paragraphs: [
        'We may process identity and contact data such as your email address, profile details you submit, technical data from your device or browser, and content you actively create inside the platform.',
      ],
      items: [
        'Authentication and account data needed to sign you in and keep your account secure.',
        'Content data such as posts, documents, comments, votes, and other material you intentionally submit.',
      ],
    },
    usage: {
      title: 'How we use data',
      paragraphs: [
        'We use personal data to authenticate users, deliver core platform functionality, protect against abuse, respond to support requests, and improve product quality.',
      ],
    },
    sharing: {
      title: 'Data sharing',
      paragraphs: [
        'We do not sell personal data. Data may be shared with infrastructure and service providers only where required for hosting, security, or maintenance of the service.',
        'Information may also be disclosed when required by applicable law or when necessary to protect users, the platform, or democratic processes hosted on the platform.',
      ],
    },
    security: {
      title: 'Data security',
      paragraphs: [
        'We use technical and organizational measures appropriate to the preview stage to protect data against unauthorized access, loss, or misuse. Because this is an alpha version in testing, data loss or security vulnerabilities cannot be ruled out.',
      ],
    },
  },
  related: {
    title: 'Related pages',
    description: 'Review the other public legal pages connected to this preview.',
    terms: {
      title: 'Terms & Conditions',
      description: 'Read the rules for using Polity.',
    },
    imprint: {
      title: 'Imprint',
      description: 'See legal notices and project contact details.',
    },
    support: {
      title: 'Support',
      description: 'Reach the project through the public support channels.',
    },
  },
} as const;
