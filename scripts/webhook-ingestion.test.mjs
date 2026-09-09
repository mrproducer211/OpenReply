// Dependency-free regression checks; no credentials, network or real sends.
// Node 22: node --experimental-strip-types --test scripts/webhook-ingestion.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { ingestWebhook, isWebhookPayload, postbackJobId, getPostbackCampaignId } from '../lib/meta/webhook-ingestion.ts';

const event = { instagramAccountId: 'ig-a', userId: 'person-a', payload: 'reveal:campaign-a', mid: 'mid:one' };
const entry = { id: 'ig-a', time: 1234, messaging: [] };
const payload = { object: 'instagram', entry: [entry] };

function setup() {
  const trace = [], outcomes = [], finished = [], created = [], queued = new Map(), campaignChecks = [];
  const d = {
    parse: () => ({ comments: [], messages: [], postbacks: [event], readCount: 0 }),
    getAccount: async id => ({ id: `row-${id}`, workspaceId: `workspace-${id}` }),
    isActiveCampaign: async (...args) => { campaignChecks.push(args); return true; },
    createEvent: async (p, workspaceId) => { trace.push('create'); created.push({ p, workspaceId }); return `event-${created.length}`; },
    finishEvent: async (...args) => { finished.push(args); },
    enqueue: async (action, id) => { trace.push('enqueue'); if (queued.has(id)) return false; queued.set(id, action); return true; },
    recordOutcome: async outcome => { outcomes.push(outcome); },
  };
  return { d, trace, outcomes, finished, created, queued, campaignChecks };
}

test('reject malformed envelopes without side effects', async () => {
  for (const p of [null, [], {}, { object: 'instagram', entry: {} }, { object: 'instagram', entry: [null] }, { object: 'instagram', entry: [{ id: '' }] }, { object: 'instagram', entry: [{ id: 'a', messaging: {} }] }, { object: 'unknown', entry: [] }]) assert.equal(isWebhookPayload(p), false);
  const { d, created, queued } = setup();
  await assert.rejects(ingestWebhook(null, d), /Invalid webhook envelope/);
  assert.equal(created.length, 0);
  assert.equal(queued.size, 0);
});

test('valid action payloads only; reject trailing newline and extra components', () => {
  for (const p of ['reveal:', 'followcheck:', 'other:a', 'reveal:a:b', 'reveal:a\n', 'reveal:../../b']) assert.equal(getPostbackCampaignId(p), null);
  assert.equal(getPostbackCampaignId('reveal:campaign-a'), 'campaign-a');
  assert.equal(getPostbackCampaignId('followcheck:campaign-a'), 'campaign-a');
});

test('stable, scoped and BullMQ-safe event IDs', () => {
  const id = postbackJobId(event, entry);
  assert.match(id, /^postback_[a-f0-9]{64}$/);
  assert.equal(postbackJobId(event, { ...entry, time: 9999 }), id);
  assert.notEqual(postbackJobId({ ...event, instagramAccountId: 'ig-b' }, entry), id);
  assert.notEqual(postbackJobId({ ...event, userId: 'person-b' }, entry), id);
});

test('mid-less redelivery is independent of wall clock and object key ordering', () => {
  const p = { ...event, mid: undefined };
  assert.equal(postbackJobId(p, { id: 'ig-a', time: 10, nested: { b: 2, a: 1 } }), postbackJobId(p, { nested: { a: 1, b: 2 }, time: 10, id: 'ig-a' }));
  assert.notEqual(postbackJobId(p, { ...entry, time: 20 }), postbackJobId(p, { ...entry, time: 21 }));
});

test('button-only events receive a workspace before enqueue', async () => {
  const x = setup();
  assert.deepEqual(await ingestWebhook(payload, x.d), { failed: false, entries: 1 });
  assert.deepEqual(x.trace.slice(0, 2), ['create', 'enqueue']);
  assert.equal(x.created[0].workspaceId, 'workspace-ig-a');
  assert.deepEqual(x.campaignChecks, [['campaign-a', 'row-ig-a']]);
  assert.deepEqual(x.queued.get(postbackJobId(event, entry)), { name: 'process-postback', data: event });
});

test('reject campaign from another account or inactive campaign', async () => {
  const x = setup();
  x.d.isActiveCampaign = async () => false;
  await ingestWebhook(payload, x.d);
  assert.equal(x.queued.size, 0);
  assert.equal(x.outcomes[0].rejected, 1);
  assert.equal(x.outcomes[0].level, 'WARNING');
});

test('reject parsed account mismatch and malformed action', async () => {
  for (const p of [{ ...event, instagramAccountId: 'ig-b' }, { ...event, payload: 'reveal:a:b' }]) {
    const x = setup(); x.d.parse = () => ({ comments: [], messages: [], postbacks: [p], readCount: 0 });
    await ingestWebhook(payload, x.d); assert.equal(x.queued.size, 0); assert.equal(x.outcomes[0].rejected, 1);
  }
});

test('unknown account is observable without sending', async () => {
  const x = setup(); x.d.getAccount = async () => null;
  await ingestWebhook(payload, x.d); assert.equal(x.queued.size, 0); assert.equal(x.outcomes[0].outcome, 'UNMAPPED_ACCOUNT_IGNORED');
});

test('mixed-account batches retain separate payloads and workspaces', async () => {
  const x = setup(); x.d.parse = () => ({ comments: [], messages: [], postbacks: [], readCount: 0 });
  await ingestWebhook({ object: 'instagram', entry: [{ id: 'ig-a' }, { id: 'ig-b' }] }, x.d);
  assert.deepEqual(x.created, [{ p: { object: 'instagram', entry: [{ id: 'ig-a' }] }, workspaceId: 'workspace-ig-a' }, { p: { object: 'instagram', entry: [{ id: 'ig-b' }] }, workspaceId: 'workspace-ig-b' }]);
});

test('read receipt never schedules a reveal', async () => {
  const x = setup(); x.d.parse = () => ({ comments: [], messages: [], postbacks: [], readCount: 1 });
  await ingestWebhook(payload, x.d); assert.equal(x.queued.size, 0); assert.equal(x.outcomes[0].readsIgnored, 1);
});

test('queue failure is attributed and requests HTTP retry', async () => {
  const x = setup(); x.d.enqueue = async () => { throw Error('Redis unavailable'); };
  assert.deepEqual(await ingestWebhook(payload, x.d), { failed: true, entries: 1 });
  assert.equal(x.created[0].workspaceId, 'workspace-ig-a'); assert.equal(x.finished[0][1], 'FAILED');
});

test('connection secrets do not leak through stored ingestion errors', async () => {
  const x = setup(); x.d.enqueue = async () => { throw Error('redis://user:secret@host'); };
  await ingestWebhook(payload, x.d); assert.ok(!JSON.stringify(x.finished).includes('secret'));
});

test('successful enqueue followed by persistence failure does not create another job on retry', async () => {
  const x = setup(); const record = x.d.recordOutcome; let fail = true;
  x.d.recordOutcome = async result => { if (fail) { fail = false; throw Error('DB unavailable'); } await record(result); };
  assert.equal((await ingestWebhook(payload, x.d)).failed, true);
  assert.equal((await ingestWebhook(payload, x.d)).failed, false);
  assert.equal(x.queued.size, 1); assert.equal(x.outcomes[0].duplicates, 1); assert.equal(x.outcomes[0].queued, 0);
});

test('independent entries continue after account lookup failure', async () => {
  const x = setup(); const lookup = x.d.getAccount;
  x.d.getAccount = async id => { if (id === 'ig-a') throw Error('DB unavailable'); return lookup(id); };
  x.d.parse = () => ({ comments: [], messages: [], postbacks: [], readCount: 0 });
  assert.deepEqual(await ingestWebhook({ object: 'instagram', entry: [{ id: 'ig-a' }, { id: 'ig-b' }] }, x.d), { failed: true, entries: 2 });
  assert.equal(x.created[0].workspaceId, 'workspace-ig-b');
});

test('comment and inbound-message job contracts are preserved', async () => {
  const x = setup(); const comment = { instagramAccountId: 'ig-a', commentId: 'c1', commentText: 'link', commenterId: 'p1', mediaId: 'm1' };
  const message = { instagramAccountId: 'ig-a', messageId: 'mid:a/b', messageText: 'link', senderId: 'p1' };
  x.d.parse = () => ({ comments: [comment], messages: [message], postbacks: [], readCount: 0 });
  await ingestWebhook(payload, x.d);
  assert.deepEqual(x.queued.get('comment_ig-a_c1'), { name: 'process-comment', data: { ...comment, source: 'WEBHOOK' } });
  assert.deepEqual(x.queued.get(`message_ig-a_${Buffer.from(message.messageId).toString('base64url')}`), { name: 'process-message', data: message });
});
