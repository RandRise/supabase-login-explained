import { TABLE, REPORT_PATH, REQUEST_TIMEOUT_MS } from './constants.js';
// A REST client with an optional logger. It has no DOM or browser-storage dependency.

export function getApiError(result) {
  return (
    result.data?.msg ||
    result.data?.message ||
    result.data?.error_description ||
    result.data?.error ||
    'HTTP ' + result.status
  );
}

export function createApi(getConfig, onRequest = () => {}) {
  async function request(path, { method = 'GET', token = '', body, target = getConfig() } = {}) {
    if (!target) {
      throw Error('Connect your Supabase project in Connection settings first.');
    }
    const headers = { apikey: target.key };
    if (token) {
      headers.Authorization = 'Bearer ' + token;
    }
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    let response;
    try {
      response = await fetch(target.url + path, {
        method,
        headers,
        credentials: 'omit',
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      onRequest(method, path, 'NETWORK ERROR');
      throw Error(
        'Request failed or timed out. Check the connection and project status. No access result was received.',
      );
    }
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      /* Not every response has a JSON body. */
    }
    onRequest(method, path, response.status);
    return { ok: response.ok, status: response.status, data };
  }

  function notePath(ownerId) {
    const base = '/rest/v1/' + TABLE + '?select=id,user_id,title,body';
    return ownerId ? base + '&user_id=eq.' + encodeURIComponent(ownerId) : base;
  }

  function getReport(token = '', target = getConfig()) {
    return request(REPORT_PATH, { method: 'POST', body: {}, token, target });
  }

  return { request, notePath, getReport };
}
