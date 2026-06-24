export const imprintPageTranslations = {
  title: 'Imprint',
  subtitle: 'Legal and contact information for the current public preview of Polity.',
  lastUpdated: 'Last updated: June 24, 2026',
  sections: {
    overview: {
      title: 'Overview',
      paragraphs: [
        'Polity is an open-source social network for collaborative democratic processes. This page summarizes contact and responsibility information for the current preview release.',
      ],
    },
    operator: {
      title: 'Project status',
      paragraphs: [
        'The version presented here is an alpha version of the Polity project and is under active development. The purpose of alpha operation is to test user experience and technical functionality under real-world conditions. Data loss and security vulnerabilities cannot be ruled out.',
        'If another organization operates Polity on its own infrastructure, that organization is responsible for publishing the legally required provider details for operating the app.',
      ],
    },
    responsibility: {
      title: 'Content responsibility',
      paragraphs: [
        'We create and review the content of this preview with care. External links are checked when they are added, but responsibility for third-party content remains with the respective operators of those external sites. Content created by users of the platform remains the responsibility of those users.',
      ],
    },
  },
  contact: {
    title: 'Contact and source',
    description: 'Use the channels below for project, legal, or data protection questions.',
    email: {
      title: 'Email',
      description: 'Use this address for general questions about the Polity project.',
    },
    repository: {
      title: 'Source code & bug tracker',
      description: 'The public repository documents ongoing development and issue tracking.',
    },
    support: {
      title: 'Support page',
      description: 'See other ways to contact or support the project.',
    },
  },
} as const;
