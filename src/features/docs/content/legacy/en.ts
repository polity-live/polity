// Localized product guidance. The docs registry turns this content into navigable pages.
export const docsPageTranslations = {
  tones: {
    entry: 'ENTRY',
    action: 'ACTION',
    collaboration: 'COLLAB',
    attention: 'ALERT',
    decision: 'DECISION',
    result: 'RESULT',
  },
  labels: {
    quickView: 'Quick View',
    audience: 'Audience',
    entry: 'Best Entry Point',
    actions: 'What You Can Do',
    concepts: 'Key Concepts',
    watchFor: 'What To Watch For',
    states: 'Signals And States',
    relatedTopics: 'Related Topics',
    userPerspective: 'From A User Perspective',
    exploreMore: 'Explore More',
    step: 'Step {{value}}',
  },
  hub: {
    searchLabel: 'Search documentation',
    searchPlaceholder: 'What are you looking for?',
    searchHint: 'Press /',
    searchResults: 'Search results',
    noResults: 'No matching content found.',
    noResultsHint: 'Try a feature name, a task, or a shorter phrase.',
    startTitle: 'Getting started',
    startDescription: 'A guided learning path for users and organizers.',
    browseTitle: 'All guides',
    browseDescription: 'Detailed guidance for every area of Polity.',
    sidebarTitle: 'Documentation',
    openNavigation: 'Open docs navigation',
    closeNavigation: 'Close docs navigation',
    onThisPage: 'On this page',
    showContents: 'Show page overview',
    overview: 'Overview',
    related: 'Continue reading',
    readGuide: 'Open guide',
    resultCount: '{{count}} results',
    resultCount_one: '{{count}} result',
    resultCount_other: '{{count}} results',
    searchTitle: 'Search documentation',
    searchDescription: 'Search every guide and open the relevant section directly.',
    clearSearch: 'Clear search',
    previousResult: 'Previous result',
    nextResult: 'Next result',
  },
  overview: {
    navLabel: 'Overview',
    title: 'Learn Polity from the user side',
    subtitle:
      'This documentation explains how people join spaces, coordinate work, make decisions, and follow outcomes across Polity without forcing you through implementation details first.',
    primaryCta: 'Start with sign-in',
    secondaryCta: 'Understand creation flows',
    pathwaysTitle: 'Common pathways',
    pathways: {
      start:
        'Sign in, set up your profile, discover relevant groups, and understand where you belong in the network.',
      coordinate:
        'Move between creation, groups, events, messages, notifications, calendar, todos, and documents to keep day-to-day collaboration moving.',
      decide:
        'Use amendments, agendas, change requests, votes, elections, and the decision terminal to understand how proposals turn into visible outcomes.',
      'follow-through':
        'Track what changed through timeline, search, subscriptions, and notifications, who needs to act next, and where work continues through connected spaces.',
    },
    featuredTitle: 'Featured guides',
    featuredDescription:
      'Start with sign-in, workspaces, creation paths, and the most important decision flows.',
    libraryTitle: 'Documentation library',
    libraryDescription: 'Browse the full set of user-facing feature guides by area of work.',
  },
  categories: {
    people: {
      title: 'People',
      description: 'Identity, presence, and how users move through the platform.',
    },
    collaboration: {
      title: 'Collaboration',
      description: 'Shared spaces, meetings, writing, and publishing workflows.',
    },
    governance: {
      title: 'Governance',
      description: 'Proposal-making, voting, elections, and result tracking.',
    },
    coordination: {
      title: 'Coordination',
      description: 'Finding information, staying aligned, and keeping work on schedule.',
    },
    systems: {
      title: 'Systems',
      description:
        'Cross-cutting permission and routing systems that shape what users can do and where work moves next.',
    },
  },
  topics: {
    'auth-and-onboarding': {
      navLabel: 'Sign-In & Onboarding',
      title: 'Sign-In And Onboarding',
      summary:
        'Account creation, email verification, password recovery, and the first steps into the protected workspace.',
      audience:
        'New users, invited members, and anyone trying to understand how Polity moves from public pages into personal work.',
      entry:
        'Start here when you are using Polity for the first time or need to understand access problems.',
      perspective:
        'Onboarding determines whether Polity feels like a public information site or a personal workspace.',
      outcome:
        'After a successful entry flow, a user can maintain their profile, open relevant groups, and use protected features with the right context.',
      actions: [
        'Create an account, sign in, or complete the verification flow.',
        'Use password and email flows when access needs to be restored.',
        'After entry, review profile details, language, theme, and first relevant spaces.',
      ],
      concepts: [
        'Public pages explain Polity, while protected routes unlock personal data and collaboration.',
        'Supabase Auth controls identity, session state, and email-based access flows.',
        'Onboarding connects technical sign-in with a usable presence in the network.',
      ],
      watchFor: [
        'An unconfirmed or expired access flow can feel like a navigation issue.',
        'The first successful login is only the start; profile and memberships make the workspace useful.',
        'Invitations and existing memberships can influence where users land after sign-in.',
      ],
      states: [
        'Users can be public, signed in, verified, incompletely set up, or unauthorized.',
        'Onboarding succeeds when users are not only logged in, but know where their next action is.',
      ],
      diagram: {
        title: 'From public entry to workspace',
        description: 'The typical path from orientation into active use.',
        steps: {
          'choose-entry': {
            title: 'Choose the entry path',
            description:
              'Users open sign-in, registration, invitation, or password recovery depending on the situation.',
          },
          'verify-account': {
            title: 'Confirm access',
            description:
              'Email codes and session checks make sure the right person enters the workspace.',
          },
          'complete-profile': {
            title: 'Prepare the workspace',
            description:
              'Profile details, settings, and first relevant spaces turn the account into a usable presence.',
          },
        },
      },
    },
    users: {
      navLabel: 'Users',
      title: 'Users',
      summary:
        'Profiles, memberships, subscriptions, and the personal view of activity across Polity.',
      audience:
        'Anyone getting started, joining a community, or managing their presence across multiple spaces.',
      entry: 'Begin here when you want to understand how an individual experiences the platform.',
      perspective:
        'Users experience Polity as a connected workspace where profile, memberships, subscriptions, and notifications determine what feels close at hand.',
      outcome:
        'A well-set-up user can enter groups faster, notice relevant updates earlier, and move between collaboration and decision spaces without losing context.',
      actions: [
        'Create and maintain a profile that represents your role in the network.',
        'Join groups, follow spaces, and track subscriptions that matter to you.',
        'Move from profile-level context into messages, events, or governance work.',
      ],
      concepts: [
        'Your user account is the center of your memberships, subscriptions, and notifications.',
        'Visibility changes depending on what groups and events you belong to or follow.',
        'Personal context affects which actions feel immediate, not just which actions are technically allowed.',
      ],
      watchFor: [
        'Membership status affects what you can see and do inside groups.',
        'Subscriptions shape what lands in notifications and what stays quiet.',
        'Your profile becomes more useful when it is linked to active groups and current work.',
      ],
      states: [
        'Profiles become more valuable as memberships, subscriptions, and participation history accumulate.',
        'A user can feel peripheral in one space and central in another depending on roles and relationships.',
      ],
      diagram: {
        title: 'How a user settles into Polity',
        description: 'A typical path from account setup into active participation.',
        steps: {
          'create-profile': {
            title: 'Create your profile',
            description:
              'Set up the identity others will see when you join spaces, conversations, and decisions.',
          },
          'join-spaces': {
            title: 'Join relevant spaces',
            description:
              'Memberships and subscriptions pull groups, events, and governance work into your orbit.',
          },
          'stay-informed': {
            title: 'Stay informed',
            description:
              'Notifications, messages, and activity feeds keep your user view connected to ongoing work.',
          },
        },
      },
    },
    groups: {
      navLabel: 'Groups',
      title: 'Groups',
      summary:
        'Shared spaces where members organize, assign responsibility, and connect work to governance.',
      audience: 'Organizers, members, and anyone working inside a collective space.',
      entry:
        'Use this guide when you want to understand the main collaboration container in Polity.',
      perspective:
        'Groups are where users usually feel structure: membership, permissions, documents, events, and governance all converge here.',
      outcome:
        'Once a group is well organized, members can coordinate work, publish decisions, and route proposals with less friction.',
      actions: [
        'Create or join a group and work inside a shared context.',
        'Use group documents, events, notifications, and related content from one place.',
        'Assign roles and responsibilities that shape what members can act on.',
      ],
      concepts: [
        'Groups define shared context for collaboration and governance.',
        'A group can connect to parent or child groups in a larger network.',
        'Permissions often become visible to users first inside a group workflow.',
      ],
      watchFor: [
        'Membership and role changes have immediate effects on available actions.',
        'Public and private group settings change how discoverable work is.',
        'Connected groups can affect where proposals and information move next.',
      ],
      states: [
        'A group can act as a local working space, a governance hub, or part of a wider hierarchy.',
        'The same group may host day-to-day coordination and formal decisions side by side.',
      ],
      diagram: {
        title: 'A common group lifecycle',
        description: 'How groups usually move from setup to active collaboration.',
        steps: {
          'create-space': {
            title: 'Create the space',
            description: 'Start a group with clear identity, membership boundaries, and purpose.',
          },
          'assign-roles': {
            title: 'Assign roles',
            description: 'Shape who can edit, manage, organize, or govern within the group.',
          },
          'run-work': {
            title: 'Run the work',
            description:
              'Use the group as the anchor for events, amendments, discussions, and decisions.',
          },
        },
      },
    },
    events: {
      navLabel: 'Events',
      title: 'Events',
      summary:
        'Meetings and gatherings with participants, agendas, positions, and visible outcomes.',
      audience:
        'Organizers, participants, and members tracking what happens in a scheduled gathering.',
      entry:
        'Read this when you want to understand how Polity turns coordination into a real event flow.',
      perspective:
        'Events give users a concrete time and place where agendas, participation, and outcomes become visible together.',
      outcome:
        'A well-run event leaves a trace: attendees understand what happened, what was decided, and what needs follow-up.',
      actions: [
        'Create an event and invite relevant participants into the right context.',
        'Use agendas and supporting material to prepare attendees before the event starts.',
        'Review positions, outcomes, and connected follow-up work after the event.',
      ],
      concepts: [
        'Events often inherit context from a group rather than standing alone.',
        'Agenda items give events their operational structure.',
        'Participation, voting, and notifications all become more time-sensitive around events.',
      ],
      watchFor: [
        'Participant role changes can affect who speaks, votes, or manages the event.',
        'Agenda timing shapes how decisions surface in the decision terminal.',
        'Network context can influence how event outcomes connect upward or outward.',
      ],
      states: [
        'An event can be upcoming, active, or completed, but user attention shifts most around agenda moments.',
        'Users often experience events as a bridge between collaboration and governance.',
      ],
      diagram: {
        title: 'From event setup to outcome',
        description: 'The basic flow most users experience around an event.',
        steps: {
          'publish-event': {
            title: 'Publish the event',
            description: 'Make the event visible with time, location, and relevant context.',
          },
          'run-agenda': {
            title: 'Run the agenda',
            description: 'Guide participants through items, discussions, and decisions in order.',
          },
          'capture-outcomes': {
            title: 'Capture outcomes',
            description: 'Surface results, attendance, and next actions once the event concludes.',
          },
        },
      },
    },
    agendas: {
      navLabel: 'Agendas',
      title: 'Agendas',
      summary:
        'Structured event flows with items, timing, linked proposals, decisions, and follow-up.',
      audience:
        'Organizers, facilitators, and participants who need to know what an event will handle and when.',
      entry:
        'Read this when an event is more than a date and concrete work moves through multiple items.',
      perspective:
        'Agendas turn events into a readable sequence where preparation, discussion, and decisions meet.',
      outcome:
        'A strong agenda helps participants prepare, recognize decision moments, and rediscover outcomes later.',
      actions: [
        'Create and order agenda items with timing, status, or type.',
        'Link amendments, change requests, votes, or supporting material to relevant items.',
        'Track which items are open, active, or completed during and after the event.',
      ],
      concepts: [
        'Agenda items give an event operational order and shared attention.',
        'An agenda item can carry discussion, presentation, voting, or preparation.',
        'Links to votes and change requests show where formal decisions emerge.',
      ],
      watchFor: [
        'Order, duration, and status affect how urgent an item feels.',
        'Linked amendments or votes should remain reachable directly from the item.',
        'After the event, the agenda is often the best route back into outcomes and follow-up.',
      ],
      states: [
        'Agenda items can feel planned, active, completed, skipped, or forwarded.',
        'Users read agendas both for preparation and as a record of the work that actually happened.',
      ],
      diagram: {
        title: 'How an agenda structures work',
        description: 'The path from planning into facilitation and outcome.',
        steps: {
          'structure-meeting': {
            title: 'Structure the meeting',
            description: 'Organizers define items, sequence, timing, and linked content.',
          },
          'run-items': {
            title: 'Run the items',
            description:
              'Participants move through discussions, materials, votes, and open questions.',
          },
          'record-decisions': {
            title: 'Record decisions',
            description: 'Status, results, and follow-up work remain discoverable after the event.',
          },
        },
      },
    },
    amendments: {
      navLabel: 'Amendments',
      title: 'Amendments',
      summary:
        'Collaborative drafting, discussion, forwarding, and decision workflows for changing text and policy.',
      audience:
        'Authors, collaborators, reviewers, and members following a proposal through its lifecycle.',
      entry: 'Open this guide when you need to understand how text moves from draft to decision.',
      perspective:
        'Users see amendments as living proposals: they start as draft text, gather collaborators and feedback, then move into decisions or forwarding paths.',
      outcome:
        'A clear amendment workflow helps users see whether a proposal is still being shaped, is ready for decision, or must move elsewhere next.',
      actions: [
        'Draft new text or open an existing proposal for collaborative work.',
        'Track discussions, change requests, and collaborator activity around the proposal.',
        'Follow whether the amendment is decided locally or forwarded through the network.',
      ],
      concepts: [
        'Amendments combine writing, governance, and status changes in one flow.',
        'Collaborators and roles can influence who edits, comments, or steers the process.',
        'Forwarding connects amendment work to a wider group structure when local handling is not the end of the story.',
      ],
      watchFor: [
        'Status changes tell users whether the amendment is still open for shaping or moving into a formal step.',
        'Change requests create a more granular editing conversation inside the larger proposal.',
        'Connected groups may alter where the amendment needs to travel next.',
      ],
      states: [
        'Amendments often feel collaborative early and procedural later.',
        'For users, the important question is usually not just what changed but who must act next and where.',
      ],
      diagram: {
        title: 'How an amendment moves',
        description: 'A user-facing view of the usual amendment journey.',
        steps: {
          'draft-text': {
            title: 'Draft the text',
            description: 'Create the initial proposal and define the shared text others react to.',
          },
          collaborate: {
            title: 'Collaborate',
            description:
              'Discuss, request changes, and refine the proposal with other contributors.',
          },
          'forward-or-vote': {
            title: 'Forward or vote',
            description:
              'Either move the amendment into a local decision or route it onward through the network.',
          },
        },
      },
    },
    'documents-and-editor': {
      navLabel: 'Documents & Editor',
      title: 'Documents And Editor',
      summary:
        'Collaborative documents, rich-text editing, versions, presence, and editing modes for groups, users, blogs, and amendments.',
      audience:
        'Authors, collaborators, and group members who create, review, or publish text together.',
      entry: 'Use this guide when writing, reviewing, and versioning are central to a workflow.',
      perspective:
        'The editor is the workspace where civic and organizational content moves from ideas into durable text.',
      outcome:
        'Good document work makes it clear who is working on the text, which version matters, and whether a change is direct, suggested, or view-only.',
      actions: [
        'Open, create, and edit group or user documents in the right context.',
        'Switch between view, suggest, and edit modes when rights and workflow allow it.',
        'Save versions, inspect earlier states, and understand collaboration through presence signals.',
      ],
      concepts: [
        'Documents are standalone work surfaces and can also belong to groups, blogs, or amendments.',
        'Editing modes make rights and review depth visible inside the text itself.',
        'Versions help users trust that collaborative writing remains traceable.',
      ],
      watchFor: [
        'Not everyone can edit directly; suggestions or view-only access may be the right mode.',
        'Autosave and versions answer different user needs: current safety and historical traceability.',
        'Document context determines whether text is private, group-scoped, or part of a formal amendment flow.',
      ],
      states: [
        'A document can be empty, actively edited, suggested against, versioned, or read-only.',
        'Users pay close attention to mode, save confidence, and visible collaboration from other people.',
      ],
      diagram: {
        title: 'From document to reviewed version',
        description: 'How users typically edit and protect documents.',
        steps: {
          'open-document': {
            title: 'Open the document',
            description:
              'The context determines whether this is a group document, blog, profile text, or amendment.',
          },
          'edit-or-suggest': {
            title: 'Edit or suggest',
            description:
              'Users work directly in the text or mark changes as reviewable suggestions.',
          },
          'save-version': {
            title: 'Save a version',
            description: 'Snapshots and history help explain or restore the current text later.',
          },
        },
      },
    },
    'change-requests-and-discussions': {
      navLabel: 'Change Requests & Discussions',
      title: 'Change Requests And Discussions',
      summary:
        'Structured change proposals, comments, voting on suggestions, and traceable resolution of review work.',
      audience:
        'Collaborators, authors, reviewers, and groups that need to decide what happens to proposed text changes.',
      entry: 'Read this when a proposal should trigger concrete text or workflow changes.',
      perspective:
        'Change requests give discussions an actionable shape: what should change, why, who supports it, and what happens next?',
      outcome:
        'A cleanly resolved change request reduces uncertainty because change, reasoning, discussion, and outcome stay visible together.',
      actions: [
        'Review proposed changes as a diff, preview, or comment context.',
        'Open and answer discussions linked to specific text or proposal context.',
        'Vote on change requests and see whether they are accepted, rejected, or still open.',
      ],
      concepts: [
        'Change requests are the formal review channel between free discussion and direct text changes.',
        'Comments explain context, while votes or status decide what happens to the proposal.',
        'Automatic resolution can reduce coordination work when clear support or rejection is reached.',
      ],
      watchFor: [
        'A comment is not yet a change; the change request links conversation to action.',
        'Voting rights depend on the collaboration and role context.',
        'After resolution, users need a clear signal that the text actually changed or did not change.',
      ],
      states: [
        'A change request can be proposed, discussed, supported, accepted, rejected, or applied.',
        'Discussions feel productive when they visibly lead to the next review or decision step.',
      ],
      diagram: {
        title: 'How review work becomes decided',
        description: 'A lane view from proposal through discussion into outcome.',
        lanes: {
          proposal: 'Proposal',
          discussion: 'Discussion',
          decision: 'Decision',
        },
        steps: {
          'propose-change': {
            title: 'Propose a change',
            description: 'A user describes which text or workflow change should be reviewed.',
          },
          'review-diff': {
            title: 'Review the diff',
            description: 'Collaborators see additions, removals, and affected text in context.',
          },
          'discuss-context': {
            title: 'Discuss context',
            description:
              'Comments clarify intent, risks, and alternatives before a decision is made.',
          },
          'vote-request': {
            title: 'Vote on the request',
            description: 'Eligible users support, reject, or abstain depending on the workflow.',
          },
          'apply-outcome': {
            title: 'Apply the outcome',
            description: 'The status shows whether the change was incorporated or not.',
          },
        },
      },
    },
    blogs: {
      navLabel: 'Blogs',
      title: 'Blogs',
      summary:
        'Publishing spaces for updates, arguments, announcements, and public-facing writing.',
      audience:
        'Writers, editors, organizers, and readers following public or group-facing content.',
      entry: 'Use this guide when you want to understand how publishing fits into Polity.',
      perspective:
        'Blogs give users a way to communicate narrative, context, and position outside purely procedural workflows.',
      outcome:
        'Well-used blogs make proposals easier to understand, keep communities informed, and connect publishing to discussion and search.',
      actions: [
        'Draft and publish posts that explain what is happening and why it matters.',
        'Use blogs to connect group work or policy development to a wider audience.',
        'Share context that supports decisions, campaigns, or ongoing community work.',
      ],
      concepts: [
        'Blogs complement governance workflows by carrying explanation rather than formal resolution.',
        'Publication can be public or scoped to a specific audience depending on setup.',
        'Search and notifications often determine whether blog content is actually seen.',
      ],
      watchFor: [
        'Publishing rights are separate from simply being present in a group or blog space.',
        'Blog ownership and blogger roles change who can contribute.',
        'Posts often become the explanation layer around more formal amendments or votes.',
      ],
      states: [
        'A blog post can function as information, persuasion, or mobilization depending on context.',
        'Users usually feel the value of blogs when they connect narrative and action clearly.',
      ],
      diagram: {
        title: 'From draft to discussion',
        description: 'A simple publishing path inside Polity.',
        steps: {
          'draft-post': {
            title: 'Draft the post',
            description: 'Prepare the message, argument, or update you want to share.',
          },
          publish: {
            title: 'Publish',
            description: 'Make the post visible to the intended audience at the right time.',
          },
          discuss: {
            title: 'Discuss',
            description: 'Let readers react, share, and connect the post to ongoing work.',
          },
        },
      },
    },
    statements: {
      navLabel: 'Statements',
      title: 'Statements',
      summary:
        'Short public or contextual positions that connect stance, argument, and discoverability across profiles, groups, and search.',
      audience: 'Users, groups, and readers who want to publish or quickly understand a position.',
      entry:
        'Use this guide when a message should be shorter than a blog post but more durable than a comment.',
      perspective:
        'Statements give users a lightweight way to show stance and enter search or timeline contexts.',
      outcome:
        'A strong statement makes a position discoverable, quotable, and connected to a profile, hashtags, or related content.',
      actions: [
        'Create a public or visibility-scoped statement.',
        'Rediscover statements through profile, search, timeline, or related content.',
        'Use tags and context so others understand the statement correctly.',
      ],
      concepts: [
        'Statements are shorter and more direct than blogs, but more durable than chat messages.',
        'Visibility and tags decide whether a statement feels like a personal position or a broader contribution.',
        'Related and search surfaces connect individual statements to larger topics.',
      ],
      watchFor: [
        'Short statements need clear tags so they do not feel isolated.',
        'Private or scoped statements should not be treated as public positions.',
        'Statements can become entry points into profiles, discussions, or related content.',
      ],
      states: [
        'A statement can be newly created, edited, visibility-scoped, or rediscovered through search.',
        'Users judge statements by whether they are quickly understandable and findable in the right context.',
      ],
      diagram: {
        title: 'How a statement gains context',
        description: 'The path from a position into a discoverable statement.',
        steps: {
          'publish-position': {
            title: 'Publish the position',
            description: 'Users write a clear statement with appropriate visibility and tags.',
          },
          'connect-context': {
            title: 'Connect context',
            description: 'Profile, topic, group, or related content help others interpret it.',
          },
          'surface-in-search': {
            title: 'Surface in search and timeline',
            description:
              'Others rediscover the statement and jump from it into the relevant context.',
          },
        },
      },
    },
    elections: {
      navLabel: 'Elections',
      title: 'Elections',
      summary: 'Contests for roles with nominations, timing, and visible results.',
      audience: 'Organizers, candidates, and voters following representative selection.',
      entry: 'Open this guide to understand how roles and candidacies turn into election outcomes.',
      perspective:
        'For users, elections are time-bound decisions tied to a role, a candidate field, and a result everyone can track.',
      outcome:
        'A transparent election flow reduces uncertainty around who can stand, when voting happens, and how the result becomes official.',
      actions: [
        'Define or review the role connected to an election.',
        'Track candidacies and the timing of the election window.',
        'Follow the result through the election detail view or decision terminal.',
      ],
      concepts: [
        'Roles give elections institutional meaning beyond a single vote.',
        'Election timing matters because campaigns, nominations, and results are all visible phases.',
        'Users often understand elections best when connected to the decision terminal and related notifications.',
      ],
      watchFor: [
        'Candidacy and participation rules can differ from ordinary voting rights.',
        'Results may be visible in multiple places, but the same underlying decision drives them.',
        'Role context helps users understand what an election changes after it closes.',
      ],
      states: [
        'Elections feel preparatory before opening and definitive after closing.',
        'Users usually look for candidate visibility first and result clarity second.',
      ],
      diagram: {
        title: 'How an election unfolds',
        description: 'The typical path from defining a role to confirming the result.',
        steps: {
          'define-role': {
            title: 'Define the role',
            description: 'Anchor the election to a role or office users can understand.',
          },
          nominate: {
            title: 'Nominate candidates',
            description: 'Build the candidate field so voters know who is standing.',
          },
          'confirm-results': {
            title: 'Confirm results',
            description: 'Close the election and surface who has been elected.',
          },
        },
      },
    },
    votes: {
      navLabel: 'Votes',
      title: 'Votes',
      summary: 'Formal decisions with opening windows, ballots, and clear outcomes.',
      audience: 'Voters, organizers, and observers following a discrete decision item.',
      entry: 'Use this guide to understand how Polity presents and resolves formal questions.',
      perspective:
        'Users experience votes as focused decision moments: a question appears, a voting phase opens, and a result becomes visible.',
      outcome:
        'A clear vote flow lets participants understand what is being decided, when action is possible, and how the final state is interpreted.',
      actions: [
        'Review the voting question and its context before the voting window opens.',
        'Cast a ballot during the active phase if you have the right to participate.',
        'Track the result in context once the decision closes.',
      ],
      concepts: [
        'Votes are usually tied to an agenda item, proposal, or group context.',
        'Timing and eligibility are just as important as the ballot itself.',
        'Users often rely on notifications and the decision terminal to spot urgent votes.',
      ],
      watchFor: [
        'Opening and closing times shape whether a vote feels upcoming, active, or already settled.',
        'Voting rights may be narrower than general membership.',
        'Result visibility matters because users need to know whether the decision changed anything concrete.',
      ],
      states: [
        'Votes shift quickly from preparation to urgency to finality.',
        'Users usually care most about eligibility, timing, and whether the result is binding or informative.',
      ],
      diagram: {
        title: 'A standard voting flow',
        description: 'How users typically encounter a vote from setup to outcome.',
        steps: {
          'prepare-question': {
            title: 'Prepare the question',
            description: 'Define the issue clearly so participants know what is at stake.',
          },
          'cast-ballot': {
            title: 'Cast the ballot',
            description: 'Allow eligible participants to vote during the active window.',
          },
          'review-result': {
            title: 'Review the result',
            description: 'Close the vote and show whether the proposal passed, failed, or tied.',
          },
        },
      },
    },
    'decision-terminal': {
      navLabel: 'Decision Terminal',
      title: 'Decision Terminal',
      summary: 'A fast, status-driven view of live and recent votes and elections.',
      audience: 'People monitoring active decisions, urgent items, or recently closed outcomes.',
      entry: 'Open this guide when you need to understand the app’s real-time decision surface.',
      perspective:
        'The decision terminal compresses urgency into a readable signal: what is live, what opens soon, and what just closed.',
      outcome:
        'Users can prioritize attention quickly, inspect the right item at the right moment, and avoid missing critical decisions.',
      actions: [
        'Scan live and opening-soon items without opening each one individually.',
        'Inspect an item to understand timing, status, and result context.',
        'Use terminal signals as a triage surface for broader governance work.',
      ],
      concepts: [
        'The terminal is a status interface, not just a list of decisions.',
        'Badges and timing signals matter because they compress urgency visually.',
        'Votes and elections surface together so users can monitor governance from one place.',
      ],
      watchFor: [
        'An item can be visible before it is actionable if it is opening soon.',
        'Closed results may still matter because they trigger follow-up elsewhere.',
        'The terminal is best read as a decision radar rather than a full-detail workspace.',
      ],
      states: [
        'Open, closing, last-hour, final-minutes, and result states change how urgent an item feels.',
        'Users usually shift from scanning to deep inspection only when the signal indicates urgency or consequence.',
      ],
      diagram: {
        title: 'How users read the decision terminal',
        description: 'A typical attention flow from signal to interpretation.',
        steps: {
          'watch-live': {
            title: 'Watch live signals',
            description: 'Scan what is active, opening soon, or freshly resolved.',
          },
          'inspect-item': {
            title: 'Inspect the item',
            description: 'Open the detail context once a decision becomes relevant or urgent.',
          },
          'follow-result': {
            title: 'Follow the result',
            description: 'Use the visible outcome to guide whatever action comes next.',
          },
        },
      },
    },
    timeline: {
      navLabel: 'Timeline',
      title: 'Timeline',
      summary:
        'The personal overview for followed content, discovery, activity, and important decision events.',
      audience:
        'Anyone who wants to catch up quickly, discover public content, or move from signals back into work.',
      entry: 'Start here when the platform becomes larger than individual group or event pages.',
      perspective:
        'Timeline is the pulse of the app: it shows what is moving, why it may matter, and where users can continue working.',
      outcome:
        'A strong timeline reduces manual checking, brings relevant work forward, and makes decisions visible at the right moment.',
      actions: [
        'Scan followed content, public discovery, and decision events in one feed.',
        'Filter by type or relevance to stay oriented when many signals are active.',
        'Jump from cards directly into groups, events, amendments, votes, or discussions.',
      ],
      concepts: [
        'Following shows proximity, Explore shows discovery, and Decisions shows formal urgency.',
        'Cards are entry points into native workflows, not replacements for detail pages.',
        'Relevance comes from subscriptions, visibility, activity, and content type.',
      ],
      watchFor: [
        'Users need recognizable reasons for why a piece of content appears.',
        'Many similar cards make filters and clear type signals important.',
        'Decision signals need to feel more urgent than general activity.',
      ],
      states: [
        'Timeline can be empty, filtered, subscription-based, exploratory, or decision-focused.',
        'Users move from scanning into inspection once a signal becomes important.',
      ],
      diagram: {
        title: 'From following to action',
        description: 'How timeline signals bring users back into relevant work.',
        steps: {
          'follow-sources': {
            title: 'Follow sources',
            description:
              'Subscriptions, memberships, and visibility determine which content feels close.',
          },
          'scan-feed': {
            title: 'Scan the feed',
            description:
              'Cards, filters, and decision states help important signals stand out quickly.',
          },
          'open-work': {
            title: 'Open the work',
            description:
              'Users jump from the signal into the actual group, event, or decision workflow.',
          },
        },
      },
    },
    search: {
      navLabel: 'Search',
      title: 'Search',
      summary:
        'Find people, spaces, content, and decisions without knowing exactly where they live.',
      audience:
        'Anyone navigating a large workspace, rediscovering content, or jumping across features.',
      entry: 'Use this guide when navigation by memory is no longer enough.',
      perspective:
        'Search is the user’s shortcut through platform complexity, especially once work is spread across many groups and content types.',
      outcome:
        'Effective search turns a dense workspace into one users can traverse confidently without losing context.',
      actions: [
        'Search across different content types from one entry point.',
        'Use search to jump directly into the right group, discussion, or decision.',
        'Recover context quickly when a notification or message is too vague on its own.',
      ],
      concepts: [
        'Search becomes more important as content and relationships multiply.',
        'A strong search result is often a bridge into a deeper workflow rather than the end of the task.',
        'Users rely on search when they know what they need but not where it currently lives.',
      ],
      watchFor: [
        'Search only feels useful when titles, summaries, and related context are understandable.',
        'Filters matter once users are working across many similar spaces.',
        'Search can lead into public or private contexts depending on visibility rules.',
      ],
      states: [
        'Search often begins broadly and narrows fast once the user recognizes the right context.',
        'Users judge search quality by how quickly it gets them back into action.',
      ],
      diagram: {
        title: 'How search helps users navigate',
        description: 'A common path from broad query to specific destination.',
        steps: {
          'search-across': {
            title: 'Search across the workspace',
            description: 'Start with a topic, name, or item you want to locate.',
          },
          'narrow-context': {
            title: 'Narrow the context',
            description: 'Use results and visible cues to identify the right space or item.',
          },
          'jump-to-target': {
            title: 'Jump to the target',
            description: 'Open the result and continue the actual task in its native context.',
          },
        },
      },
    },
    messages: {
      navLabel: 'Messages',
      title: 'Messages',
      summary: 'Direct communication for coordination, clarification, and fast follow-up.',
      audience: 'Members and organizers who need fast communication around active work.',
      entry:
        'Read this when you want to understand how direct conversation fits into Polity workflows.',
      perspective:
        'Messages help users close the gap between formal structure and immediate coordination.',
      outcome:
        'When messaging is used well, people resolve blockers faster and move back into the right feature context with less delay.',
      actions: [
        'Start or continue direct conversations with relevant people.',
        'Clarify timing, responsibility, or context around active work.',
        'Use messages as a bridge to decisions, events, and tasks rather than a separate silo.',
      ],
      concepts: [
        'Messages are often where ambiguity gets resolved before action happens elsewhere.',
        'Conversation is strongest when it connects back to shared context, not when it drifts on its own.',
        'Users tend to combine messages with notifications and search for rapid orientation.',
      ],
      watchFor: [
        'Direct communication can create speed, but users still need formal context for lasting decisions.',
        'Threads matter most when they point back to groups, events, or proposals.',
        'Unread state determines whether messages feel urgent or ambient.',
      ],
      states: [
        'Messages usually move from quick coordination into action elsewhere on the platform.',
        'Users read messaging health through responsiveness and how easily context is shared.',
      ],
      diagram: {
        title: 'A simple coordination loop',
        description: 'How messaging usually supports other workflows.',
        steps: {
          'open-thread': {
            title: 'Open the thread',
            description: 'Start a direct conversation around the issue at hand.',
          },
          coordinate: {
            title: 'Coordinate',
            description: 'Exchange the information needed to remove confusion or delay.',
          },
          'follow-links': {
            title: 'Follow linked context',
            description:
              'Return to the relevant group, event, or decision once alignment is restored.',
          },
        },
      },
    },
    notifications: {
      navLabel: 'Notifications',
      title: 'Notifications',
      summary: 'Signals that help users notice what changed, what needs action, and what can wait.',
      audience: 'Anyone juggling multiple spaces, deadlines, or active decisions.',
      entry:
        'Use this guide when you want to understand how Polity surfaces urgency and relevance.',
      perspective:
        'Notifications shape the user’s sense of momentum by deciding what breaks into attention and what stays in the background.',
      outcome:
        'When notification signals are tuned well, users respond faster without feeling buried in noise.',
      actions: [
        'Review alerts tied to groups, events, amendments, and decisions.',
        'Prioritize what needs immediate action versus later reading.',
        'Use notification signals to jump back into the right workflow quickly.',
      ],
      concepts: [
        'Notifications are not just reminders; they are a routing layer into active work.',
        'Entity-specific notifications can feel different from global notifications.',
        'Urgency only works when users trust that important changes are visible at the right time.',
      ],
      watchFor: [
        'Too many alerts reduce trust in the signal.',
        'Different entity types can generate notifications for different reasons.',
        'Users often combine notifications with search and messages to rebuild context fast.',
      ],
      states: [
        'Notifications can feel ambient, important, or urgent depending on timing and content.',
        'A strong notification system helps users spend less time checking every space manually.',
      ],
      diagram: {
        title: 'From alert to action',
        description: 'A common way users process notifications.',
        steps: {
          'receive-alerts': {
            title: 'Receive alerts',
            description: 'Signals arrive when something important changes or opens.',
          },
          prioritize: {
            title: 'Prioritize',
            description: 'Decide what needs attention now and what can wait.',
          },
          act: {
            title: 'Act',
            description: 'Open the relevant workflow and continue from the right context.',
          },
        },
      },
    },
    'pwa-and-notifications': {
      navLabel: 'PWA & Push',
      title: 'PWA And Push Notifications',
      summary:
        'Installable app behavior, browser notifications, and fast return paths into current work.',
      audience:
        'Users who use Polity regularly and want to notice important updates outside an open browser tab.',
      entry: 'Use this guide when Polity should behave more like an app on the device.',
      perspective:
        'PWA and push make Polity more present without forcing users to manually check every space.',
      outcome:
        'When set up well, users can return faster, notice important alerts, and still keep control through notification settings.',
      actions: [
        'Install the app when the device or browser offers it.',
        'Allow or decline browser notifications and understand the effect.',
        'Use push or app entry points to return directly into relevant notification context.',
      ],
      concepts: [
        'PWA installation affects access and device behavior, not permissions inside Polity.',
        'Push notifications complement the internal notifications page.',
        'User control matters because app presence without signal quality quickly becomes noise.',
      ],
      watchFor: [
        'Browser and operating-system permissions can prevent push from appearing at all.',
        'Not every internal notification should automatically become a push notification.',
        'Install prompts should make work easier rather than feeling like marketing.',
      ],
      states: [
        'A device can be not installable, installable, installed, push-capable, or push-blocked.',
        'Users feel the value most when an alert returns them directly to the right task.',
      ],
      diagram: {
        title: 'How Polity becomes closer like an app',
        description: 'From install prompt to fast return into work.',
        steps: {
          'install-app': {
            title: 'Install the app',
            description: 'Users save Polity as an app-like entry point on a supported device.',
          },
          'allow-notifications': {
            title: 'Allow notifications',
            description:
              'Browser and app settings decide whether important signals arrive outside the page.',
          },
          'return-fast': {
            title: 'Return quickly',
            description:
              'A notification or app launch brings users back into the relevant workflow.',
          },
        },
      },
    },
    calendar: {
      navLabel: 'Calendar',
      title: 'Calendar',
      summary:
        'A schedule view that helps users place meetings, deadlines, and upcoming work in time.',
      audience: 'Anyone planning participation or tracking multiple events and deadlines.',
      entry:
        'Open this guide to understand how time-based work becomes visible across the platform.',
      perspective:
        'Calendar turns scattered obligations into a view users can actually plan around.',
      outcome:
        'A clear calendar helps users prepare earlier, spot conflicts sooner, and act before deadlines become urgent.',
      actions: [
        'Scan upcoming events and time-bound work in one place.',
        'Open calendar entries to recover the deeper context behind each item.',
        'Use the schedule view to prepare participation and follow-up work.',
      ],
      concepts: [
        'Calendar is where event timing, reminders, and user planning converge.',
        'Visibility in the calendar can change how urgent a task or decision feels.',
        'Users often treat calendar as a preparation surface rather than a final workspace.',
      ],
      watchFor: [
        'Timing shifts can ripple into notifications and attendance expectations.',
        'Calendar entries are most useful when they preserve links to the underlying workflow.',
        'Users often need both a broad schedule view and quick access to details.',
      ],
      states: [
        'The same item can feel distant, upcoming, or immediate depending on the calendar horizon.',
        'Users read the calendar to prepare, not just to confirm dates.',
      ],
      diagram: {
        title: 'How calendar supports preparation',
        description: 'A simple path from schedule awareness to action.',
        steps: {
          'scan-schedule': {
            title: 'Scan the schedule',
            description: 'Review upcoming events, deadlines, and obligations at a glance.',
          },
          'open-entry': {
            title: 'Open the entry',
            description: 'Jump into the item that needs more attention or preparation.',
          },
          prepare: {
            title: 'Prepare',
            description: 'Use the linked context to get ready for what happens next.',
          },
        },
      },
    },
    todos: {
      navLabel: 'Todos',
      title: 'Todos',
      summary:
        'Personal and shared follow-up work that keeps decisions from stalling after they are made.',
      audience: 'Anyone responsible for execution, coordination, or tracking completion.',
      entry: 'Use this guide when you want to understand how Polity handles follow-through.',
      perspective:
        'Todos are where users feel whether the platform supports real execution after discussion and decision.',
      outcome:
        'A healthy todo flow closes the loop between coordination, decision, and implementation.',
      actions: [
        'Capture work that emerges from meetings, decisions, or ongoing projects.',
        'Track progress over time and keep responsibilities visible.',
        'Use todos together with notifications and calendar to avoid losing momentum.',
      ],
      concepts: [
        'Todos translate governance and coordination into visible execution.',
        'Work feels more actionable when linked back to the event, group, or proposal that produced it.',
        'Completion state is often the clearest sign that follow-through is happening.',
      ],
      watchFor: [
        'Tasks become noise if they are detached from clear ownership or timing.',
        'Users need to see progress, not just a long list of open work.',
        'Todos often matter most after decisions when enthusiasm starts to fade.',
      ],
      states: [
        'Todos usually move from capture to progress to closure, with visibility at each stage.',
        'Users judge the system by whether it helps them see what is still waiting on action.',
      ],
      diagram: {
        title: 'The follow-through loop',
        description: 'How tasks help decisions turn into completed work.',
        steps: {
          'capture-work': {
            title: 'Capture the work',
            description: 'Turn obligations and next steps into something trackable.',
          },
          'track-progress': {
            title: 'Track progress',
            description: 'Keep the task visible while responsibility and timing stay clear.',
          },
          'close-loop': {
            title: 'Close the loop',
            description:
              'Mark the work done and reduce uncertainty about what remains outstanding.',
          },
        },
      },
    },
    'create-workflows': {
      navLabel: 'Create',
      title: 'Creation Workflows',
      summary:
        'The central entry point for creating groups, events, amendments, blog posts, statements, todos, payments, and agenda items.',
      audience:
        'Users starting new work and organizers who need to choose the right creation flow for their goal.',
      entry:
        'Start here when you are not searching for existing work, but creating something new in Polity.',
      perspective:
        'Creation flows translate intent into structured objects without immediately exposing every detail page.',
      outcome:
        'A successful creation flow creates the right object with visibility, context, and required fields, then moves users to the next useful workspace.',
      actions: [
        'Choose the right content type and complete its form step by step.',
        'Add context such as group, event, visibility, responsible people, timing, or tags.',
        'After creation, move to the detail page, list, or next action.',
      ],
      concepts: [
        'Create is a shared surface for many entities, each with its own required fields.',
        'Typeahead and search fields connect new content to existing context.',
        'Visibility, rights, and relationships are often prepared during creation.',
      ],
      watchFor: [
        'The wrong creation context can confuse permissions and discoverability later.',
        'Some objects need minimal input, while others structure complex governance flows.',
        'Users should know where to continue the work after saving.',
      ],
      states: [
        'A creation flow can be empty, partially filled, invalid, saving, or complete.',
        'Creation feels safe when steps are clear and the destination after saving is visible.',
      ],
      diagram: {
        title: 'How new work begins',
        description: 'The general path through the create surface.',
        steps: {
          'choose-type': {
            title: 'Choose the type',
            description:
              'Users decide whether to create a group, event, amendment, statement, todo, or another object.',
          },
          'fill-context': {
            title: 'Fill in context',
            description:
              'Form fields connect the new work to people, groups, timing, and visibility.',
          },
          'publish-item': {
            title: 'Create the object',
            description:
              'After saving, Polity opens the next useful place for editing, managing, or tracking.',
          },
        },
      },
    },
    'subscriptions-and-payments': {
      navLabel: 'Subscriptions & Payments',
      title: 'Subscriptions And Payments',
      summary:
        'Following users, groups, events, blogs, and amendments, plus support and Stripe-backed payment flows.',
      audience: 'Users who want to follow updates or financially support the platform.',
      entry:
        'Use this guide when you want to understand why certain content appears in timeline and notifications.',
      perspective:
        'Subscriptions determine attention and proximity, while payments make support and billing transparent.',
      outcome:
        'Well-managed subscriptions and payments help users follow relevant work and contribute support without confusing it with membership.',
      actions: [
        'Follow users, groups, events, blogs, or amendments and remove subscriptions later.',
        'Filter, search, and use your subscriptions as a personal map of interests.',
        'Understand support or payment flows through checkout, portal, and status views.',
      ],
      concepts: [
        'Subscribing means attention, not automatic membership or edit rights.',
        'Subscriptions influence timeline, notifications, and rediscovery.',
        'Payments and support contributions are separate from governance rights and should be read that way.',
      ],
      watchFor: [
        'Users cannot always meaningfully subscribe to their own or private content.',
        'Duplicate subscriptions should be prevented so signals remain trustworthy.',
        'Payment status must stay clearly separate from participation rights.',
      ],
      states: [
        'Content can be unsubscribed, subscribed, unfollowed, inaccessible, or active in a payment context.',
        'Users need to know whether an update is visible because of membership, subscription, or payment.',
      ],
      diagram: {
        title: 'From interest to ongoing attention',
        description: 'How subscriptions and support shape user signals.',
        steps: {
          'follow-entity': {
            title: 'Follow an entity',
            description:
              'Users subscribe to content or people that should stay relevant to their work.',
          },
          'manage-support': {
            title: 'Manage support',
            description:
              'Payment and support flows show status, contribution, and billing options.',
          },
          'review-updates': {
            title: 'Review updates',
            description:
              'Timeline, notifications, and profile views bring subscribed activity forward again.',
          },
        },
      },
    },
    'ai-assistant': {
      navLabel: 'AI Assistance',
      title: 'AI Assistance',
      summary:
        'Aria, Kai, and AI-supported help for orientation, summarization, drafting, and context work.',
      audience: 'Users who want to understand complex civic work faster or write more clearly.',
      entry:
        'Open this guide when AI should support Polity work without replacing human decisions.',
      perspective:
        'AI assistance works best as a companion for orientation and drafting, not as hidden authority.',
      outcome:
        'Good AI use saves time on summaries, wording, and navigation while users still review suggestions deliberately.',
      actions: [
        'Ask questions about Polity, current workflows, or text.',
        'Review summaries, wording suggestions, or next steps.',
        'Use your own provider keys or available models when the context allows it.',
      ],
      concepts: [
        'AI output is a suggestion and needs human review, especially for governance text.',
        'Assistent Aria & Kai explains features, while editor and chat flows can support concrete work.',
        'Bring-your-own-key and shared models affect which AI functions are available.',
      ],
      watchFor: [
        'AI must not bypass permissions or make decisions for users.',
        'Sensitive content should only be used with appropriate model and key context.',
        'Users should know whether text has been human-reviewed or only suggested.',
      ],
      states: [
        'AI can be unconfigured, available, waiting, responding, or limited by missing keys.',
        'The most important state is not the answer itself, but whether it was reviewed and usefully applied.',
      ],
      diagram: {
        title: 'How AI supports controlled work',
        description: 'The path from question to reviewed use.',
        steps: {
          'ask-context': {
            title: 'Ask with context',
            description: 'Users provide a question, text, or goal to the assistance flow.',
          },
          'review-suggestion': {
            title: 'Review the suggestion',
            description:
              'The answer is checked for tone, accuracy, rights, and civic appropriateness.',
          },
          'apply-with-care': {
            title: 'Apply deliberately',
            description:
              'Users use the help as a draft, summary, or orientation inside the real workflow.',
          },
        },
      },
    },
    'pql-and-filters': {
      navLabel: 'PQL & Filters',
      title: 'PQL And Filters',
      summary:
        'Reusable filters, quick filters, saved queries, and typed rules for large lists and data-rich views.',
      audience: 'Users who need to narrow many todos, payments, documents, or other entities.',
      entry:
        'Use this guide when simple search is not enough and repeatable filter logic is needed.',
      perspective:
        'PQL makes filtering a shared tool instead of treating every list as a separate special case.',
      outcome:
        'Good filters help users reduce large work sets to the relevant slice and reuse the same view later.',
      actions: [
        'Use quick filters to narrow common fields without complex input.',
        'Combine custom rules with AND, OR, or IN logic.',
        'Reopen, edit, and apply saved filters on the same feature surface.',
      ],
      concepts: [
        'PQL describes filter logic structurally so UI and evaluation share the same meaning.',
        'Field types determine which values and operators make sense.',
        'Saved queries are personal or feature-specific work views.',
      ],
      watchFor: [
        'Filters should not be so hidden that users forget why results are missing.',
        'Complex rules need readable summaries and an easy reset path.',
        'PQL should respect existing visibility rules and not expose data.',
      ],
      states: [
        'A view can be unfiltered, quick-filtered, custom-filtered, or using a saved query.',
        'Users trust filters when result count, active rules, and reset options are clear.',
      ],
      diagram: {
        title: 'How PQL makes large lists manageable',
        description: 'From quick narrowing to reusable query.',
        steps: {
          'start-filter': {
            title: 'Start filtering',
            description: 'Users choose a search term or field filter to narrow the set broadly.',
          },
          'combine-rules': {
            title: 'Combine rules',
            description: 'Multiple conditions form clear logic for more precise results.',
          },
          'reuse-query': {
            title: 'Reuse the query',
            description: 'Saved filters restore the same work view later.',
          },
        },
      },
    },
    meetings: {
      navLabel: 'Meetings',
      title: 'Meetings',
      summary:
        'Personal scheduling and meeting views that connect user profiles with concrete conversation times.',
      audience:
        'Users who want to plan conversations with other people or find available time slots.',
      entry: 'Read this when direct coordination does not need a formal event workflow.',
      perspective:
        'Meetings are the lightweight scheduling bridge between profile, calendar, and personal collaboration.',
      outcome:
        'A clear meeting flow reduces back-and-forth and turns contact interest into a concrete time.',
      actions: [
        'Open a user meeting page and inspect available slots.',
        'Choose a suitable slot or understand existing meeting information.',
        'Prepare the appointment with calendar and contact context.',
      ],
      concepts: [
        'Meetings are person-centered and lighter than group or event workflows.',
        'Availability, calendar context, and participant information determine whether a slot is useful.',
        'A meeting can later lead into broader coordination or event planning.',
      ],
      watchFor: [
        'Time zones and date selection must remain unambiguous.',
        'Not every user needs to show public availability.',
        'Meeting coordination should not be confused with formal event participation.',
      ],
      states: [
        'A meeting context can show no slots, available slots, selected time, or confirmed details.',
        'Users feel quality when they reach a clear time without a long message chain.',
      ],
      diagram: {
        title: 'From profile to conversation',
        description: 'How personal scheduling works.',
        steps: {
          'open-availability': {
            title: 'Open availability',
            description:
              'Users start from a profile or meeting page with visible scheduling options.',
          },
          'choose-slot': {
            title: 'Choose a slot',
            description:
              'A suitable time is selected using date, duration, and participant context.',
          },
          'meet-prepared': {
            title: 'Meet prepared',
            description:
              'Calendar and profile context help continue the conversation productively.',
          },
        },
      },
    },
    'roles-and-rights': {
      navLabel: 'Roles & Rights',
      title: 'Roles And Rights',
      summary:
        'How scoped roles and action rights determine what users can see, manage, or change.',
      audience:
        'Organizers assigning permissions and members trying to understand why an action is available or missing.',
      entry: 'Read this guide when permissions are shaping the user experience in visible ways.',
      perspective:
        'Users rarely think in terms of permission tables; they notice roles and rights when actions appear, disappear, or require a different person.',
      outcome:
        'A clear role and rights model helps people understand responsibility, delegation, and boundaries without unnecessary confusion.',
      actions: [
        'Assign roles to match responsibility inside a group, event, or other scoped space.',
        'Use action rights to open specific capabilities without making everyone an admin.',
        'Interpret missing actions as part of the permission design rather than a broken interface.',
      ],
      concepts: [
        'Roles package action rights into something organizers and members can reason about.',
        'Scope matters because the same person can have different rights in different spaces.',
        'Users experience rights as available actions, not as abstract policy.',
      ],
      watchFor: [
        'A role in one scope does not automatically imply the same power elsewhere.',
        'Permission issues often surface first around participant management, editing, or governance actions.',
        'Users need explanations that connect visible UI changes to assigned responsibility.',
      ],
      states: [
        'Permissions are mostly invisible until a user needs to do something specific.',
        'Good permission design reduces uncertainty by making responsibility legible rather than hidden.',
      ],
      diagram: {
        title: 'How roles become visible to users',
        description:
          'A lane view showing assignment, experience, and enforcement across the system.',
        lanes: {
          organizer: 'Organizer',
          member: 'Member',
          system: 'System',
        },
        steps: {
          'set-scope': {
            title: 'Set the scope',
            description:
              'An organizer decides where the role applies: for example in a group or event.',
          },
          'assign-role': {
            title: 'Assign the role',
            description:
              'The role bundles action rights that define what the user can do in that scope.',
          },
          'see-available-actions': {
            title: 'See available actions',
            description:
              'The member experiences permissions as buttons, tabs, and workflows that are available or hidden.',
          },
          'enforce-boundaries': {
            title: 'Enforce boundaries',
            description:
              'The system blocks actions outside the assigned rights and keeps the workflow consistent.',
          },
          'adapt-over-time': {
            title: 'Adapt over time',
            description:
              'Organizers update roles as responsibility changes without rebuilding the whole space.',
          },
        },
      },
    },
    'networks-and-forwarding': {
      navLabel: 'Networks & Forwarding',
      title: 'Networks And Forwarding',
      summary:
        'How connected groups shape event context and how amendments can move through the network instead of stopping locally.',
      audience: 'Members, organizers, and proposal authors operating across connected groups.',
      entry: 'Open this guide when a decision or amendment does not end in one place.',
      perspective:
        'Users feel the network when a group is connected upward or downward, an event inherits wider structure, or an amendment must continue beyond its origin.',
      outcome:
        'A clear forwarding model helps users understand where work travels, why it moves, and how local context connects to a wider system.',
      actions: [
        'Understand how groups relate to each other in a broader network.',
        'See how event context can derive from a group’s place in that structure.',
        'Follow an amendment as it moves through connected groups instead of ending at its starting point.',
      ],
      concepts: [
        'Network relationships are not just visual; they influence rights and routing.',
        'Events often sit inside a larger group structure, even when users interact with the event directly.',
        'Forwarding turns some amendment flows into a path across connected spaces.',
      ],
      watchFor: [
        'Users need to know whether a proposal is still local or already moving onward.',
        'Different rights can determine which connections matter for a particular workflow.',
        'Network visibility is most valuable when it explains the next destination, not just the map.',
      ],
      states: [
        'A connected group can be structurally close even when the user rarely visits it directly.',
        'Forwarding status matters because it tells users whether the process is waiting, moving, or resolved somewhere else.',
      ],
      diagram: {
        title: 'How network context and forwarding interact',
        description: 'A lane view of group structure, event inheritance, and amendment routing.',
        lanes: {
          group: 'Group',
          event: 'Event',
          amendment: 'Amendment',
        },
        steps: {
          'connect-groups': {
            title: 'Connect groups',
            description:
              'Relationships between groups establish the wider structure users work inside.',
          },
          'inherit-context': {
            title: 'Inherit context',
            description:
              'Events draw meaning from the group network around them rather than existing in isolation.',
          },
          'route-amendments': {
            title: 'Route amendments',
            description:
              'A proposal can move through the network when local handling is only one stage of the process.',
          },
          'confirm-forwarding': {
            title: 'Confirm forwarding',
            description:
              'Users need a visible signal that the amendment has moved or is waiting on the previous step.',
          },
          'surface-result': {
            title: 'Surface the result',
            description:
              'The amendment eventually returns a visible outcome that users can interpret in context.',
          },
        },
      },
    },
  },
} as const;
