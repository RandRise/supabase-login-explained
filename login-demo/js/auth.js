import { SESSION_KEY, LOGIN_PATH, REFRESH_PATH, LOGOUT_PATH } from './constants.js';
import { decode } from '../core.mjs';
import { state, saveStorage } from './state.js';
import { getApiError } from './api.js';
import { select, showNotice, renderApp, clearReport } from './ui.js';

export function applySession(data) {
  let next = null;
  if (data) {
    const claims = decode(data.access_token).payload;
    if (!data.refresh_token || !data.user?.id || claims.sub !== data.user.id) {
      throw Error('Supabase returned an incomplete or mismatched session.');
    }
    next = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      user: { id: data.user.id, email: data.user.email },
      scope: state.config.url,
    };
  }
  saveStorage(SESSION_KEY, next);
  state.session = next;
  clearReport();
  select('#raw-token').value = '';
  renderApp();
}

export async function signIn(api) {
  const target = state.config;
  try {
    const result = await api.request(LOGIN_PATH, {
      method: 'POST',
      body: { email: select('#email').value.trim(), password: select('#password').value },
      target,
    });
    if (state.config !== target) {
      throw Error('Connection changed during login. Try again.');
    }
    if (!result.ok) {
      throw Error(getApiError(result));
    }
    applySession(result.data);
    select('#restore-state').textContent =
      'Signed in during this page load. Reload to restore the saved session.';
    select('#test-results').textContent = '';
    showNotice('Signed in successfully.');
  } finally {
    select('#password').value = '';
  }
}

export async function signOut(api) {
  if (!state.session) {
    return;
  }
  const original = state.session;
  const target = { ...state.config };
  // Clear browser state immediately, even if the provider is unreachable.
  applySession(null);
  select('#restore-state').textContent =
    'Browser session cleared. A captured access-token copy stays in memory until you clear it or reload.';
  try {
    const result = await api.request(LOGOUT_PATH, {
      method: 'POST',
      token: original.access_token,
      target,
    });
    showNotice(
      result.ok
        ? 'Signed out.'
        : 'Browser signed out, but Supabase logout was not confirmed: ' + getApiError(result),
      !result.ok,
    );
  } catch (error) {
    showNotice('Browser signed out. Supabase logout was not confirmed. ' + error.message, true);
  }
}

export async function refreshSession(api) {
  const expected = state.session;
  const target = state.config;
  if (!expected) {
    throw Error('Sign in first.');
  }
  const result = await api.request(REFRESH_PATH, {
    method: 'POST',
    body: { refresh_token: expected.refresh_token },
    target,
  });
  if (state.session !== expected || state.config !== target) {
    return;
  }
  if (!result.ok) {
    throw Error(getApiError(result));
  }
  applySession(result.data);
  showNotice('Session refreshed. The token pair and expiry have changed.');
}
