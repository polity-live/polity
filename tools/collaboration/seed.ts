import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import * as Y from 'yjs';
import { createDocument } from '../../src/features/communication-studio/logic/templates';
import { ffmpeg } from '../studio/exporters';
import { element } from '../../src/features/communication-studio/logic/document';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { initialize } from '../../src/features/communication-studio/logic/collaboration';
import { createEmptyCityDesignState } from '../../src/features/amendments/city-design/state/cityDesignReducer';
import { createPointCityDesignObject } from '../../src/features/amendments/city-design/logic/cityDesignPlacement';
import { checksum, createStored } from '../../src/server/collaboration/store';
import { getRequiredEnvVar } from '../../src/lib/env';

const url = new URL(getRequiredEnvVar(process.env.ZERO_UPSTREAM_DB, 'ZERO_UPSTREAM_DB'));
if (
  !['127.0.0.1', 'localhost'].includes(url.hostname) ||
  url.port !== '54322' ||
  url.pathname !== '/postgres'
)
  throw new Error('Demo seed requires the local Polity database');
const api = new URL(getRequiredEnvVar(process.env.SUPABASE_URL, 'SUPABASE_URL'));
if (!['127.0.0.1', 'localhost'].includes(api.hostname) || api.port !== '54321')
  throw new Error('Demo auth must be local');
const serviceRoleKey = getRequiredEnvVar(
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  'SUPABASE_SERVICE_ROLE_KEY'
);
const sql = postgres(url.toString(), { max: 1 });
const [control] = await sql`select phase from collaboration_control where singleton`;
if (control.phase !== 'legacy')
  throw new Error('Seed before migration; reset explicitly for a fresh demo');
const uuid = (name: string) => {
  const hex = createHash('sha256').update(`polity-collaboration-demo:${name}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};
const ids = Object.fromEntries(
  [
    'group',
    'amendment',
    'document',
    'personal',
    'groupDocument',
    'groupAmendment',
    'blog',
    'city',
    'studio',
    'run',
    'branchA',
    'branchB',
    'branchDocA',
    'branchDocB',
    'internalProposal',
    'publicProposal',
    'ballotDocument',
    'ballotAmendment',
    'ballotVersion',
    'ballot',
    'event',
    'agenda',
    'imageAsset',
    'videoAsset',
  ].map(name => [name, uuid(name)])
);
const [existing] = await sql`select id from document where id=${ids.document}`;
if (existing) {
  console.log('Reproducible demo already exists.');
  await sql.end();
  process.exit(0);
}
const admin = createClient(api.toString(), serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const roles = [
  'owner',
  'editor',
  'proposer',
  'reader',
  'outsider',
  ...Array.from({ length: 10 }, (_, i) => `load${i + 1}`),
];
const actors: Record<string, { id: string; email: string }> = {};
const password = 'Polity.Local.2026!';
const { data: known } = await admin.auth.admin.listUsers({ perPage: 1000 });
for (const role of roles) {
  const email = `${role}@collaboration.polity.test`;
  let user = known.users.find(u => u.email === email);
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name: role, language: 'de' },
    });
    if (error || !data.user) throw error ?? new Error('Demo user missing');
    user = data.user;
  }
  actors[role] = { id: user.id, email };
}
const text = (title: string) => [
  { id: uuid(title), type: 'h1', children: [{ text: title }] },
  {
    id: uuid(`${title}:p`),
    type: 'p',
    children: [{ text: 'Gemeinsam bearbeiten. Entscheidungen bleiben nachvollziehbar.' }],
  },
];
const city = {
  ...createEmptyCityDesignState(),
  objects: [createPointCityDesignObject({ id: uuid('tree'), type: 'tree', point: { x: 5, z: 6 } })],
};
const studio = createDocument('single', 'Unser gemeinsamer Stadtteil');
await admin.storage.createBucket('studio', { public: false, fileSizeLimit: 104857600 });
const mediaFolder = path.resolve('output/local-stack/demo-media');
mkdirSync(mediaFolder, { recursive: true });
const assets: { id: string; name: string; mime: string; bytes: number; storagePath: string }[] = [];
for (const [key, name, mime, args] of [
  [
    'imageAsset',
    'Stadtteil.png',
    'image/png',
    ['-y', '-f', 'lavfi', '-i', 'color=c=0x12362D:s=480x320', '-frames:v', '1'],
  ],
  [
    'videoAsset',
    'Stadtteil.mp4',
    'video/mp4',
    [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'testsrc2=size=320x240:rate=30',
      '-t',
      '2',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
    ],
  ],
] as const) {
  const file = path.join(mediaFolder, name);
  await ffmpeg([...args, file]);
  const bytes = readFileSync(file),
    storagePath = `${ids.studio}/assets/${ids[key]}`;
  const { error } = await admin.storage
    .from('studio')
    .upload(storagePath, bytes, { contentType: mime, upsert: true });
  if (error) throw error;
  assets.push({ id: ids[key], name, mime, bytes: bytes.length, storagePath });
}
studio.pages[0].elements.push(
  element('image', { assetId: ids.imageAsset, x: 740, y: 960, width: 220, height: 145, order: 5 })
);
const ydoc = new Y.Doc();
initialize(ydoc, studio);
await sql.begin(async tx => {
  await tx`select pg_advisory_xact_lock(1886351981)`;
  for (const [role, actor] of Object.entries(actors))
    await tx`insert into "user"(id,email,handle,first_name,last_name,tutorial_step,assistant_introduction) values(${actor.id},${actor.email},${`demo-${role}`},${role},'Demo',999,true) on conflict(id) do update set handle=excluded.handle,first_name=excluded.first_name,tutorial_step=999,assistant_introduction=true`;
  await tx`insert into "group"(id,name,owner_id,visibility) values(${ids.group},'Collaboration Demo',${actors.owner.id},'public')`;
  for (const name of [
    'document',
    'personal',
    'groupDocument',
    'branchDocA',
    'branchDocB',
    'ballotDocument',
  ])
    await tx`insert into document(id,content,editing_mode) values(${ids[name]},${tx.json(text(name))},'edit')`;
  await tx`insert into amendment(id,title,created_by_id,group_id,document_id,visibility) values(${ids.amendment},'Mehr Grün im Stadtteil',${actors.owner.id},${ids.group},${ids.document},'public'),(${ids.groupAmendment},'Gruppenhandbuch',${actors.owner.id},${ids.group},${ids.groupDocument},'private')`;
  await tx`update document set amendment_id=${ids.amendment} where id in ${tx([ids.document, ids.branchDocA, ids.branchDocB])}`;
  await tx`update document set amendment_id=${ids.groupAmendment} where id=${ids.groupDocument}`;
  await tx`insert into blog(id,title,content,editing_mode,visibility,group_id) values(${ids.blog},'Aus unserer Gruppe',${tx.json(text('Blog'))},'edit','public',${ids.group})`;
  for (const [name, actor] of Object.entries(actors)) {
    if (name === 'outsider') continue;
    const membership = uuid(`membership:${name}`),
      groupRole = uuid(`group-role:${name}`);
    await tx`insert into group_membership(id,group_id,user_id,status) values(${membership},${ids.group},${actor.id},${name === 'owner' ? 'admin' : 'active'})`;
    await tx`insert into role(id,name,scope,group_id) values(${groupRole},${name},'group',${ids.group})`;
    await tx`insert into group_membership_role(group_membership_id,role_id) values(${membership},${groupRole})`;
    if (name !== 'reader' && name !== 'proposer')
      for (const resource of ['groupDocuments', 'communicationStudio'])
        await tx`insert into action_right(role_id,group_id,resource,action) values(${groupRole},${ids.group},${resource},'manage')`;
    for (const amendment of [ids.amendment, ids.groupAmendment]) {
      const role = uuid(`role:${name}:${amendment}`);
      await tx`insert into role(id,name,scope,amendment_id) values(${role},${name},'amendment',${amendment})`;
      await tx`insert into amendment_collaborator(amendment_id,user_id,role_id,status) values(${amendment},${actor.id},${role},'active')`;
      if (name !== 'reader')
        for (const [resource, action] of name === 'proposer'
          ? [['amendments', 'update']]
          : [
              ['amendments', 'manage'],
              ['documents', 'update'],
              ['amendments', 'vote'],
            ])
          await tx`insert into action_right(role_id,amendment_id,resource,action) values(${role},${amendment},${resource},${action})`;
    }
    if (name !== 'reader' && name !== 'proposer') {
      await tx`insert into document_collaborator(document_id,user_id,status) values(${ids.personal},${actor.id},'active')`;
      const role = uuid(`blog-role:${name}`);
      await tx`insert into role(id,name,scope,blog_id) values(${role},${name},'blog',${ids.blog})`;
      await tx`insert into action_right(role_id,blog_id,resource,action) values(${role},${ids.blog},'blogs','manage')`;
      await tx`insert into blog_blogger(blog_id,user_id,role_id,status) values(${ids.blog},${actor.id},${role},${name === 'owner' ? 'owner' : 'writer'})`;
    }
  }
  await tx`insert into amendment_city_design(id,amendment_id,created_by_id,title,design_state) values(${ids.city},${ids.amendment},${actors.owner.id},'Stadtteil gemeinsam gestalten',${tx.json(JSON.parse(JSON.stringify(city)))})`;
  await tx`insert into amendment_process_run(id,amendment_id,created_by_id,status) values(${ids.run},${ids.amendment},${actors.owner.id},'pending_event')`;
  for (const [i, name] of ['branchA', 'branchB'].entries()) {
    await tx`insert into amendment_process_branch(id,process_run_id,document_id,title,status,editing_mode) values(${ids[name]},${ids.run},${ids[i === 0 ? 'branchDocA' : 'branchDocB']},${`Variante ${i + 1}`},'pending_event','edit')`;
    const variant = structuredClone(city);
    variant.objects[0].properties.height = 8 + i * 4;
    await tx`insert into collaboration_legacy_snapshot(kind,entity_id,branch_id,projection,checksum,provenance) values('city',${ids.city},${ids[name]},${tx.json(JSON.parse(JSON.stringify(variant)))},${checksum(variant)},'Reproducible synthetic demo branch')`;
  }
  const proposals = [
    {
      key: 'internalProposal',
      scope: 'collaborators',
      mode: 'suggest_internal',
      text: ' Mehr Bäume vor der Schule.',
    },
    {
      key: 'publicProposal',
      scope: 'public',
      mode: 'suggest_public',
      text: ' Sichere Wege für alle.',
    },
  ];
  const proposalText: postgres.JSONValue[] = text('Mehr Grün im Stadtteil');
  for (const [i, proposal] of proposals.entries()) {
    const suggestion = ids[proposal.key];
    proposalText.push({
      id: uuid(`proposal-paragraph:${i}`),
      type: 'p',
      children: [
        {
          text: proposal.text,
          suggestion: true,
          [`suggestion_${suggestion}`]: {
            id: suggestion,
            type: 'insert',
            userId: actors.proposer.id,
          },
        },
      ],
    });
    await tx`insert into change_request(id,amendment_id,user_id,suggestion_id,title,status,visibility_scope,created_in_mode,voting_deadline) values(${suggestion},${ids.amendment},${actors.proposer.id},${suggestion},${proposal.text},'open',${proposal.scope},${proposal.mode},now()+interval '7 days')`;
  }
  await tx`update document set content=${tx.json(proposalText)} where id=${ids.document}`;
  const discussions = proposals.map((proposal, i) => ({
    id: ids[proposal.key],
    changeRequestEntityId: ids[proposal.key],
    visibilityScope: proposal.scope,
    comments: [
      {
        id: uuid(`comment:${i}`),
        userId: actors.proposer.id,
        contentRich: text(
          i ? 'Öffentlicher Vorschlag zur Diskussion.' : 'Interne Diskussion der Gruppe.'
        ),
        createdAt: new Date().toISOString(),
      },
    ],
  }));
  await tx`update amendment set discussions=${tx.json(discussions)} where id=${ids.amendment}`;
  await tx`insert into amendment(id,title,created_by_id,group_id,document_id,visibility) values(${ids.ballotAmendment},'Abstimmung: gemeinsamer Stadtteilfonds',${actors.owner.id},${ids.group},${ids.ballotDocument},'public')`;
  await tx`update document set amendment_id=${ids.ballotAmendment} where id=${ids.ballotDocument}`;
  await tx`insert into event(id,title,creator_id,group_id,visibility,start_date,end_date,timezone,status) values(${ids.event},'Demo: Stadtteilversammlung',${actors.owner.id},${ids.group},'public',now()+interval '3 days',now()+interval '3 days 2 hours','Europe/Berlin','planned')`;
  await tx`insert into agenda_item(id,event_id,amendment_id,creator_id,title,type,status,order_index,voting_phase) values(${ids.agenda},${ids.event},${ids.ballotAmendment},${actors.owner.id},'Stadtteilfonds beschließen','amendment','active',0,'final')`;
  await tx`insert into vote(id,amendment_id,agenda_item_id,title,purpose,status,closing_end_time) values(${ids.ballot},${ids.ballotAmendment},${ids.agenda},'Demo-Schlussabstimmung','closing','final',now()+interval '4 days')`;
  for (const [i, label] of ['Ja', 'Nein', 'Enthaltung'].entries())
    await tx`insert into vote_choice(id,vote_id,label,semantic_key,order_index) values(${uuid(`choice:${i}`)},${ids.ballot},${label},${['yes', 'no', 'abstain'][i]},${i})`;
  for (const actor of [actors.owner, actors.editor, actors.reader])
    await tx`insert into voter(vote_id,user_id) values(${ids.ballot},${actor.id})`;
  const ballotText = text('ballotDocument');
  await tx`insert into document_version(id,document_id,author_id,version_number,content) values(${ids.ballotVersion},${ids.ballotDocument},${actors.owner.id},1,${tx.json(ballotText)})`;
  await tx`insert into collaboration_legacy_snapshot(kind,entity_id,vote_id,version_id,projection,checksum,provenance) values('document',${ids.ballotDocument},${ids.ballot},${ids.ballotVersion},${tx.json(ballotText)},${checksum(ballotText)},'Reproducible synthetic ballot fixture, recorded at seed time')`;
  await tx`insert into studio_project(id,owner_id,group_id,title,kind,created_at,updated_at) values(${ids.studio},${actors.owner.id},${ids.group},${studio.title},${studio.kind},${Date.now()},${Date.now()})`;
  for (const asset of assets)
    await tx`insert into studio_asset(id,project_id,name,mime_type,byte_size,storage_path,ready,created_at) values(${asset.id},${ids.studio},${asset.name},${asset.mime},${asset.bytes},${asset.storagePath},true,${Date.now()})`;
  await tx`insert into studio_state(project_id,state,document,updated_at) values(${ids.studio},${Buffer.from(Y.encodeStateAsUpdate(ydoc))},${tx.json(studio)},${Date.now()})`;
});
ydoc.destroy();
// Only Studio is activated. Text, blogs and Streetdesign retain their legacy
// content, suggestions and Zero mutators after every local reset.
await sql.begin(async tx => {
  await tx`update collaboration_control set phase='active',compatibility=false,updated_at=${Date.now()} where singleton`;
  await createStored(
    { query: async (query, args) => tx.unsafe(query, args as postgres.ParameterOrJSON<never>[]) },
    { kind: 'studio', entityId: ids.studio, branchId: null, workspaceId: null },
    studio,
    actors.owner.id
  );
});
await admin.storage.createBucket('studio', { public: false, fileSizeLimit: 104857600 });
mkdirSync('output/local-stack', { recursive: true });
writeFileSync(
  'output/local-stack/demo.json',
  JSON.stringify({ seededAt: new Date().toISOString(), ids, actors, password }, null, 2)
);
console.log(
  JSON.stringify({
    demo: 'created',
    actors: roles.length,
    editorAreas: 6,
    manifest: 'output/local-stack/demo.json',
  })
);
await sql.end();
