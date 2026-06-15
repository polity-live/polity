export const homePageTranslations = {
  welcomeTitle: 'Welcome to Polity',
  welcomeSubtitle: 'A TanStack Router Demo with Dynamic Navigation',
  welcomeBack: 'Welcome back, {{email}}!',
  hero: {
    title: 'Democracy Reimagined for the Digital Age',
    subtitle:
      'Empowering communities, organizations, and governments with collaborative decision-making tools',
    getStarted: 'Get Started',
    exploreFeatures: 'Explore Features',
  },
  publicLanding: {
    nav: {
      home: 'Home',
      features: 'Features',
      solutions: 'Solutions',
      imprint: 'Imprint',
    },
    hero: {
      productLine: 'Collaborative civic software',
      eyebrow: 'From proposal to decision',
      title: 'Understand your organization, decisions, and amendment flows in one place.',
      subtitle:
        'Polity gives civic groups a shared workspace for networks, events, amendments, change requests, votes, and public documentation.',
      decisionFlow: ['Proposal', 'Amendment', 'Vote'],
      primaryCta: 'Start with Polity',
      secondaryCta: 'Explore the product',
    },
    network: {
      title: 'Example network flow',
      description: 'Groups, events, rights, and decision paths shown as a navigable graph.',
      badge: 'Live-style preview',
      panelTitle: 'Amendment route',
    },
    sections: {
      features: {
        eyebrow: 'Product flows',
        title: 'See how daily democratic work feels inside the app.',
        description:
          'The public page now shows the actual shape of the product: a network graph, event timeline, amendment text, and change request workflow.',
      },
      network: {
        eyebrow: 'Network and workflow building',
        title: 'Model parties, parliaments, committees, and mandates as living workflows.',
        description:
          'Polity turns organizational structure into a working map. Users can understand who may propose, who reviews, where decisions happen, and how a mandate moves from a party branch into parliamentary work.',
        points: [
          'Map local branches, policy committees, party congresses, parliamentary groups, and public hearings as connected spaces.',
          'Show rights, responsibilities, and handoffs directly on the graph so workflows stay understandable.',
          'Let political work move from member proposals to amendment reviews, votes, and parliamentary motions.',
        ],
      },
      amendments: {
        eyebrow: 'Amendments and change requests',
        title: 'Write policy text and review changes without losing the decision trail.',
        description:
          'Amendment pages combine readable text, tags, status, and structured change requests. Members can see exactly which words changed and how much support a proposal has before it moves to a vote.',
        points: [
          'Keep the amendment page readable for members while preserving version history and status.',
          'Collect change requests with clear additions, removals, comments, and support levels.',
          'Move accepted changes into agendas, event decisions, or final votes with context intact.',
        ],
      },
      events: {
        eyebrow: 'Events, timelines, and decisions',
        title: 'Connect meetings, public hearings, agenda items, and votes.',
        description:
          'Events are not isolated calendar entries. They carry agenda work, amendment reviews, participant activity, and decision moments into a timeline everyone can follow.',
        points: [
          'Schedule assemblies, hearings, committees, and town halls with shared context.',
          'Track voting readiness, support levels, and open decision points before the event.',
          'Keep participants oriented with a chronological timeline of what changed and what comes next.',
        ],
      },
      social: {
        eyebrow: 'Social workspace and AI',
        title: 'Bring discussion, coordination, and assisted drafting into the same flow.',
        description:
          'Members can chat in context, coordinate with groups, and use AI assistance with tools and skills to summarize debate or prepare clearer amendment wording without leaving the workspace.',
      },
      timeline: {
        eyebrow: 'Activity timeline',
        title: 'Show the pulse of democratic work as it happens.',
        description:
          'A compact timeline gives people a fast way to catch up: new arguments, updated requests, upcoming votes, and decision outcomes stay visible across the product.',
      },
      search: {
        eyebrow: 'Search and discovery',
        title: 'Find the right person, document, event, or decision path quickly.',
        description:
          'Semantic search helps users move through dense civic work without knowing the exact folder or title. Results can combine people, groups, events, amendments, and past decisions.',
      },
      solutions: {
        eyebrow: 'Use cases',
        title: 'Built for people and organizations that need transparent decisions.',
      },
    },
    timeline: {
      title: 'Sample event timeline',
      description: 'Follow what changed, who acted, and what needs attention next.',
      badge: 'Following',
      items: {
        event: {
          title: 'Public hearing scheduled',
          description:
            'The General Assembly added a public consultation slot for the climate budget amendment.',
          meta: 'Today, 10:30',
        },
        changeRequest: {
          title: 'Change request opened',
          description: 'A working group proposed a measurable milestone before the final vote.',
          meta: '2 comments',
        },
        vote: {
          title: 'Final vote approaching',
          description: 'Members can review the latest version and prepare their vote.',
          meta: '74% support',
        },
      },
    },
    amendmentText: {
      title: 'Sample amendment text',
      subtitle: 'A structured policy page with status, tags, and readable document text.',
      status: 'Internal review',
      documentTitle: 'Climate Budget Transparency Amendment',
      paragraphs: [
        'Section 1: The annual budget shall include a public climate impact note for each investment above the agreed threshold.',
        'Section 2: Responsible working groups publish implementation milestones before the final assembly vote.',
      ],
    },
    amendmentWorkspace: {
      title: 'Amendment page example',
      description: 'Document text and change requests shown together in one review surface.',
      badge: 'Review plate',
    },
    changeRequest: {
      title: 'Sample change request',
      subtitle: 'Review proposed wording changes before the amendment moves forward.',
      badge: 'Voting open',
      meta: '12 supporters',
      requestTitle: 'Add measurable reporting milestones',
      removed: 'Publish a yearly status summary.',
      added: 'Publish quarterly milestones with owner, deadline, and current implementation state.',
      support: 'Support',
    },
    social: {
      chatTitle: 'Coalition working chat',
      chatSubtitle: 'Messages stay next to the amendment and event context.',
      messages: {
        first: {
          author: 'Maya, policy lead',
          body: 'Can we link the reporting deadline to the committee hearing instead of the party congress?',
        },
        second: {
          author: 'Jonas, parliamentary group',
          body: 'Yes. The hearing has stronger public documentation and gives the group time to prepare.',
        },
        third: {
          author: 'Local branch north',
          body: 'We added two comments from members who want the climate note attached to every budget vote.',
        },
      },
      aiTitle: 'AI drafting assistant',
      aiSubtitle: 'Summaries and drafting support for busy democratic workflows.',
      aiPrompt:
        'Summarize the open arguments and suggest neutral wording for the reporting deadline.',
      aiResponseTitle: 'Suggested neutral wording',
      aiResponse:
        'Publish quarterly milestones after each committee hearing, including owner, deadline, and current implementation state.',
    },
    activity: {
      items: [
        'Three new comments were added to the climate budget amendment discussion.',
        'A change request moved from drafting to open support with two unresolved comments.',
        'The final vote was scheduled after the committee hearing and linked to the agenda.',
      ],
    },
    searchPreview: {
      query: 'Search: climate reporting after committee hearing',
      filters: ['Amendments', 'Events', 'Groups', 'Messages'],
      results: [
        'Climate Budget Transparency Amendment',
        'Committee Hearing: Budget Review',
        'Parliamentary Group Mandate Notes',
      ],
      resultMeta: 'Matched by title, text, comments, and connected workflow.',
    },
  },
  alphaWarning: {
    title: 'Early Alpha Version',
    description:
      'This is an early alpha version. Database overwrites can happen and delete your data. In case you would like to be an early tester, contact',
    dismiss: 'I Understand',
  },
  quickLinks: {
    solutions: {
      title: 'Solutions',
      description: 'For parties, governments, NGOs & more',
    },
    pricing: {
      title: 'Pricing',
      description: 'Transparent pricing from free to enterprise',
    },
    features: {
      title: 'Features',
      description: 'Full feature overview',
    },
  },
  cards: {
    navigation: {
      title: 'Navigation Demo',
      description: 'Experience our dynamic navigation with different layouts',
      content: 'Test different navigation types, priorities, and screen configurations.',
      button: 'Show Navigation Demo',
    },
    features: {
      title: 'Features',
      description: 'Main features of this application',
      items: [
        'Dynamic, configurable navigation',
        'Reactive layouts for mobile and desktop devices',
        'Keyboard navigation with shortcuts',
        'Command palette (Press ⌘K)',
        'Theme switching (light/dark)',
      ],
    },
    techStack: {
      title: 'Tech Stack',
      description: 'Technologies used',
      frontend: 'Frontend:',
      styling: 'Styling:',
      tooling: 'Tooling:',
      button: 'Start Demo',
    },
    test: 'fdf',
  },
} as const;
