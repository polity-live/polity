export const termsPageTranslations = {
  title: 'Terms & Conditions',
  subtitle:
    'These terms govern access to and use of the public preview of Polity. By using the service, you agree to follow these conditions.',
  lastUpdated: 'Last updated: June 26, 2026',
  sections: {
    scope: {
      title: 'Scope',
      paragraphs: [
        'Polity is provided as a collaborative platform for democratic and organizational processes. These terms apply to all visitors and registered users of the public preview.',
        'If your organization deploys its own instance of Polity, that deployment may be subject to additional rules or agreements defined by the operator of that instance.',
      ],
    },
    accounts: {
      title: 'Accounts',
      paragraphs: [
        'Some features require an account. You are responsible for keeping your sign-in method secure and for the activity that happens through your access credentials.',
        'You must provide accurate information when creating or maintaining an account and must not impersonate another person or organization.',
      ],
    },
    acceptableUse: {
      title: 'Acceptable use',
      paragraphs: [
        'You may use Polity only in ways that are lawful and that do not interfere with the platform, other users, or the integrity of democratic processes hosted on the service.',
      ],
      items: [
        'Do not attempt unauthorized access to data, accounts, or infrastructure.',
        'Do not upload or distribute unlawful, abusive, or malicious content.',
        'Do not use automation or scraping in a way that degrades the service for others.',
      ],
    },
    content: {
      title: 'User content',
      paragraphs: [
        'You retain responsibility for the content you publish through Polity, including posts, proposals, documents, comments, and profile information.',
        'By submitting content, you grant the service the rights needed to store, process, and display that content in order to operate the platform for you and other authorized users.',
      ],
    },
    availability: {
      title: 'Availability',
      paragraphs: [
        'This public release is still evolving. Features may change, move, or be removed, and the service may be interrupted for maintenance, testing, or security reasons.',
        'We may suspend or restrict access when necessary to protect users, data, or platform integrity.',
      ],
    },
    liability: {
      title: 'Liability',
      paragraphs: [
        'We aim to provide reliable software, but the preview is offered without any guarantee of uninterrupted availability, fitness for a specific purpose, or error-free operation.',
        'To the extent permitted by applicable law, liability is limited to cases of intentional misconduct, gross negligence, or other situations where liability cannot be excluded by law.',
      ],
    },
    changes: {
      title: 'Changes to these terms',
      paragraphs: [
        'We may update these terms when the product, legal requirements, or operational setup changes. The current version will always be published on this page.',
        'Continued use of Polity after an update means you accept the revised terms.',
      ],
    },
  },
  related: {
    title: 'Related pages',
    description: 'Review the companion legal and access pages for this preview.',
    privacy: {
      title: 'Privacy Policy',
      description: 'Learn what data we process and why.',
    },
    imprint: {
      title: 'Imprint',
      description: 'See project contact channels and legal notices.',
    },
    auth: {
      title: 'Get Started',
      description: 'Return to sign-in or sign-up when you are ready.',
    },
  },
} as const;
