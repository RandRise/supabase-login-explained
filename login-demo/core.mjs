export const SESSION_KEY = 'team3-supabase-session-v1';
export const CONFIG_KEY = 'team3-supabase-config-v1';
export const BASE_KEY = 'team3-supabase-bob-v1';
export const TABLE = 'team3_supabase_demo_notes';
export function decode(token) {
  if (typeof token !== 'string' || token.split('.').length !== 3) throw Error('Expected a three-part JWT.');
  const [h,p,s] = token.split('.');
  const parse = x => JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(x.replace(/-/g,'+').replace(/_/g,'/') + '='.repeat((4-x.length%4)%4)), c => c.charCodeAt(0))));
  const header = parse(h), payload = parse(p);
  if (!header || typeof header !== 'object' || Array.isArray(header) || !payload || typeof payload !== 'object' || Array.isArray(payload) || !Number.isFinite(payload.exp)) throw Error('Invalid JWT header, payload or expiry.');
  return {header,payload,signature:s};
}
export function validateConfig(url,key) {
  url = url.trim().replace(/\/$/,''); key = key.trim();
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) throw Error('Use https://YOUR-PROJECT-REF.supabase.co.');
  let valid = /^sb_publishable_[a-zA-Z0-9_-]+$/.test(key);
  if (!valid) { try { valid = decode(key).payload.role === 'anon'; } catch {} }
  if (!valid) throw Error('Use a publishable key. Secret and service_role keys are refused.');
  return {url,key};
}
export function mutate(token,fields) {
  const [h,,s] = token.split('.'), payload = {...decode(token).payload,...fields};
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const encoded = btoa(Array.from(bytes,c=>String.fromCharCode(c)).join('')).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  return h+'.'+encoded+'.'+s;
}
export function boundary(result,baseline,scope,target) {
  if (!result.ok || !Array.isArray(result.data)) return 'INCONCLUSIVE';
  if (result.data.length) return 'DATA EXPOSED';
  return baseline?.scope === scope && baseline.sub === target && baseline.rows > 0 ? 'BOUNDARY HELD' : 'NEEDS BASELINE';
}
