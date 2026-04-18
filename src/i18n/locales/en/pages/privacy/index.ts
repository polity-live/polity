export const privacyPageTranslations = {
  title: 'Privacy Policy',
  subtitle:
    'This policy explains which personal data we process for the public preview of Polity, how we use it, and which choices you have.',
  lastUpdated: 'Last updated: April 18, 2026',
  sections: {
    overview: {
      title: 'Overview',
      paragraphs: [
        'Polity processes personal data only to the extent needed to provide the platform, secure the service, and improve the public preview.',
        'The exact data processed can depend on whether you browse publicly available pages, create an account, or actively use collaboration features.',
      ],
    },
    dataCollection: {
      title: 'Data we collect',
      paragraphs: [
        'We may process identity and contact data such as your email address, profile details you submit, technical data from your device or browser, and content you actively create inside the platform.',
      ],
      items: [
        'Authentication and account data needed to sign you in and keep your account secure.',
        'Usage and diagnostic data that help us operate, monitor, and improve the service.',
        'Content data such as posts, documents, comments, votes, and other material you intentionally submit.',
      ],
    },
    usage: {
      title: 'How we use data',
      paragraphs: [
        'We use personal data to authenticate users, deliver core platform functionality, protect against abuse, respond to support requests, and improve product quality.',
        'Where appropriate, aggregated or pseudonymized information may also be used for analytics, debugging, and service planning.',
      ],
    },
    sharing: {
      title: 'Data sharing',
      paragraphs: [
        'We do not sell personal data. Data may be shared with infrastructure and service providers only where required to host, secure, or maintain the service.',
        'Information may also be disclosed when required by applicable law or when necessary to protect users, the platform, or democratic processes hosted on the platform.',
      ],
    },
    retention: {
      title: 'Data retention',
      paragraphs: [
        'We keep personal data only for as long as it is needed for the purposes described in this policy, to meet legal obligations, or to resolve security and support matters.',
        'Retention periods may differ depending on the kind of data and whether the data is tied to an active account, audit trail, or safety investigation.',
      ],
    },
    rights: {
      title: 'Your rights',
      paragraphs: [
        'Depending on the applicable law, you may have rights to request access, correction, deletion, restriction, portability, or objection regarding your personal data.',
      ],
      items: [
        'Contact us if you want to review or correct account-related information.',
        'You can request deletion of your account data where no overriding legal or security reason requires continued retention.',
        'You can also contact us if you have questions about the legal basis for a particular processing activity.',
      ],
    },
    security: {
      title: 'Security',
      paragraphs: [
        'We use technical and organizational measures appropriate to the preview stage to protect data against unauthorized access, loss, or misuse.',
        'No internet service can be completely secure, so you should also protect your own devices, credentials, and account access.',
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
} as const