// Dependency-free checks for the diagnostics helpers; no network or credentials.
// Run: node --test scripts/instagram-diagnostics.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EXPECTED_TOKEN_SCOPES,
  EXPECTED_WEBHOOK_FIELDS,
  normalizeSubscribedFields,
  computeMissing,
  extractScopesFromDebugToken,
  buildRecommendations,
} from '../lib/meta/subscription-health.ts';

test('expected constants match the OAuth scope string and subscribe call', () => {
  assert.deepEqual([...EXPECTED_TOKEN_SCOPES], [
    'instagram_business_basic',
    'instagram_business_manage_messages',
    'instagram_business_manage_comments',
    'instagram_business_manage_insights',
  ]);
  assert.deepEqual([...EXPECTED_WEBHOOK_FIELDS], [
    'comments',
    'messages',
    'messaging_postbacks',
    'messaging_seen',
  ]);
});

test('normalizeSubscribedFields handles arrays, comma strings, and junk', () => {
  assert.deepEqual(normalizeSubscribedFields(['comments', 'messages']), ['comments', 'messages']);
  assert.deepEqual(normalizeSubscribedFields('comments,messages'), ['comments', 'messages']);
  assert.deepEqual(normalizeSubscribedFields(' comments , messaging_postbacks '), ['comments', 'messaging_postbacks']);
  assert.deepEqual(normalizeSubscribedFields(undefined), []);
  assert.deepEqual(normalizeSubscribedFields(null), []);
  assert.deepEqual(normalizeSubscribedFields(''), []);
  assert.deepEqual(normalizeSubscribedFields(42), []);
  assert.deepEqual(normalizeSubscribedFields([1, 'comments', null]), ['comments']);
});

test('computeMissing preserves expected order and ignores extras', () => {
  assert.deepEqual(computeMissing(['a', 'b', 'c'], ['c', 'a']), ['b']);
  assert.deepEqual(computeMissing(['a', 'b'], ['b', 'a', 'extra']), []);
  assert.deepEqual(computeMissing(['a'], []), ['a']);
  assert.deepEqual(computeMissing([], ['a']), []);
});

test('extractScopesFromDebugToken merges scopes and granular_scopes', () => {
  assert.deepEqual(
    extractScopesFromDebugToken({
      is_valid: true,
      scopes: ['public_profile'],
      granular_scopes: [
        { scope: 'instagram_business_basic', target_ids: [] },
        { scope: 'instagram_business_manage_messages' },
        { scope: 'instagram_business_basic' },
      ],
    }),
    ['public_profile', 'instagram_business_basic', 'instagram_business_manage_messages']
  );
  assert.deepEqual(extractScopesFromDebugToken({}), []);
  assert.deepEqual(extractScopesFromDebugToken(null), []);
  assert.deepEqual(extractScopesFromDebugToken({ granular_scopes: 'nope' }), []);
});

test('recommendations: undecryptable token short-circuits', () => {
  const recs = buildRecommendations({
    tokenDecryptOk: false,
    tokenValid: null,
    missingScopes: [],
    subscriptionReadOk: false,
    missingFields: [],
    repairOutcome: null,
  });
  assert.equal(recs.length, 1);
  assert.match(recs[0], /cannot be decrypted/);
});

test('recommendations: invalid token short-circuits', () => {
  const recs = buildRecommendations({
    tokenDecryptOk: true,
    tokenValid: false,
    missingScopes: [],
    subscriptionReadOk: false,
    missingFields: [],
    repairOutcome: null,
  });
  assert.equal(recs.length, 1);
  assert.match(recs[0], /invalid or expired/);
});

test('recommendations: missing messaging scope calls out the exact Meta error', () => {
  const recs = buildRecommendations({
    tokenDecryptOk: true,
    tokenValid: true,
    missingScopes: ['instagram_business_manage_messages'],
    subscriptionReadOk: true,
    missingFields: [],
    repairOutcome: null,
  });
  assert.equal(recs.length, 1);
  assert.match(recs[0], /instagram_business_manage_messages/);
  assert.match(recs[0], /2534066/);
  assert.match(recs[0], /every permission toggle ON/i);
});

test('recommendations: missing postbacks field points at repair, then celebrates repair', () => {
  const base = {
    tokenDecryptOk: true,
    tokenValid: true,
    missingScopes: [],
    subscriptionReadOk: true,
    missingFields: ['messaging_postbacks', 'messaging_seen'],
  };
  const before = buildRecommendations({ ...base, repairOutcome: null });
  assert.match(before[0], /messaging_postbacks, messaging_seen/);
  assert.match(before[0], /\?repair=true/);

  const failed = buildRecommendations({ ...base, repairOutcome: 'failed' });
  assert.match(failed[0], /repair attempt failed/);

  const applied = buildRecommendations({ ...base, missingFields: [], repairOutcome: 'applied' });
  assert.match(applied[0], /repaired just now/);
});

test('recommendations: subscription read failure surfaces the error', () => {
  const recs = buildRecommendations({
    tokenDecryptOk: true,
    tokenValid: true,
    missingScopes: [],
    subscriptionReadOk: false,
    subscriptionError: 'Invalid OAuth access token',
    missingFields: [],
    repairOutcome: null,
  });
  assert.equal(recs.length, 1);
  assert.match(recs[0], /Invalid OAuth access token/);
});

test('recommendations: all clear mentions the in-app message access toggle', () => {
  const recs = buildRecommendations({
    tokenDecryptOk: true,
    tokenValid: true,
    missingScopes: [],
    subscriptionReadOk: true,
    missingFields: [],
    repairOutcome: null,
  });
  assert.equal(recs.length, 1);
  assert.match(recs[0], /No gaps detected/);
  assert.match(recs[0], /Allow access to messages/);
});
