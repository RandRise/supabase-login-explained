import {
  buildPlaygroundRequest,
  previewPlaygroundRequest,
  describePlaygroundResponse,
} from './js/playground-request.js';
import { inboxValid } from './core.mjs';
import { createApi } from './js/api.js';
import { INBOX_PATH, SEND_PATH } from './js/constants.js';
import { STATIC_FILES } from './server-config.mjs';
import assert from 'node:assert/strict';
import { createStaticServer } from './server.mjs';
import { decode, validateConfig, mutate, boundary, reportValid, actionVerdict } from './core.mjs';
let checks = 0;
const check = (a, b, msg) => {
  assert.deepEqual(a, b, msg);
  checks++;
};
const h = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
const p = Buffer.from(
  JSON.stringify({ sub: 'alice', email: 'alice@test.invalid', exp: 2000000000 }),
).toString('base64url');
const jwt = h + '.' + p + '.dummy';
check(decode(jwt).payload.sub, 'alice', 'Decode identity');
check(decode(mutate(jwt, { sub: 'bob' })).payload.sub, 'bob', 'Mutation changes claims');
check(
  decode(mutate(jwt, { sub: 'bob' })).signature,
  decode(jwt).signature,
  'Mutation leaves signature unchanged',
);
for (const input of ['e30.bnVsbA.x', 'e30.W10.x', 'e30.eyJleHAiOiJzb29uIn0.x', 'not-a-jwt']) {
  assert.throws(() => decode(input));
  checks++;
}
check(
  validateConfig(' https://test-project.supabase.co/ ', 'sb_publishable_example'),
  { url: 'https://test-project.supabase.co', key: 'sb_publishable_example' },
  'Config normalized',
);
for (const [url, key] of [
  ['http://test.supabase.co', 'sb_publishable_x'],
  ['https://attacker.example', 'sb_publishable_x'],
  ['https://test.supabase.co', 'sb_secret_x'],
  [
    'https://test.supabase.co',
    h +
      '.' +
      Buffer.from(JSON.stringify({ role: 'service_role', exp: 2000000000 })).toString('base64url') +
      '.x',
  ],
]) {
  assert.throws(() => validateConfig(url, key));
  checks++;
}
const baseline = { scope: 'project', sub: 'bob', rows: 1 };
check(
  boundary({ ok: true, data: [] }, baseline, 'project', 'bob'),
  'BOUNDARY HELD',
  'Known baseline',
);
check(boundary({ ok: true, data: [] }, null, 'project', 'bob'), 'NEEDS BASELINE', 'No baseline');
check(
  boundary({ ok: true, data: [] }, baseline, 'other-project', 'bob'),
  'NEEDS BASELINE',
  'Project-scoped baseline',
);
check(
  boundary({ ok: true, data: [{ user_id: 'bob' }] }, baseline, 'project', 'bob'),
  'DATA EXPOSED',
  'Leak flagged',
);
check(
  boundary({ ok: false, data: { message: 'error' } }, baseline, 'project', 'bob'),
  'INCONCLUSIVE',
  'Failure is inconclusive',
);
const report = {
  owner_id: 'alice',
  generated_at: '2026-10-08T10:00:00Z',
  notes: [{ user_id: 'alice', title: 'Private note', body: 'Invented data' }],
};
check(reportValid(report, 'alice'), true, 'Owner report valid');
check(reportValid(report, 'bob'), false, 'Wrong owner refused');
check(
  reportValid(
    { ...report, notes: [{ user_id: 'bob', title: 'Private note', body: 'Other owner' }] },
    'alice',
  ),
  false,
  'Cross-owner rows refused',
);
check(reportValid({ ...report, notes: [] }, 'alice'), false, 'Seeded note required for evidence');
check(reportValid(null, 'alice'), false, 'Malformed report refused');
check(actionVerdict({ status: 401, ok: false }), 'DENIED', 'Anonymous authentication refusal');
check(actionVerdict({ status: 403, ok: false }), 'DENIED', 'Permission refusal');
check(
  actionVerdict({ status: 404, ok: false }),
  'INCONCLUSIVE',
  'Missing function is inconclusive',
);
check(actionVerdict({ status: 500, ok: false }), 'INCONCLUSIVE', 'Server error is inconclusive');
check(
  actionVerdict({ status: 200, ok: true, data: null }),
  'INCONCLUSIVE',
  'Empty successful response is inconclusive',
);

const message = {
  id: 'fixture-note',
  sender_id: 'bob',
  recipient_id: 'alice',
  sender_name: 'Bob',
  sender_email: 'bob@test.invalid',
  subject: 'Hello',
  body: 'Invented data',
  created_at: '2026-10-09T10:00:00Z',
};
check(inboxValid({ owner_id: 'alice', messages: [message] }, 'alice'), true, 'Inbox matches owner');
check(inboxValid({ owner_id: 'alice', messages: [] }, 'alice'), true, 'Empty inbox legitimate');
check(
  inboxValid({ owner_id: 'bob', messages: [message] }, 'alice'),
  false,
  'Wrong inbox owner refused',
);
check(
  inboxValid({ owner_id: 'alice', messages: [{ ...message, recipient_id: 'bob' }] }, 'alice'),
  false,
  'Foreign recipient refused',
);
check(
  inboxValid({ owner_id: 'alice', messages: [{ ...message, created_at: 'invalid' }] }, 'alice'),
  false,
  'Malformed timestamp refused',
);
check(inboxValid({ owner_id: 'alice', messages: [null] }, 'alice'), false, 'Null message refused');
check(inboxValid(null, undefined), false, 'Missing owner refused');
const realFetch = globalThis.fetch;
const calls = [];
try {
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options });
    return { ok: true, status: 200, text: async () => JSON.stringify({ fixture: true }) };
  };
  const api = createApi(() => ({ url: 'https://test.supabase.co', key: 'sb_publishable_fixture' }));
  await api.getInbox();
  check(calls[0].headers.Authorization, undefined, 'Anonymous request really omits bearer');
  check(calls[0].url, 'https://test.supabase.co' + INBOX_PATH, 'Real inbox route');
  await api.getInbox('invented-fixture-token');
  check(
    calls[1].headers.Authorization,
    'Bearer invented-fixture-token',
    'Token is request credential',
  );
  await api.sendMessage('invented-fixture-token', {
    p_recipient_id: 'bob',
    p_subject: 'Hello',
    p_body: 'Hi',
  });
  check(calls[2].url, 'https://test.supabase.co' + SEND_PATH, 'Real send route');
  check('sender_id' in JSON.parse(calls[2].body), false, 'Send RPC has no client-selected sender');
  check(calls[2].credentials, 'omit', 'Cookie auth not simulated');
} finally {
  globalThis.fetch = realFetch;
}

const unsignedRequest = buildPlaygroundRequest({
  action: 'inbox',
  attachToken: false,
  token: 'fixture-bearer',
});
check(unsignedRequest.token, '', 'Unchecked toggle ignores a filled token');
check(unsignedRequest.body, {}, 'Inbox RPC body');
const signedRequest = buildPlaygroundRequest({
  action: 'inbox',
  attachToken: true,
  token: 'Bearer fixture-bearer',
});
check(signedRequest.token, 'fixture-bearer', 'Bearer prefix accepted');
assert.throws(() => buildPlaygroundRequest({ action: 'inbox', attachToken: true, token: '' }));
checks++;
assert.throws(() => buildPlaygroundRequest({ action: 'unknown', attachToken: false }));
checks++;
const sendRequest = buildPlaygroundRequest({
  action: 'send',
  attachToken: true,
  token: 'fixture-bearer',
  recipientId: 'bob',
  subject: '  Hello  ',
  note: ' Hi Bob ',
});
check(
  sendRequest.body,
  { p_recipient_id: 'bob', p_subject: 'Hello', p_body: 'Hi Bob' },
  'Normal send derives sender on server',
);
const otherRequest = buildPlaygroundRequest({
  action: 'other-inbox',
  attachToken: true,
  token: 'fixture-bearer',
  targetId: 'bob',
});
check(otherRequest.method, 'GET', 'RLS boundary uses real table API');
check(otherRequest.path.includes('recipient_id=eq.bob'), true, 'Specific known recipient query');
const forgeRequest = buildPlaygroundRequest({
  action: 'forge',
  attachToken: true,
  token: 'fixture-bearer',
  senderId: 'bob',
  recipientId: 'alice',
  subject: 'Test',
  note: 'Invented',
});
check(forgeRequest.body.sender_id, 'bob', 'Forgery test actually attempts another sender');
const safePreview = previewPlaygroundRequest(signedRequest, 'https://test.supabase.co');
check(safePreview.includes('fixture-bearer'), false, 'Token redacted from preview');
check(
  safePreview.includes('Bearer [hidden token]'),
  true,
  'Attached bearer visible without credential',
);
check(
  previewPlaygroundRequest(unsignedRequest, 'https://test.supabase.co').includes('Authorization'),
  false,
  'Anonymous preview omits header',
);
check(
  describePlaygroundResponse({ ok: false, status: 404, data: {} }, 'inbox').includes(
    'does not demonstrate',
  ),
  true,
  '404 not presented as auth proof',
);
check(
  describePlaygroundResponse({ ok: true, status: 200, data: [] }, 'other-inbox').includes(
    'not HTTP denial',
  ),
  true,
  'Empty rows explained separately',
);
check(
  describePlaygroundResponse({ ok: false, status: 403 }, 'forge').includes('refused'),
  true,
  '403 is permission refusal',
);
check(
  describePlaygroundResponse({ ok: true, status: 200, data: null }, 'inbox').includes(
    'not confirmed',
  ),
  true,
  'Malformed success inconclusive',
);

const server = createStaticServer();
await new Promise((r) => server.listen(0, '127.0.0.1', r));
try {
  const base = 'http://127.0.0.1:' + server.address().port;
  for (const [path] of STATIC_FILES.filter(([path]) => path !== '/connection.public.json')) {
    check((await fetch(base + path)).status, 200, 'Serve ' + path);
  }
  for (const path of [
    '/server.mjs',
    '/server-config.mjs',
    '/.env',
    '/api/login',
    '/START-HERE.txt',
  ])
    check((await fetch(base + path)).status, 404, 'Do not serve ' + path);
  check((await fetch(base + '/', { method: 'POST' })).status, 405, 'No auth backend here');
  const r = await fetch(base + '/');
  check(r.headers.get('cache-control'), 'no-store', 'No token caching');
  check(
    r.headers.get('content-security-policy').includes("connect-src 'self' https://*.supabase.co"),
    true,
    'Restrict provider destinations',
  );
} finally {
  await new Promise((r) => server.close(r));
}
console.log(
  checks +
    ' checks passed: decoder, config safety, inbox ownership, request credentials and static server.',
);
