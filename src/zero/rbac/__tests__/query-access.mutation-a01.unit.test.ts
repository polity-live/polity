import { createHash } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import {
  applyAccreditationQueryAccess,
  applyAgendaItemQueryAccess,
  applyAmendmentQueryAccess,
  applyBlogQueryAccess,
  applyChangeRequestVisibilityAccess,
  applyDatasetQueryAccess,
  applyDocumentQueryAccess,
  applyElectionElectorOrManagerQueryAccess,
  applyElectionManagerQueryAccess,
  applyElectionQueryAccess,
  applyEventManagerQueryAccess,
  applyEventParticipantOrManagerQueryAccess,
  applyEventQueryAccess,
  applyGroupManagerQueryAccess,
  applyGroupMembershipSelfOrManagerQueryAccess,
  applyGroupQueryAccess,
  applyRoleQueryAccess,
  applySearchDocumentQueryAccess,
  applyStatementQueryAccess,
  applyTodoQueryAccess,
  applyTutorialRunOwnerQueryAccess,
  applyUserQueryAccess,
  applyVoteManagerQueryAccess,
  applyVoteQueryAccess,
  applyVoteVoterOrManagerQueryAccess,
  denyAllRows,
  isAuthenticatedUserId,
  requireQueryUser,
  requireRequestedViewer,
} from '../query-access';

type AstValue =
  null | boolean | number | string | readonly AstValue[] | { readonly [key: string]: AstValue };

interface QueryAst {
  calls: AstValue[];
  where: (...args: unknown[]) => QueryAst;
  whereExists: (
    relation: string,
    callback: (query: QueryAst) => unknown,
    options?: unknown
  ) => QueryAst;
}

function normalize(value: unknown): AstValue {
  if (value === undefined) return { type: 'undefined' };
  if (value === null || ['boolean', 'number', 'string'].includes(typeof value)) {
    return value as null | boolean | number | string;
  }
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, normalize(item)])
    );
  }
  throw new Error(`Unsupported query AST value: ${typeof value}`);
}

function createQueryAst(): QueryAst {
  const calls: AstValue[] = [];
  const query: QueryAst = {
    calls,
    where: (...args: unknown[]) => {
      if (typeof args[0] === 'function') {
        const predicate = (args[0] as (helpers: ReturnType<typeof predicateHelpers>) => unknown)(
          predicateHelpers()
        );
        calls.push({ method: 'where', predicate: normalize(predicate) });
      } else {
        calls.push({ method: 'where', args: normalize(args) });
      }
      return query;
    },
    whereExists: (relation, callback, options) => {
      const child = createQueryAst();
      const callbackResult = callback(child);
      calls.push({
        method: 'whereExists',
        relation,
        child: child.calls,
        options: normalize(options),
        callbackReturnedChild: callbackResult === child,
      });
      return query;
    },
  };
  return query;
}

function predicateHelpers() {
  return {
    and: (...values: unknown[]) => ({ operator: 'and', values: normalize(values) }),
    cmp: (...args: unknown[]) => ({ operator: 'cmp', args: normalize(args) }),
    exists: (relation: string, callback: (query: QueryAst) => unknown, options?: unknown) => {
      const child = createQueryAst();
      const callbackResult = callback(child);
      return {
        operator: 'exists',
        relation,
        child: child.calls,
        options: normalize(options),
        callbackReturnedChild: callbackResult === child,
      };
    },
    or: (...values: unknown[]) => ({ operator: 'or', values: normalize(values) }),
  };
}

function queryDigest(run: (query: QueryAst) => unknown) {
  const query = createQueryAst();
  expect(run(query)).toBe(query);
  return createHash('sha256').update(JSON.stringify(query.calls)).digest('hex');
}

const VIEWER = 'viewer-17';
const NOW = 1_734_000_000_000;

const cases = {
  'deny all': () => queryDigest(query => denyAllRows(query)),
  'require user anonymous': () => queryDigest(query => requireQueryUser(query, 'anon')),
  'require user default field': () => queryDigest(query => requireQueryUser(query, VIEWER)),
  'require user custom field': () =>
    queryDigest(query => requireQueryUser(query, VIEWER, 'owner_user_id')),
  'requested viewer anonymous': () =>
    queryDigest(query => requireRequestedViewer(query, VIEWER, undefined)),
  'requested viewer mismatch': () =>
    queryDigest(query => requireRequestedViewer(query, 'other', VIEWER)),
  'requested viewer default field': () =>
    queryDigest(query => requireRequestedViewer(query, VIEWER, VIEWER)),
  'requested viewer custom field': () =>
    queryDigest(query => requireRequestedViewer(query, VIEWER, VIEWER, 'requested_by_id')),
  'tutorial anonymous': () =>
    queryDigest(query => applyTutorialRunOwnerQueryAccess(query, undefined)),
  'tutorial viewer': () => queryDigest(query => applyTutorialRunOwnerQueryAccess(query, VIEWER)),
  'search anonymous': () => queryDigest(query => applySearchDocumentQueryAccess(query, undefined)),
  'search viewer': () => queryDigest(query => applySearchDocumentQueryAccess(query, VIEWER)),
  'user anonymous': () => queryDigest(query => applyUserQueryAccess(query, undefined)),
  'user viewer': () => queryDigest(query => applyUserQueryAccess(query, VIEWER)),
  'group anonymous': () => queryDigest(query => applyGroupQueryAccess(query, undefined)),
  'group viewer': () => queryDigest(query => applyGroupQueryAccess(query, VIEWER)),
  'group manager anonymous': () =>
    queryDigest(query => applyGroupManagerQueryAccess(query, undefined)),
  'group manager default': () => queryDigest(query => applyGroupManagerQueryAccess(query, VIEWER)),
  'group manager member resources': () =>
    queryDigest(query =>
      applyGroupManagerQueryAccess(query, VIEWER, 'manage_members', ['groups', 'groupMemberships'])
    ),
  'group membership anonymous': () =>
    queryDigest(query => applyGroupMembershipSelfOrManagerQueryAccess(query, undefined)),
  'group membership viewer': () =>
    queryDigest(query => applyGroupMembershipSelfOrManagerQueryAccess(query, VIEWER)),
  'event anonymous': () => queryDigest(query => applyEventQueryAccess(query, undefined)),
  'event viewer': () => queryDigest(query => applyEventQueryAccess(query, VIEWER)),
  'event manager anonymous': () =>
    queryDigest(query => applyEventManagerQueryAccess(query, undefined)),
  'event manager default': () => queryDigest(query => applyEventManagerQueryAccess(query, VIEWER)),
  'event manager votes': () =>
    queryDigest(query => applyEventManagerQueryAccess(query, VIEWER, 'manage_votes')),
  'event participant anonymous': () =>
    queryDigest(query => applyEventParticipantOrManagerQueryAccess(query, undefined)),
  'event participant viewer': () =>
    queryDigest(query => applyEventParticipantOrManagerQueryAccess(query, VIEWER)),
  'amendment anonymous': () => queryDigest(query => applyAmendmentQueryAccess(query, undefined)),
  'amendment viewer': () => queryDigest(query => applyAmendmentQueryAccess(query, VIEWER)),
  'change request anonymous': () =>
    queryDigest(query => applyChangeRequestVisibilityAccess(query, undefined)),
  'change request viewer': () =>
    queryDigest(query => applyChangeRequestVisibilityAccess(query, VIEWER)),
  'blog anonymous': () => queryDigest(query => applyBlogQueryAccess(query, undefined)),
  'blog viewer': () => queryDigest(query => applyBlogQueryAccess(query, VIEWER)),
  'statement anonymous': () =>
    queryDigest(query => applyStatementQueryAccess(query, undefined, NOW)),
  'statement viewer': () => queryDigest(query => applyStatementQueryAccess(query, VIEWER, NOW)),
  'todo anonymous': () => queryDigest(query => applyTodoQueryAccess(query, undefined)),
  'todo viewer': () => queryDigest(query => applyTodoQueryAccess(query, VIEWER)),
  'agenda anonymous': () => queryDigest(query => applyAgendaItemQueryAccess(query, undefined)),
  'agenda viewer': () => queryDigest(query => applyAgendaItemQueryAccess(query, VIEWER)),
  'election anonymous': () => queryDigest(query => applyElectionQueryAccess(query, undefined)),
  'election viewer': () => queryDigest(query => applyElectionQueryAccess(query, VIEWER)),
  'dataset anonymous': () => queryDigest(query => applyDatasetQueryAccess(query, undefined)),
  'dataset viewer': () => queryDigest(query => applyDatasetQueryAccess(query, VIEWER)),
  'election manager anonymous': () =>
    queryDigest(query => applyElectionManagerQueryAccess(query, undefined)),
  'election manager viewer': () =>
    queryDigest(query => applyElectionManagerQueryAccess(query, VIEWER)),
  'election elector anonymous': () =>
    queryDigest(query => applyElectionElectorOrManagerQueryAccess(query, undefined)),
  'election elector viewer': () =>
    queryDigest(query => applyElectionElectorOrManagerQueryAccess(query, VIEWER)),
  'vote anonymous': () => queryDigest(query => applyVoteQueryAccess(query, undefined)),
  'vote viewer': () => queryDigest(query => applyVoteQueryAccess(query, VIEWER)),
  'role anonymous': () => queryDigest(query => applyRoleQueryAccess(query, undefined)),
  'role viewer': () => queryDigest(query => applyRoleQueryAccess(query, VIEWER)),
  'vote manager anonymous': () =>
    queryDigest(query => applyVoteManagerQueryAccess(query, undefined)),
  'vote manager viewer': () => queryDigest(query => applyVoteManagerQueryAccess(query, VIEWER)),
  'vote voter anonymous': () =>
    queryDigest(query => applyVoteVoterOrManagerQueryAccess(query, undefined)),
  'vote voter viewer': () =>
    queryDigest(query => applyVoteVoterOrManagerQueryAccess(query, VIEWER)),
  'accreditation anonymous': () =>
    queryDigest(query => applyAccreditationQueryAccess(query, undefined)),
  'accreditation viewer': () => queryDigest(query => applyAccreditationQueryAccess(query, VIEWER)),
  'document anonymous default': () =>
    queryDigest(query => applyDocumentQueryAccess(query, undefined)),
  'document anonymous false flip': () =>
    queryDigest(query => applyDocumentQueryAccess(query, undefined, { amendmentFlip: false })),
  'document anonymous true flip': () =>
    queryDigest(query => applyDocumentQueryAccess(query, undefined, { amendmentFlip: true })),
  'document viewer default': () => queryDigest(query => applyDocumentQueryAccess(query, VIEWER)),
  'document viewer false flips': () =>
    queryDigest(query =>
      applyDocumentQueryAccess(query, VIEWER, {
        amendmentFlip: false,
        collaboratorFlip: false,
      })
    ),
  'document viewer true flips': () =>
    queryDigest(query =>
      applyDocumentQueryAccess(query, VIEWER, {
        amendmentFlip: true,
        collaboratorFlip: true,
      })
    ),
} satisfies Record<string, () => string>;

const DENIED = '29d50a7300668da4bda09e88d9ae45d96f3d4ea81b6494b6dc7b79418605d083';
const PUBLIC_ROOT = '899103a72c1a4bf2f6cb518ff852366d3563cc6e601cf15a6a0180db6d27229a';

const expectedDigests = {
  'deny all': DENIED,
  'require user anonymous': DENIED,
  'require user default field': 'a54540ad1b1cedb373091f6279c3a6558a229ccb74072cea0986d9dc1aab95bb',
  'require user custom field': '297d8ffe477fc7b7d7f72769968fa6d4b4b0a8c7e1bb25f2ef893c126fe017cb',
  'requested viewer anonymous': DENIED,
  'requested viewer mismatch': DENIED,
  'requested viewer default field':
    'a54540ad1b1cedb373091f6279c3a6558a229ccb74072cea0986d9dc1aab95bb',
  'requested viewer custom field':
    '556e0c3a44aebfbc958f37506ec535312370c2f55f4bccbab676b015b0e1d554',
  'tutorial anonymous': '6937a9626b1e8bc1317ab12da102a03155dd4f44774a352936b1767811043751',
  'tutorial viewer': 'f5c86098c8da524be5cd4ba89bff1c5a312b4ecd3018028289362b17dbf6b8f4',
  'search anonymous': PUBLIC_ROOT,
  'search viewer': 'a8d38a6fb31e469abacfffcff2b964febf9e38aacbc7d147032f281d79678086',
  'user anonymous': PUBLIC_ROOT,
  'user viewer': '836f754d72012828706f0f92cf2878e1c3e77ad80b75143523dbc5ddc5639be1',
  'group anonymous': PUBLIC_ROOT,
  'group viewer': 'df2c473435d3bc51ee3392881023597fe878f1d13d801a2211a93107b5480d6d',
  'group manager anonymous': DENIED,
  'group manager default': 'f28996a1673cd835598dda95d4efdd27cb01e3f24679d5f0a3750a74987132e8',
  'group manager member resources':
    'bbe13783e3d00081ab3cae09e3186b9e838cc99c519cdb17cfbaf8b847da799b',
  'group membership anonymous': DENIED,
  'group membership viewer': '218bbe8fe3e9259a04cd4b5fdd82d3490e2abd4758d3426caf4ca35d85f7a1e1',
  'event anonymous': PUBLIC_ROOT,
  'event viewer': '1dc2f963c5124158cfafef5ffa7a955a4b642249d5c089bff53b69e9c8287a86',
  'event manager anonymous': DENIED,
  'event manager default': 'aa557acc69d605c858715b3f68727f116883be46104e5fe413c8ff55fe7fffe8',
  'event manager votes': '166c725a560ce4fd4be2b67a5d11ab0ce0a912f88c5563f7579cb925d22b4550',
  'event participant anonymous': DENIED,
  'event participant viewer': '458f41844db5fc7c5483adaa0d969d33f1580798722d63352a70b60af4bed7c1',
  'amendment anonymous': PUBLIC_ROOT,
  'amendment viewer': '44f36ef6a2bd23e6e3ebb13b30ab14ed456ec7f2da668714788bd6d8690ab95b',
  'change request anonymous': 'c732c233eec47039930b50efae92e4c462707219203ac8b8224fb74ca4ab8f49',
  'change request viewer': '4d73e8379b5fc490372cabfe2ae93e6be413039297a9c715548a41fdc4d197ca',
  'blog anonymous': PUBLIC_ROOT,
  'blog viewer': 'da8ca52b2009a626924106fe1e71890a9c6576e9e6fd2a0277461d7510239d38',
  'statement anonymous': 'df7403d7adaba20fa9862fecf34cbfa70235b0485633cc637451f8f74b1331b8',
  'statement viewer': '3c129865fabc5106213cfa66283ccf41d1201a92aed210e37ddc0b09d7cb4a92',
  'todo anonymous': PUBLIC_ROOT,
  'todo viewer': 'd26a8f5dbc8cc51b15b1e444aedc95d6a81759b197bc354219f2d2d5cec72d59',
  'agenda anonymous': '5cbe59a4499ea8f10f8dad3e00ca5bac4ea2d465ca722e470455f9a46d16d4cf',
  'agenda viewer': '0069dad9634d723c03485e65d485e9811cc87985d6deb837b33645f663a8cfa4',
  'election anonymous': '06c777eec7fa7b88217bfb5780b2643f1d13c102254204ad70580d366f3e492f',
  'election viewer': '5649be2e3a47543e31d9efb9f17d132abbe5ea76b3e2f8e631a61e8b9703eb01',
  'dataset anonymous': 'acf5072c677034a2c8923170e248ab962a76d2935b462bdbde1ea8df9bc66e28',
  'dataset viewer': 'bb6cfdc7a326bffac89738a068a938b7f8825b5681331a4961aea4c2d413ebd4',
  'election manager anonymous': DENIED,
  'election manager viewer': '36ce01129696c0521e69ab599ee7db2a0a402b166653cf5b2a5ab9be1be4adc2',
  'election elector anonymous': DENIED,
  'election elector viewer': 'a5344666b45a22ed9e62fa5eb16229ecac4a76bffa40dd19aaf4785e60963935',
  'vote anonymous': '873d3b699efa4fd34b8e7b4c0b1ad7a270495e54d04522120471ac6bebf6faac',
  'vote viewer': 'ceff3debfc009f6963ce5f2d4d55ac9f9f86f6fa3c868aa45be15bb477ce0dd4',
  'role anonymous': 'acf5072c677034a2c8923170e248ab962a76d2935b462bdbde1ea8df9bc66e28',
  'role viewer': 'ba7b9777cf9eb9a382ed7571f0289c14d8995bbce5cb8fb4741d543fb0a5b0c3',
  'vote manager anonymous': DENIED,
  'vote manager viewer': '100208e4c439ff5ca84126e1bb0f1accd126c92c75d5492766bc42a8fc941b77',
  'vote voter anonymous': DENIED,
  'vote voter viewer': '4bd46a1e65407140bc327e404efaa0ae2ee35da8e056561654d8efde3ce217fb',
  'accreditation anonymous': DENIED,
  'accreditation viewer': '43eee69d96469ce7edab967674585685e670a5dabd0c540b7cd0b99b0275b721',
  'document anonymous default': 'cd3b7ad39b5082666eef3bf93e46ffe29e69d18ed3ed4dc6cda18166d74a7904',
  'document anonymous false flip':
    '08903444cf7d0472707ff6b79533ca952a03318821aa7f447d8f3d49d64fdbcf',
  'document anonymous true flip':
    'd98b9c9eb1f57e6658dd5da29dc58635ffb3e8ba06a610d67b75e54c718db226',
  'document viewer default': 'f344951eff137d21780995b383be940665a3ecc99351b666491977d7600adb97',
  'document viewer false flips': '457a06cf40dc8cd8218afd094c815d932998c633b546155e3478fcb3a85792c7',
  'document viewer true flips': '67616d6ec97bd634d9bfba87bf89c79d94ace7c81be412e5e2eaf872c1d9bce4',
} satisfies Record<keyof typeof cases, string>;

describe('query access mutation decision table', () => {
  it('keeps authentication classification fail-closed', () => {
    expect([
      isAuthenticatedUserId(undefined),
      isAuthenticatedUserId(null),
      isAuthenticatedUserId(''),
      isAuthenticatedUserId('anon'),
      isAuthenticatedUserId(VIEWER),
    ]).toEqual([false, false, false, false, true]);
  });

  for (const [name, run] of Object.entries(cases) as [keyof typeof cases, () => string][]) {
    it(`preserves ${name} query structure`, () => {
      expect(run()).toBe(expectedDigests[name]);
    });
  }

  it('re-evaluates the security status lists for static mutation isolation', async () => {
    vi.resetModules();
    const access = await import('../query-access');

    expect([
      queryDigest(query => access.applyGroupQueryAccess(query, VIEWER)),
      queryDigest(query => access.applyEventQueryAccess(query, VIEWER)),
      queryDigest(query => access.applyAmendmentQueryAccess(query, VIEWER)),
      queryDigest(query => access.applyBlogQueryAccess(query, VIEWER)),
    ]).toEqual([
      expectedDigests['group viewer'],
      expectedDigests['event viewer'],
      expectedDigests['amendment viewer'],
      expectedDigests['blog viewer'],
    ]);
  });
});
