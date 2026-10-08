import { API_ACTIONS } from './constants.js';
import { state } from './state.js';
import { select, showNotice, clearApiResponse } from './ui.js';
import {
  buildPlaygroundRequest,
  previewPlaygroundRequest,
  describePlaygroundResponse,
} from './playground-request.js';

function readRequest() {
  return buildPlaygroundRequest({
    action: select('#api-action').value,
    attachToken: select('#api-attach-token').checked,
    token: select('#api-token').value,
    recipientId: select('#api-recipient').value,
    targetId: select('#api-target').value,
    senderId: select('#api-sender').value,
    subject: select('#api-subject').value,
    note: select('#api-note').value,
  });
}

export function updatePlayground() {
  const action = select('#api-action').value;
  const operation = API_ACTIONS[action];
  select('#api-compose').hidden = !['send', 'forge'].includes(action);
  select('#api-target-controls').hidden = action !== 'other-inbox';
  select('#api-sender-controls').hidden = action !== 'forge';
  select('#api-token').disabled = state.busy || !select('#api-attach-token').checked;
  select('#api-method').textContent = operation.method;
  select('#api-path').textContent = operation.path;
  select('#api-auth-step').textContent = select('#api-attach-token').checked
    ? 'Bearer token selected'
    : 'No user token';
  try {
    select('#api-request').textContent = previewPlaygroundRequest(readRequest(), state.config?.url);
  } catch (error) {
    select('#api-request').textContent = 'Request not ready: ' + error.message;
  }
}

export function useSignedInToken() {
  if (!state.session) {
    showNotice('Sign in as Alice or Bob first, then use that session’s token.', true);
    return;
  }
  select('#api-token').value = state.session.access_token;
  select('#api-attach-token').checked = true;
  clearApiResponse();
  updatePlayground();
}

export function clearPlaygroundToken() {
  select('#api-token').value = '';
  select('#api-attach-token').checked = false;
  clearApiResponse();
  updatePlayground();
}

export async function sendPlaygroundRequest(api) {
  clearApiResponse();
  const action = select('#api-action').value;
  let request;
  try {
    request = readRequest();
  } catch (error) {
    select('#api-result').textContent = 'Not sent: ' + error.message;
    return;
  }

  const target = state.config;
  const revision = state.apiRevision;
  if (!target) {
    select('#api-result').textContent = 'Not sent: connect your test project first.';
    return;
  }
  const contacts = [...state.apiContacts];
  select('#api-request').textContent = previewPlaygroundRequest(request, target.url);
  select('#api-result').textContent = 'Sending to Supabase…';
  select('#api-http-status').textContent = 'Waiting';
  select('#api-server-step').textContent = 'Waiting for Supabase';

  try {
    const result = await api.request(request.path, {
      method: request.method,
      token: request.token,
      body: request.body,
      target,
    });
    // Account/project changes clear the panel; a late response must not restore it.
    if (state.config !== target || state.apiRevision !== revision) {
      return;
    }
    select('#api-http-status').textContent = 'HTTP ' + result.status;
    select('#api-http-status').className =
      'http-status ' +
      (result.ok ? 'success' : result.status === 401 || result.status === 403 ? 'denied' : 'error');
    select('#api-server-step').textContent = 'Supabase responded';
    select('#api-result').textContent = describePlaygroundResponse(result, action, contacts);
    select('#api-response').textContent =
      result.data === null ? '(empty response body)' : JSON.stringify(result.data, null, 2);
  } catch (error) {
    if (state.config !== target || state.apiRevision !== revision) {
      return;
    }
    select('#api-http-status').textContent = 'No HTTP response';
    select('#api-http-status').className = 'http-status error';
    select('#api-server-step').textContent = 'Response unavailable';
    select('#api-result').textContent = error.message;
    select('#api-response').textContent =
      'No server response received. This is not proof that access was allowed or denied.';
  }
}
