export const imprintPageTranslations = {
  title: 'Imprint',
  subtitle: 'Legal and contact information for the current public preview of Polity.',
  lastUpdated: 'Last updated: April 18, 2026',
  sections: {
    overview: {
      title: 'Overview',
      paragraphs: [
        'Polity is an open-source platform for collaborative democratic processes. This page summarizes contact and responsibility information for the current preview release.',
      ],
    },
    operator: {
      title: 'Project status',
      paragraphs: [
        'The version presented here is a preview environment for the Polity project and its ongoing development.',
        'If another organization deploys Polity on its own infrastructure, that organization is responsible for publishing the legally required provider details for its own deployment.',
      ],
    },
    responsibility: {
      title: 'Content responsibility',
      paragraphs: [
        'We create and review the content of this preview with care. External links are checked when they are added, but responsibility for third-party content remains with the respective operators of those external sites.',
      ],
    },
    legalNotice: {
      title: 'Legal notice',
      paragraphs: [
        'This imprint page is intended to make the project contact channels transparent during the preview stage.',
        'Any production rollout should complete this page with the operator\'s full legally required identification details before going live.',
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
      title: 'Source code',
      description: 'The public repository documents ongoing development and issue tracking.',
    },
    support: {
      title: 'Support page',
      description: 'See other ways to contact or support the project.',
    },
  },
} as const