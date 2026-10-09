import { PATHS } from './constants.js';
import { request, requireSuccess } from './api.js';
import { state, token, replaceSession } from './state.js';
import { $, notice, render, clearRequest } from './ui.js';
import { loadResult } from './quiz.js';

export async function signIn() {
  const revision = state.revision;
  const email = $('#email').value.trim();
  const password = $('#password').value;
  let response;
  try {
    response = await request(PATHS.login, { body: { email, password } });
  } finally {
    $('#password').value = '';
  }
  if (revision !== state.revision) return;
  const data = requireSuccess(response);
  replaceSession({
    scope: state.config.url,
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    user: { id: data.user.id, email: data.user.email },
  });
  $('#login-dialog').close();
  $('#quiz-form').reset();
  clearRequest();
  render();
  notice('Signed in. Your password is not saved by this page.');
  await loadResult(false);
}

export async function signOut() {
  const savedToken = token();
  // Clear the local session even if the network request fails.
  replaceSession(null);
  $('#quiz-form').reset();
  clearRequest();
  render();
  try {
    const response = await request(PATHS.logout, { token: savedToken });
    requireSuccess(response);
    notice('Signed out of this browser session.');
  } catch {
    notice('Local session cleared. Server sign-out could not be confirmed.', true);
  }
}
