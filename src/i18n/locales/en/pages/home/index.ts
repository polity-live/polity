export const homePageTranslations = {
  welcomeTitle: 'Welcome to Polity',
  welcomeSubtitle: 'A TanStack Router Demo with Dynamic Navigation',
  welcomeBack: 'Welcome back, {{email}}!',
  hero: {
    title: 'Democracy Reimagined for the Digital Age',
    subtitle:
      'Empowering parties, NGOs, executives, and legislatures with collaborative decision-making tools',
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
      productLine: 'Platform for democratic collaboration',
      eyebrow: 'From proposal to decision',
      title: 'Understand your organization, decisions, and amendment flows in one place.',
      subtitle:
        'Polity is the global real-time social network for political groups, civil society, and people interested in politics, with events, motions, elections, data, and AI support.',
      decisionFlow: ['Proposal', 'Amendment', 'Vote'],
      primaryCta: 'Start with Polity',
      secondaryCta: 'Explore the product',
    },
    network: {
      title: 'Example network flow',
      description: 'Groups, events, rights, and decision paths shown as a navigable graph.',
      panelTitle: 'Amendment route',
    },
    sections: {
      features: {
        eyebrow: 'Product flows',
        title: 'See how daily democratic work feels inside the app.',
        description:
          'A quick tour of the core workspaces: groups, events, amendments, agendas, search, and messages.',
      },
      network: {
        eyebrow: 'Network and workflow building',
        title: 'Model parties, parliaments, committees, and mandates as living workflows.',
        description:
          'Polity makes complex organizational structures visible and manageable. Users can understand who may propose, who reviews, where decisions happen, and how a mandate moves from a party branch into parliamentary work.',
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
          'Amendments connect text, tags, and innovative elements such as graphics and media files. Members can see exactly which sections change and how much support a proposal has before it moves to a vote.',
        points: [
          'Amendments stay clear for members. Next steps and version management show what comes next and what came before.',
          'Collect change requests with clear additions, removals, comments, and support levels.',
          'Move accepted changes into agendas, event decisions, or final votes with context intact.',
        ],
      },
      officialData: {
        eyebrow: 'Official data sources',
        title: 'Bring Eurostat, GovData.de, and Destatis data directly into amendments.',
        description:
          'Polity makes external data usable inside policy work: teams can search datasets, keep provenance visible, and review tables or charts right next to the amendment.',
        points: [
          'Use Eurostat datasets, GovData.de resources, and Destatis/GENESIS publications as inputs for numbers, tables, and charts.',
          'Keep the source, publication state, and import status visible beside the policy context.',
          'Move data into amendment text, change requests, and decision material as an editable table or chart.',
        ],
      },
      streetDesign: {
        eyebrow: '3D street design',
        title: 'Design streets in 3D before an amendment is decided.',
        description:
          'Street design lets users choose a real road segment, load mapped surroundings, and design new street spaces as a clear 3D model directly on the amendment.',
        points: [
          'Mark an area on the map and show imported roads, buildings, greenery, and water as the existing context.',
          'Place streets, bike lanes, sidewalks, trees, benches, and green strips so alternatives become spatially understandable.',
          'Review costs, areas, and before-after comparisons before the design moves into a change request, agenda, or vote.',
        ],
      },
      events: {
        eyebrow: 'Events, timelines, and decisions',
        title: 'Connect meetings, public hearings, agenda items, and votes.',
        description:
          'Events are not isolated calendar entries. They carry agenda work, amendment reviews, participant activity, and decision moments into a timeline everyone can follow.',
        points: [
          'Plan assemblies, hearings, committees, and town halls in an organization-wide context.',
          'Embedded in workflows, events enable the automation of complex decision-making processes.',
          'Keep participants oriented with a chronological timeline of what changed and what comes next.',
        ],
      },
      votesElections: {
        eyebrow: 'Votes and elections',
        title: 'Run votes, candidacies, and results in one decision workspace.',
        description:
          'Polity brings active votes and elections together with deadlines, voting status, election modes, and result summaries so members know when to act and what was decided.',
        points: [
          'Make decisions in votes and elections visible in real time, from anywhere in the world.',
          'Organize deadlines, quorums, ballot options, candidacies, roles, and election rounds in the group or event context.',
          'Publish results with turnout, majorities, and traceability right after the decision.',
        ],
      },
      social: {
        eyebrow: 'Social workspace and AI',
        title: 'Bring discussion, coordination, and AI-assisted drafting into the same flow.',
        description:
          'Members can coordinate with groups, chat in the event context, and use AI assistance with tools and skills to understand debates or develop motions further.',
      },
      timeline: {
        eyebrow: 'Activity timeline',
        title: 'Show the pulse of democratic work as and where it happens.',
        description:
          'A compact, geo-localized timeline helps people quickly find what is happening near them. New arguments, updated change requests, upcoming votes, and results have time and place context.',
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
    voteElectionPreview: {
      title: 'Decision overview',
      subtitle: 'Active votes and elections with status.',
      badge: 'Live',
      voteTitle: 'Final climate budget vote',
      voteMeta: 'Closes today at 18:00',
      voteChoices: ['Yes|138|62', 'No|54|24', 'Abstain|31|14'],
      electionTitle: 'Committee speaker election',
      electionMeta: '3 candidacies confirmed',
      electionCandidates: [
        'Maya Schneider|Speaker|84|44',
        'Jonas Weber|Deputy|61|32',
        'Aylin Kaya|Board seat|45|24',
      ],
      statusTitle: 'Decision status',
      metrics: ['223 votes recorded', '71% turnout', 'Quorum reached'],
      checklist: [
        'Voting window open',
        'Named results prepared',
        'Election record generated automatically',
      ],
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
      description: 'Review amendment text and change requests side by side.',
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
    officialDataPreview: {
      title: 'Data sources in the amendment',
      subtitle: 'Searchable sources, traceable provenance, and reviewable visualization.',
      searchPlaceholder: 'Search for a dataset',
      query: 'Municipal transport data',
      resultsTitle: 'Find datasets',
      selectedLabel: 'Selected',
      dataTitle: 'Data preview',
      dataSubtitle: 'CSV resource becomes reviewable as table and chart.',
      chartTitle: 'Chart from source data',
      chartSubtitle: 'Review comparison in the document',
      statuses: {
        typing: 'Searching',
        results: 'Results found',
        selected: 'Dataset selected',
        data: 'Data loaded',
      },
      providers: {
        eurostat: 'Eurostat',
        govdata: 'GovData.de',
        destatis: 'Destatis/GENESIS',
      },
      providerHints: {
        eurostat: 'EU time series and regional indicators',
        govdata: 'German open-data portal with CKAN discovery',
        destatis: 'Official tables through GENESIS-Online',
      },
      resultTitles: [
        'Eurostat: modal split in cities',
        'Municipal traffic counts 2025',
        'Destatis/GENESIS: commuters by municipality',
      ],
      resultSources: [
        'Eurostat · urb_cmob · latest snapshot',
        'GovData.de · urban transport · CSV resource',
        'Destatis/GENESIS · table 13111-02 · JSON/CSV',
      ],
      resultMeta: [
        'Comparable EU indicator for mobility and urban spaces.',
        'Open administrative data with count location, period, and license note.',
        'Official statistics with municipality context and GENESIS metadata.',
      ],
      resultProviders: ['Eurostat', 'GovData.de', 'Destatis/GENESIS'],
      tableColumns: ['Area', 'Value', 'Source'],
      tableRows: [
        'City center|82|GovData CSV',
        'North ring|64|GovData CSV',
        'Commuter rate|56|Destatis',
      ],
      chartLabels: ['2019', '2021', '2023', '2025', '2026'],
      metrics: ['Source on chart', 'Editable table', 'Ready for vote'],
    },
    streetDesignPreview: {
      title: 'Street space design',
      subtitle: '3D preview for a change request',
      badge: 'Streetscape',
      canvasLabel: '3D model: traffic-calmed street with bike lane, trees, and green space',
      toolsTitle: 'Elements',
      layersTitle: 'Existing map',
      costTitle: 'Costs',
      comparisonTitle: 'Compare',
      totalCost: '€148,200',
      estimate: 'Estimate',
      tools: ['Street', 'Bike lane', 'Sidewalk', 'Trees', 'Green strip'],
      layers: ['Roads', 'Buildings', 'Greenery'],
      comparisonModes: ['Original', 'New', 'Overlay'],
      metrics: ['420 m² green', '180 m bike lane', '24 trees'],
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
