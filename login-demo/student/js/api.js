import { TIMEOUT_MS } from './constants.js';
import { state } from './state.js';

export async function request(path, { token = '', body = {}, method = 'POST' } = {}) {
  if (!state.config) throw Error('Connect your Supabase test project first.');
  const headers = { apikey: state.config.key };
  if (token) headers.Authorization = 'Bearer ' + token;
  if (method !== 'GET') headers['Content-Type'] = 'application/json';
  let response;
  try {
    response = await fetch(state.config.url + path, {
      method,
      headers,
      credentials: 'omit',
      body: method === 'GET' ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw Error('No HTTP response received. Check the connection and retry.');
  }
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: 'Non-JSON response' };
  }
  return { ok: response.ok, status: response.status, data, path, method, attached: !!token };
}

export function requireSuccess(response) {
  if (!response.ok)
    throw Error(
      response.data?.msg ||
        response.data?.message ||
        response.data?.error_description ||
        'Request failed: HTTP ' + response.status,
    );
  return response.data;
}
