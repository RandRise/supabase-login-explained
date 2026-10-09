import assert from 'node:assert/strict';
import { createSpec } from './student/js/openapi.js';

let count = 0;
function check(actual, expected, label) {
  assert.deepEqual(actual, expected, label);
  count++;
}

const spec = createSpec('https://fixture.supabase.co');
check(spec.openapi, '3.0.3');
check(spec.servers[0].url, 'https://fixture.supabase.co');
check(spec.security, [{ ProjectKey: [], BearerAuth: [] }], 'Both keys are required');
check(spec.paths['/rest/v1/rpc/team3_get_quiz'].post.security, [{ ProjectKey: [] }]);
check(spec.components.securitySchemes.BearerAuth.scheme, 'bearer');
check(spec.components.securitySchemes.ProjectKey.name, 'apikey');
const properties =
  spec.paths['/rest/v1/rpc/team3_submit_quiz'].post.requestBody.content['application/json'].schema
    .properties;
check(Object.keys(properties), ['p_answers'], 'No score or owner input');
check(properties.p_answers.example, [1, 2, 0]);

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { state } = await import('./student/js/state.js');
const { request } = await import('./student/js/api.js');
state.config = { url: 'https://fixture.supabase.co', key: 'sb_publishable_fixture' };
let captured;
globalThis.fetch = async (url, options) => {
  captured = { url, options };
  return new Response(JSON.stringify({ score: 2 }), { status: 200 });
};

await request('/rest/v1/rpc/team3_get_result');
check(captured.options.headers.Authorization, undefined, 'No implicit bearer');
check(captured.options.headers.apikey, state.config.key);
check(captured.options.credentials, 'omit');
const result = await request('/rest/v1/rpc/team3_submit_quiz', {
  token: 'fixture-token',
  body: { p_answers: [0, 2, 0] },
});
check(captured.options.headers.Authorization, 'Bearer fixture-token');
check(JSON.parse(captured.options.body), { p_answers: [0, 2, 0] });
check(result.data.score, 2);
check(result.attached, true);
globalThis.fetch = async () => {
  throw Error('Fixture offline');
};
await assert.rejects(request('/rest/v1/rpc/team3_get_result'), /No HTTP response/);
count++;
console.log(count + ' student API/OpenAPI checks passed (fixture HTTP).');
