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
  'tutorial viewer': '6c7eec50548d23b1c6a704a5e071b0a7bc49c422f5da112212eee14f641996ff',
  'search anonymous': PUBLIC_ROOT,
  'search viewer': 'c77132655264df76ba6dad6b85f8b14b63c08f01ed91010304c69893751cec7e',
  'user anonymous': PUBLIC_ROOT,
  'user viewer': 'af854747ebb10bc637acce609abe6eda73c891230d2e9b04c7d431606e1ed332',
  'group anonymous': PUBLIC_ROOT,
  'group viewer': 'f9aa34a16f58ea3265208f6b9d87fe07ba6452b93363c99dfae847e81dd7fac0',
  'group manager anonymous': DENIED,
  'group manager default': 'f28996a1673cd835598dda95d4efdd27cb01e3f24679d5f0a3750a74987132e8',
  'group manager member resources':
    'bbe13783e3d00081ab3cae09e3186b9e838cc99c519cdb17cfbaf8b847da799b',
  'group membership anonymous': DENIED,
  'group membership viewer': '218bbe8fe3e9259a04cd4b5fdd82d3490e2abd4758d3426caf4ca35d85f7a1e1',
  'event anonymous': PUBLIC_ROOT,
  'event viewer': '61b7c955444ed3d1209630c28c293cbc64ccb0a0152386b3cf474e123052e52b',
  'event manager anonymous': DENIED,
  'event manager default': '4af00a1a128fe23b0d595b58d4ef27c8c6e49181052dbb3f2eaed1ce85af02a4',
  'event manager votes': '2a454fb1633d161d9386a8ed9a5e3f42e8108b1f2aa1555f25858dcfb229361f',
  'event participant anonymous': DENIED,
  'event participant viewer': 'abb4e34d1d56afb369923e6b6b06d1dbf3718923a2e2c07ddb01b1b1be1f990e',
  'amendment anonymous': PUBLIC_ROOT,
  'amendment viewer': 'e2341c2e0e90a1836b6bbb4a581a0513520393e5ab3f58e3b5a8d8e32a6bc696',
  'change request anonymous': 'c732c233eec47039930b50efae92e4c462707219203ac8b8224fb74ca4ab8f49',
  'change request viewer': '4d73e8379b5fc490372cabfe2ae93e6be413039297a9c715548a41fdc4d197ca',
  'blog anonymous': PUBLIC_ROOT,
  'blog viewer': '59479706b532672ac919804cbadc9a776773f954610e9ced21d3587455c39532',
  'statement anonymous': 'df7403d7adaba20fa9862fecf34cbfa70235b0485633cc637451f8f74b1331b8',
  'statement viewer': '1bca5dfc8efca23d75886decc043b97e3627c149120cf8c3329903b0641f5486',
  'todo anonymous': PUBLIC_ROOT,
  'todo viewer': 'e3c6239b1f2e01421de4128fc01a7977b623404a1b1cbf1c4dcd9e7e05adaa1e',
  'agenda anonymous': '28fdd36fb6cd61f345bd7e29788bcd9e5f548f817878fdc1118e39fe1c6cbc6c',
  'agenda viewer': '5c33f42b199dd146379ba7bedf6c9da30147679bdc7e0e0b51bc8a0947c97152',
  'election anonymous': 'bce1f2b011040efadbdf18d1b12ad873d369c4870e66e2ca0ed9f2f4a9235b8a',
  'election viewer': 'e9a5bcbdfb763441ce40a1903ca37e51ecbe3653285043a0019b137324ce24e7',
  'dataset anonymous': 'acf5072c677034a2c8923170e248ab962a76d2935b462bdbde1ea8df9bc66e28',
  'dataset viewer': 'bb6cfdc7a326bffac89738a068a938b7f8825b5681331a4961aea4c2d413ebd4',
  'election manager anonymous': DENIED,
  'election manager viewer': '2f0bdb5dcbad0bc6e7a1e51f489ab7c7c9db507e44cbc4cbf83e4e30f947aefe',
  'election elector anonymous': DENIED,
  'election elector viewer': '0ca188d261c277e443eea1b44c353d5785dacfb1833d6754da6df36692395865',
  'vote anonymous': '101cd91c52ebe59059e17774e20038032be32e1f213b547882d246baef3b4eca',
  'vote viewer': '0b374f6fc19aa6d3a4bf33615e92ebdf5b0adebd9cefbd3d181d1e9dfc26e5c7',
  'role anonymous': 'acf5072c677034a2c8923170e248ab962a76d2935b462bdbde1ea8df9bc66e28',
  'role viewer': 'ba7b9777cf9eb9a382ed7571f0289c14d8995bbce5cb8fb4741d543fb0a5b0c3',
  'vote manager anonymous': DENIED,
  'vote manager viewer': '176366bbce5a5118e14246cdd6ec3003dbd7ec066a47b6ba8ec022f810e256fa',
  'vote voter anonymous': DENIED,
  'vote voter viewer': '71fe47ed2af023597e9ae4d066a3048e27901736c28df74a54e939e1d823002c',
  'accreditation anonymous': DENIED,
  'accreditation viewer': 'f395373c1591d80006ece3f2d5c55403b494dc14bb2de6dffc7a4d73669f558b',
  'document anonymous default': 'cd3b7ad39b5082666eef3bf93e46ffe29e69d18ed3ed4dc6cda18166d74a7904',
  'document anonymous false flip':
    '08903444cf7d0472707ff6b79533ca952a03318821aa7f447d8f3d49d64fdbcf',
  'document anonymous true flip':
    'd98b9c9eb1f57e6658dd5da29dc58635ffb3e8ba06a610d67b75e54c718db226',
  'document viewer default': '0e27b8e14d9b8f95491c77227e0f48c7250d4a9c24c1aa215c573ade5f3d1a52',
  'document viewer false flips': 'aa8822fabd9908644d08bd4ea766c1577eafca0bb7404873e1163ef795ce8521',
  'document viewer true flips': 'c963252575a8795cc517b24001b6036897f4ed87f141795a80f1cacf5e0322e9',
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
